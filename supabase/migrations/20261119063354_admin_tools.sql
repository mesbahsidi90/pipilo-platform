-- Platform admin tools: Pro activation requests, a per-shop overview
-- (owner, usage, features), readable shop accounts and platform stats.

create table private.plan_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  requested_by uuid,
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid
);
create unique index plan_requests_one_open on private.plan_requests(shop_id) where status = 'open';
alter table private.plan_requests enable row level security;
revoke all on private.plan_requests from public, anon, authenticated;

-- Merchant: ask the platform to activate Pro for the current branch.
create function public.request_plan_upgrade(note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  branch uuid := public.current_shop_id();
  existing private.plan_requests;
  recent integer;
begin
  if branch is null or not merchant_workspace_private.can_edit_settings(branch) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if private.branch_has_paid_plan(branch) then
    return jsonb_build_object('error', 'already_paid');
  end if;
  select * into existing from private.plan_requests where shop_id = branch and status = 'open';
  if found then
    return jsonb_build_object('status', 'open', 'created_at', existing.created_at);
  end if;
  select count(*) into recent from private.plan_requests
  where shop_id = branch and created_at > now() - interval '1 day';
  if recent >= 3 then return jsonb_build_object('error', 'rate_limit'); end if;
  insert into private.plan_requests(shop_id, requested_by, note)
  values (branch, auth.uid(), nullif(left(btrim(coalesce(note, '')), 300), ''))
  returning * into existing;
  return jsonb_build_object('status', 'open', 'created_at', existing.created_at);
end;
$$;
revoke all on function public.request_plan_upgrade(text) from public, anon;
grant execute on function public.request_plan_upgrade(text) to authenticated;

create function public.my_plan_request() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('status', r.status, 'created_at', r.created_at)
  from private.plan_requests r
  where r.shop_id = public.current_shop_id() and r.status = 'open'
    and merchant_workspace_private.can_edit_settings(r.shop_id);
$$;
revoke all on function public.my_plan_request() from public, anon;
grant execute on function public.my_plan_request() to authenticated;

-- Admin: open requests, newest first, with who asked.
create function public.admin_plan_requests() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'shop_id', r.shop_id, 'note', r.note, 'created_at', r.created_at,
      'email', u.email, 'phone', u.phone
    ) order by r.created_at desc)
    from private.plan_requests r
    left join auth.users u on u.id = r.requested_by
    where r.status = 'open'
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_plan_requests() from public, anon;
grant execute on function public.admin_plan_requests() to authenticated;

create function public.admin_resolve_plan_request(target uuid, outcome text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare done uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  if outcome not in ('done', 'dismissed') then return false; end if;
  update private.plan_requests
  set status = outcome, handled_at = now(), handled_by = auth.uid()
  where id = target and status = 'open'
  returning id into done;
  if done is null then return false; end if;
  insert into public.admin_audit(actor_id, entity, entity_id, action)
  values (auth.uid(), 'plan_requests', done::text, upper(outcome));
  return true;
end;
$$;
revoke all on function public.admin_resolve_plan_request(uuid, text) from public, anon;
grant execute on function public.admin_resolve_plan_request(uuid, text) to authenticated;

-- Admin: one row per shop (branches included) with owner, usage and features.
create function public.admin_shop_overview() returns jsonb
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

-- Admin: shop accounts with their email/phone instead of raw ids.
create function public.admin_members() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', m.user_id, 'shop_id', m.shop_id,
      'email', u.email, 'phone', u.phone,
      'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
      'owner', exists(select 1 from merchant_workspace_private.owners ow
        where ow.user_id = m.user_id and ow.shop_id = m.shop_id)
    ) order by u.created_at desc nulls last)
    from public.memberships m
    left join auth.users u on u.id = m.user_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;

-- Admin: find an account id by email or phone, to link it to a shop.
create function public.admin_find_user(contact text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  value text := lower(btrim(coalesce(contact, '')));
  found_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  if value = '' then return null; end if;
  select id into found_id from auth.users
  where lower(email) = value
     or (value ~ '^\+?[0-9 ]{6,20}$' and phone = regexp_replace(value, '[^0-9]', '', 'g'))
  limit 1;
  return found_id;
end;
$$;
revoke all on function public.admin_find_user(text) from public, anon;
grant execute on function public.admin_find_user(text) to authenticated;

-- Admin: signups per week (12 weeks) and orders per day (30 days), Algiers time.
create function public.admin_platform_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'Africa/Algiers')::date;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'signups', (
      select jsonb_agg(jsonb_build_object('week', w.week, 'count', (
        select count(*) from public.shops s
        where s.parent_shop_id is null
          and (s.created_at at time zone 'Africa/Algiers')::date >= w.week
          and (s.created_at at time zone 'Africa/Algiers')::date < w.week + 7
      )) order by w.week)
      from (select (date_trunc('week', today)::date - 7 * g) as week
        from generate_series(0, 11) g) w
    ),
    'orders', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'count', (
        select count(*) from public.orders o
        where o.created_at >= d.day::timestamp at time zone 'Africa/Algiers'
          and o.created_at < (d.day + 1)::timestamp at time zone 'Africa/Algiers'
      )) order by d.day)
      from (select today - g as day from generate_series(0, 29) g) d
    )
  );
end;
$$;
revoke all on function public.admin_platform_stats() from public, anon;
grant execute on function public.admin_platform_stats() to authenticated;

notify pgrst, 'reload schema';
