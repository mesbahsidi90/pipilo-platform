-- Apply after order_cancellation.sql and lifetime_plans.sql.

alter table public.shop_settings add column private_feedback_enabled boolean not null default false;

create table private.order_feedback (
  order_id uuid primary key references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  comment text not null check (char_length(comment) between 1 and 500),
  created_at timestamptz not null default now()
);
create index order_feedback_shop_date on private.order_feedback(shop_id, created_at desc);
alter table private.order_feedback enable row level security;
revoke all on private.order_feedback from public, anon, authenticated;

create or replace function public.guest_order_extras(ticket uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'coming_at', g.coming_at,
    'google_review_url', case when o.status = 'collected' then coalesce(s.google_review_url, '') else '' end,
    'private_feedback_enabled', o.status = 'collected' and coalesce(s.private_feedback_enabled, false)
      and private.branch_has_paid_plan(o.shop_id),
    'feedback_sent', exists(select 1 from private.order_feedback f where f.order_id = o.id)
  )
  from public.orders o
  left join public.order_guest_signals g on g.order_id = o.id
  left join public.shop_settings s on s.shop_id = o.shop_id
  where o.token = ticket and coalesce(o.restored_at, o.created_at) > now() - interval '24 hours'
  limit 1;
$$;

create function public.submit_order_feedback(ticket uuid, message text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  target_order uuid;
  target_shop uuid;
  cleaned text := regexp_replace(message, '^\s+|\s+$', '', 'g');
begin
  if cleaned is null or char_length(cleaned) not between 1 and 500 then return false; end if;
  select o.id, o.shop_id into target_order, target_shop
  from public.orders o join public.shop_settings s on s.shop_id = o.shop_id
  where o.token = ticket and o.status = 'collected'
    and coalesce(o.restored_at, o.created_at) > now() - interval '24 hours'
    and s.private_feedback_enabled and private.branch_has_paid_plan(o.shop_id);
  if not found then return false; end if;
  insert into private.order_feedback(order_id, shop_id, comment)
  values(target_order, target_shop, cleaned)
  on conflict (order_id) do nothing;
  return true;
end;
$$;
revoke all on function public.submit_order_feedback(uuid, text) from public;
grant execute on function public.submit_order_feedback(uuid, text) to anon, authenticated;

create function public.branch_order_feedback()
returns table(order_id uuid, number text, comment text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.order_id, o.number, f.comment, f.created_at
  from private.order_feedback f
  join public.orders o on o.id = f.order_id
  join public.shops s on s.id = f.shop_id
  where f.shop_id = (select public.current_shop_id())
    and private.branch_has_paid_plan(f.shop_id)
    and exists (
      select 1 from merchant_workspace_private.owners owner
      where owner.shop_id = coalesce(s.parent_shop_id, s.id) and owner.user_id = (select auth.uid())
    )
  order by f.created_at desc
  limit 100;
$$;
revoke all on function public.branch_order_feedback() from public, anon;
grant execute on function public.branch_order_feedback() to authenticated;
