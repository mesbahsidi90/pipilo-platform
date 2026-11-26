-- «أداء الأنشطة» in the admin page: per-shop numbers to understand how each
-- activity uses Bipilo (orders, preparation time, phones that followed and
-- rang, ratings, games) and to see where the product can get better.

-- 1. Record when a guest plays a waiting game (once per order).
alter table public.order_guest_signals add column game_played_at timestamptz;

create or replace function public.guest_order_signal(ticket uuid, event_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare o record; t timestamptz := clock_timestamp();
begin
  if ticket is null or event_name not in ('opened','heartbeat','sound_enabled','push_enabled','ready_seen','coming','game') then
    return false;
  end if;
  select id, shop_id, status into o from public.orders
  where token = ticket and coalesce(restored_at, created_at) > now() - interval '24 hours';
  if not found or o.status not in ('preparing','ready') then return false; end if;
  if event_name in ('ready_seen','coming') and o.status <> 'ready' then return false; end if;
  if event_name = 'push_enabled' and not exists(select 1 from public.push_subscriptions where order_id = o.id) then
    return false;
  end if;
  insert into public.order_guest_signals as s(order_id, shop_id, opened_at, last_seen_at, sound_enabled_at,
    push_enabled_at, ready_seen_at, coming_at, game_played_at)
  values(o.id, o.shop_id, t, t,
    case when event_name = 'sound_enabled' then t end,
    case when event_name = 'push_enabled' then t end,
    case when event_name = 'ready_seen' then t end,
    case when event_name = 'coming' then t end,
    case when event_name = 'game' then t end)
  on conflict(order_id) do update set
    last_seen_at = case when s.last_seen_at < t - interval '30 seconds' then t else s.last_seen_at end,
    sound_enabled_at = coalesce(s.sound_enabled_at, excluded.sound_enabled_at),
    push_enabled_at = coalesce(s.push_enabled_at, excluded.push_enabled_at),
    ready_seen_at = coalesce(s.ready_seen_at, excluded.ready_seen_at),
    coming_at = coalesce(s.coming_at, excluded.coming_at),
    game_played_at = coalesce(s.game_played_at, excluded.game_played_at)
  where s.last_seen_at < t - interval '30 seconds'
    or (s.sound_enabled_at is null and excluded.sound_enabled_at is not null)
    or (s.push_enabled_at is null and excluded.push_enabled_at is not null)
    or (s.ready_seen_at is null and excluded.ready_seen_at is not null)
    or (s.coming_at is null and excluded.coming_at is not null)
    or (s.game_played_at is null and excluded.game_played_at is not null);
  return true;
end; $$;

-- 2. Per-shop numbers over the last `days` days (branches counted with their shop).
create function merchant_workspace_private.admin_shop_insights(days integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  span integer := least(greatest(coalesce(days, 30), 1), 365);
  today date := (now() at time zone 'Africa/Algiers')::date;
  since timestamptz := (today - (span - 1))::timestamp at time zone 'Africa/Algiers';
  midnight timestamptz := today::timestamp at time zone 'Africa/Algiers';
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'days', span,
    'since', since,
    'shops', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.orders desc, x.name)
      from (
        select root.id, root.name, root.kind, root.city, root.status, root.created_at,
          settings.tracking_mode,
          (select count(*) from public.shops b where b.parent_shop_id = root.id) as branches,
          plan.name as plan_name, sub.status as plan_status,
          st.*
        from public.shops root
        left join public.shop_settings settings on settings.shop_id = root.id
        left join public.subscriptions sub on sub.shop_id = root.id
        left join public.plans plan on plan.id = sub.plan_id
        cross join lateral (
          with o as (
            select o.* from public.orders o
            where o.created_at >= since
              and (o.shop_id = root.id
                or o.shop_id in (select b.id from public.shops b where b.parent_shop_id = root.id))
          ),
          g as (select s.* from public.order_guest_signals s join o on o.id = s.order_id),
          prep as (
            select extract(epoch from o.ready_at - o.created_at) / 60 as minutes from o
            where o.ready_at > o.created_at and o.ready_at < o.created_at + interval '3 hours'
          ),
          pickup as (
            select extract(epoch from o.collected_at - o.ready_at) / 60 as minutes from o
            where o.collected_at > o.ready_at and o.collected_at < o.ready_at + interval '3 hours'
          )
          select
            (select count(*) from o) as orders,
            (select count(*) from o where o.created_at >= midnight) as today,
            (select count(distinct (o.created_at at time zone 'Africa/Algiers')::date) from o) as active_days,
            (select count(*) from o where o.status = 'cancelled') as cancelled,
            (select max(o.created_at) from o) as last_order_at,
            (select round(avg(minutes)::numeric, 1) from prep) as prep_avg,
            (select round((percentile_cont(0.5) within group (order by minutes))::numeric, 1) from prep) as prep_median,
            (select round(avg(minutes)::numeric, 1) from pickup) as pickup_avg,
            (select extract(hour from o.created_at at time zone 'Africa/Algiers')::int from o
              group by 1 order by count(*) desc, 1 limit 1) as peak_hour,
            (select count(*) from o where o.invoice_request_key is not null) as from_invoice,
            (select count(*) from o where o.counter_claim_key is not null) as from_counter,
            (select count(*) from o where o.clinic_request_key is not null) as from_clinic,
            (select count(*) from o where o.online_request_key is not null) as from_online,
            (select count(*) from o where o.external_ref is not null) as from_pos,
            (select count(*) from o where o.recalled_at is not null) as recalled,
            (select count(*) from g where g.opened_at is not null) as followed,
            (select count(*) from g where g.push_enabled_at is not null) as alerts_on,
            (select count(*) from g where g.sound_enabled_at is not null) as sound_on,
            (select count(distinct p.order_id) from public.push_subscriptions p join o on o.id = p.order_id
              where p.sent_at is not null) as rang,
            (select count(*) from g where g.push_delivered_at is not null) as delivered,
            (select count(*) from g where g.ready_seen_at is not null) as saw_ready,
            (select count(*) from g where g.coming_at is not null) as coming,
            (select count(*) from g where g.game_played_at is not null) as played,
            (select count(*) from private.order_ratings r join o on o.id = r.order_id) as ratings,
            (select round(avg(r.stars)::numeric, 2) from private.order_ratings r join o on o.id = r.order_id) as rating_avg,
            (select count(*) from private.order_feedback f join o on o.id = f.order_id) as comments,
            (select count(*) from private.loyalty_stamps l join o on o.id = l.order_id) as loyalty_stamps
        ) st
        where root.parent_shop_id is null
      ) x
    ), '[]'::jsonb),
    -- People trying Bipilo from the landing page (not tied to a shop).
    'trial', (
      select jsonb_build_object(
        'tickets', count(*),
        'opened', count(*) filter (where opened_at is not null),
        'alerts_on', count(*) filter (where push_enabled_at is not null),
        'rang', count(*) filter (where push_sent_at is not null),
        'delivered', count(*) filter (where push_delivered_at is not null),
        'coming', count(*) filter (where coming_at is not null),
        'places', (select count(*) from public.trial_places p where p.created_at >= since)
      )
      from public.trial_tickets where created_at >= since
    )
  );
end; $$;
revoke all on function merchant_workspace_private.admin_shop_insights(integer) from public, anon;
grant execute on function merchant_workspace_private.admin_shop_insights(integer) to authenticated;

create function public.admin_shop_insights(days integer default 30) returns jsonb
language sql stable set search_path = '' as $$
  select merchant_workspace_private.admin_shop_insights(days);
$$;
revoke all on function public.admin_shop_insights(integer) from public, anon;
grant execute on function public.admin_shop_insights(integer) to authenticated;

notify pgrst, 'reload schema';
