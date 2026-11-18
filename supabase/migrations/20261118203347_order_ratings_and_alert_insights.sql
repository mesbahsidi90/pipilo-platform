-- Star ratings after pickup, alert-method tracking and branch insights.

create table private.order_ratings (
  order_id uuid primary key references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now()
);
create index order_ratings_shop_date on private.order_ratings(shop_id, created_at desc);
alter table private.order_ratings enable row level security;
revoke all on private.order_ratings from public, anon, authenticated;

-- Customer rates a collected order once, within 24 hours, with its ticket token.
create function public.rate_order(ticket uuid, stars integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  target_order uuid;
  target_shop uuid;
begin
  if stars is null or stars not between 1 and 5 then return false; end if;
  select o.id, o.shop_id into target_order, target_shop
  from public.orders o
  where o.token = ticket and o.status = 'collected'
    and coalesce(o.restored_at, o.created_at) > now() - interval '24 hours';
  if not found then return false; end if;
  insert into private.order_ratings(order_id, shop_id, stars)
  values (target_order, target_shop, stars)
  on conflict (order_id) do nothing;
  return true;
end;
$$;
revoke all on function public.rate_order(uuid, integer) from public;
grant execute on function public.rate_order(uuid, integer) to anon, authenticated;

-- Same payload as before, plus the customer's own rating.
create or replace function public.guest_order_extras(ticket uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'coming_at', g.coming_at,
    'google_review_url', case when o.status = 'collected' then coalesce(s.google_review_url, '') else '' end,
    'private_feedback_enabled', o.status = 'collected' and coalesce(s.private_feedback_enabled, false)
      and private.branch_has_paid_plan(o.shop_id),
    'feedback_sent', exists(select 1 from private.order_feedback f where f.order_id = o.id),
    'rating', (select r.stars from private.order_ratings r where r.order_id = o.id)
  )
  from public.orders o
  left join public.order_guest_signals g on g.order_id = o.id
  left join public.shop_settings s on s.shop_id = o.shop_id
  where o.token = ticket and coalesce(o.restored_at, o.created_at) > now() - interval '24 hours'
  limit 1;
$$;

-- Which push service the customer's browser used (kept after subscriptions expire).
alter table public.order_guest_signals add column push_platform text
  check (push_platform in ('apple', 'chrome', 'firefox', 'edge', 'other'));

create function private.record_push_platform() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  host text := lower(substring(new.endpoint from '^https://([^/:]+)'));
  platform text := case
    when host = 'push.apple.com' or host like '%.push.apple.com' then 'apple'
    when host = 'fcm.googleapis.com' or host like '%.fcm.googleapis.com' then 'chrome'
    when host like '%push.services.mozilla.com' then 'firefox'
    when host like '%notify.windows.com' then 'edge'
    else 'other' end;
  t timestamptz := clock_timestamp();
begin
  insert into public.order_guest_signals as s(order_id, shop_id, opened_at, last_seen_at, push_platform)
  select o.id, o.shop_id, t, t, platform from public.orders o where o.id = new.order_id
  on conflict (order_id) do update set push_platform = excluded.push_platform;
  return new;
end;
$$;
revoke all on function private.record_push_platform() from public, anon, authenticated;
create trigger push_subscription_platform after insert on public.push_subscriptions
for each row execute function private.record_push_platform();

-- Ratings and alert reach for the signed-in user's branch over a period.
create function public.branch_guest_insights(since timestamptz, until timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with branch as (select public.current_shop_id() as id),
  rated as (
    select r.stars from private.order_ratings r, branch
    where r.shop_id = branch.id and r.created_at >= since and r.created_at < until
  ),
  readied as (
    select o.id, g.ready_seen_at, g.coming_at, g.push_platform
    from public.orders o
    cross join branch
    left join public.order_guest_signals g on g.order_id = o.id
    where o.shop_id = branch.id and o.ready_at is not null
      and o.created_at >= since and o.created_at < until
  )
  select jsonb_build_object(
    'ratings', (select jsonb_build_object(
      'count', count(*),
      'average', round(avg(stars)::numeric, 2),
      'stars', jsonb_build_object(
        '1', count(*) filter (where stars = 1), '2', count(*) filter (where stars = 2),
        '3', count(*) filter (where stars = 3), '4', count(*) filter (where stars = 4),
        '5', count(*) filter (where stars = 5))
    ) from rated),
    'alerts', (select jsonb_build_object(
      'ready', count(*),
      'reached', count(*) filter (where ready_seen_at is not null or coming_at is not null),
      'methods', jsonb_build_object(
        'apple', count(*) filter (where push_platform = 'apple'),
        'chrome', count(*) filter (where push_platform = 'chrome'),
        'firefox', count(*) filter (where push_platform = 'firefox'),
        'edge', count(*) filter (where push_platform = 'edge'),
        'other', count(*) filter (where push_platform = 'other'),
        'page', count(*) filter (where push_platform is null))
    ) from readied)
  )
  where (select id from branch) is not null
    and until > since and until - since <= interval '367 days';
$$;
revoke all on function public.branch_guest_insights(timestamptz, timestamptz) from public, anon;
grant execute on function public.branch_guest_insights(timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
