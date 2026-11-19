-- Where each shop came from: the signup answer «من وين عرفت Bipilo؟» and
-- the ad/visit link it arrived with (ref and utm_* parameters).

create table private.signup_sources (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  answer text check (answer in ('facebook', 'instagram', 'tiktok', 'visit', 'friend', 'google', 'other')),
  ref text check (char_length(ref) <= 60),
  utm_source text check (char_length(utm_source) <= 60),
  utm_medium text check (char_length(utm_medium) <= 60),
  utm_campaign text check (char_length(utm_campaign) <= 80),
  landing text check (char_length(landing) <= 120),
  created_at timestamptz not null default now()
);
alter table private.signup_sources enable row level security;
revoke all on private.signup_sources from public, anon, authenticated;

-- Owner, right after creating the shop: saved once, later calls are ignored.
create function public.record_signup_source(
  answer text default null, ref text default null, utm_source text default null,
  utm_medium text default null, utm_campaign text default null, landing text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  branch uuid := public.current_shop_id();
  clean text := case when answer in ('facebook', 'instagram', 'tiktok', 'visit', 'friend', 'google', 'other')
    then answer end;
begin
  if branch is null or not merchant_workspace_private.can_edit_settings(branch) then return false; end if;
  insert into private.signup_sources(shop_id, answer, ref, utm_source, utm_medium, utm_campaign, landing)
  values (branch, clean,
    nullif(left(lower(btrim(coalesce(ref, ''))), 60), ''),
    nullif(left(lower(btrim(coalesce(utm_source, ''))), 60), ''),
    nullif(left(lower(btrim(coalesce(utm_medium, ''))), 60), ''),
    nullif(left(btrim(coalesce(utm_campaign, '')), 80), ''),
    nullif(left(btrim(coalesce(landing, '')), 120), ''))
  on conflict (shop_id) do nothing;
  return found;
end;
$$;
revoke all on function public.record_signup_source(text, text, text, text, text, text) from public, anon;
grant execute on function public.record_signup_source(text, text, text, text, text, text) to authenticated;

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
          'utm_source', ss.utm_source, 'utm_campaign', ss.utm_campaign)
          from private.signup_sources ss where ss.shop_id = coalesce(s.parent_shop_id, s.id)),
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
