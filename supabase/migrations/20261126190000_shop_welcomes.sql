-- «رسالة ترحيب»: the admin welcomes each new shop owner on WhatsApp from their
-- own phone; we remember which shops were welcomed so none is forgotten.
create table private.shop_welcomes (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  welcomed_at timestamptz not null default now(),
  welcomed_by uuid
);
alter table private.shop_welcomes enable row level security;
revoke all on private.shop_welcomes from public, anon, authenticated;

-- Mark (done = true) or unmark a shop as welcomed. Returns the welcome time.
create function public.admin_mark_welcomed(target uuid, done boolean default true)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare stamp timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shops where id = target) then return null; end if;
  if done then
    insert into private.shop_welcomes(shop_id, welcomed_by) values (target, auth.uid())
    on conflict (shop_id) do update set welcomed_at = now(), welcomed_by = auth.uid()
    returning welcomed_at into stamp;
  else
    delete from private.shop_welcomes where shop_id = target;
  end if;
  insert into public.admin_audit(actor_id, entity, entity_id, action)
  values (auth.uid(), 'shop_welcomes', target::text, case when done then 'WELCOMED' else 'UNWELCOMED' end);
  return stamp;
end;
$$;
revoke all on function public.admin_mark_welcomed(uuid, boolean) from public, anon;
grant execute on function public.admin_mark_welcomed(uuid, boolean) to authenticated;

-- Same overview as before, plus 'welcomed_at'.
create or replace function public.admin_shop_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
          from private.plan_requests r where r.shop_id = s.id and r.status = 'open'),
        'welcomed_at', (select w.welcomed_at from private.shop_welcomes w where w.shop_id = s.id)
      ))
      from public.shops s
      left join public.shop_settings st on st.shop_id = s.id
    ), '[]'::jsonb)
  );
end;
$$;

notify pgrst, 'reload schema';
