-- Referral code per shop: owners share bipilo.app/?invite=CODE, and a new
-- shop that signs up from that link is linked to the shop that invited it.

create table private.referral_codes (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  code text not null unique check (code ~ '^[a-z0-9]{6}$'),
  created_at timestamptz not null default now()
);
alter table private.referral_codes enable row level security;
revoke all on private.referral_codes from public, anon, authenticated;

alter table private.signup_sources
  add column referred_by uuid references public.shops(id) on delete set null;
create index signup_sources_referred_by on private.signup_sources(referred_by)
  where referred_by is not null;

-- Six letters/digits without look-alikes (no i, l, o, 0, 1).
create function private.new_referral_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  bytes bytea;
  candidate text;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    candidate := '';
    for i in 0..5 loop
      candidate := candidate || substr(alphabet, 1 + get_byte(bytes, i) % length(alphabet), 1);
    end loop;
    exit when not exists (select 1 from private.referral_codes r where r.code = candidate);
  end loop;
  return candidate;
end;
$$;
revoke all on function private.new_referral_code() from public, anon, authenticated;

-- Owner: the main shop's code (created on first call) and what it brought.
create function public.my_referral() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  root uuid;
  ref_code text;
begin
  select coalesce(s.parent_shop_id, s.id) into root
  from public.shops s where s.id = public.current_shop_id();
  if root is null or not merchant_workspace_private.can_edit_settings(root) then
    return null;
  end if;
  select r.code into ref_code from private.referral_codes r where r.shop_id = root;
  if ref_code is null then
    insert into private.referral_codes(shop_id, code)
    values (root, private.new_referral_code())
    on conflict (shop_id) do nothing;
    select r.code into ref_code from private.referral_codes r where r.shop_id = root;
  end if;
  return jsonb_build_object(
    'code', ref_code,
    'signups', (select count(*) from private.signup_sources ss where ss.referred_by = root),
    'active', (select count(*) from private.signup_sources ss
      where ss.referred_by = root
        and exists (select 1 from public.orders o where o.shop_id = ss.shop_id)),
    'paid', (select count(*) from private.signup_sources ss
      where ss.referred_by = root and private.branch_has_paid_plan(ss.shop_id))
  );
end;
$$;
revoke all on function public.my_referral() from public, anon;
grant execute on function public.my_referral() to authenticated;

-- Same as before, plus the invite code: links the new shop to the inviter.
drop function public.record_signup_source(text, text, text, text, text, text);
create function public.record_signup_source(
  answer text default null, ref text default null, utm_source text default null,
  utm_medium text default null, utm_campaign text default null, landing text default null,
  invite text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  branch uuid := public.current_shop_id();
  clean text := case when answer in ('facebook', 'instagram', 'tiktok', 'visit', 'friend', 'google', 'other')
    then answer end;
  inviter uuid;
begin
  if branch is null or not merchant_workspace_private.can_edit_settings(branch) then return false; end if;
  select r.shop_id into inviter from private.referral_codes r
  where r.code = lower(btrim(coalesce(invite, ''))) and r.shop_id <> branch;
  insert into private.signup_sources(shop_id, answer, ref, utm_source, utm_medium, utm_campaign, landing, referred_by)
  values (branch, coalesce(clean, case when inviter is not null then 'friend' end),
    nullif(left(lower(btrim(coalesce(ref, ''))), 60), ''),
    nullif(left(lower(btrim(coalesce(utm_source, ''))), 60), ''),
    nullif(left(lower(btrim(coalesce(utm_medium, ''))), 60), ''),
    nullif(left(btrim(coalesce(utm_campaign, '')), 80), ''),
    nullif(left(btrim(coalesce(landing, '')), 120), ''),
    inviter)
  on conflict (shop_id) do nothing;
  return found;
end;
$$;
revoke all on function public.record_signup_source(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.record_signup_source(text, text, text, text, text, text, text) to authenticated;

-- Admin: one row per shop (branches included) with owner, usage and features.
create or replace function public.admin_shop_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  month_start timestamptz := date_trunc('month', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'free_limit', coalesce((select free_ticket_limit from public.plans
      where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538'), 100),
    'shops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'parent_id', s.parent_shop_id,
        'paid', private.branch_has_paid_plan(s.id),
        'orders_month', (select count(*) from public.orders o
          where o.shop_id = s.id and o.created_at >= month_start),
        'orders_total', (select count(*) from public.orders o where o.shop_id = s.id),
        'last_order_at', (select max(o.created_at) from public.orders o where o.shop_id = s.id),
        'owner', (
          select jsonb_build_object('email', u.email, 'phone', u.phone,
            'last_sign_in_at', u.last_sign_in_at)
          from merchant_workspace_private.owners ow
          join auth.users u on u.id = ow.user_id
          where ow.shop_id = coalesce(s.parent_shop_id, s.id)
          limit 1),
        'members', (select count(*) from public.memberships m where m.shop_id = s.id),
        'features', jsonb_build_object(
          'menu', coalesce(st.menu_enabled, false),
          'menu_items', (select count(*) from public.menu_items mi where mi.shop_id = s.id),
          'ordering', coalesce(st.ordering_enabled, false),
          'loyalty', coalesce(st.loyalty_enabled, false),
          'feedback', coalesce(st.private_feedback_enabled, false),
          'google_reviews', coalesce(st.google_review_url, '') <> '',
          'pos_keys', (select count(*) from private.pos_keys k
            where k.shop_id = s.id and k.revoked_at is null),
          'tracking_mode', st.tracking_mode
        ),
        'source', (select jsonb_build_object('answer', ss.answer, 'ref', ss.ref,
          'utm_source', ss.utm_source, 'utm_campaign', ss.utm_campaign,
          'referred_by', ss.referred_by)
          from private.signup_sources ss where ss.shop_id = coalesce(s.parent_shop_id, s.id)),
        'referral_code', (select r.code from private.referral_codes r where r.shop_id = s.id),
        'request', (select jsonb_build_object('id', r.id, 'created_at', r.created_at, 'note', r.note)
          from private.plan_requests r where r.shop_id = s.id and r.status = 'open')
      ))
      from public.shops s
      left join public.shop_settings st on st.shop_id = s.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_shop_overview() from public, anon;
grant execute on function public.admin_shop_overview() to authenticated;

notify pgrst, 'reload schema';
