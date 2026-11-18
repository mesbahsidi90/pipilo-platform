create or replace function merchant_workspace_private.admin_order_activity()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  today date := (now() at time zone 'Africa/Algiers')::date;
  first_day timestamptz := (today - 13)::timestamp at time zone 'Africa/Algiers';
  next_day timestamptz := (today + 1)::timestamp at time zone 'Africa/Algiers';
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;

  return jsonb_build_object('today', today, 'shops', coalesce((
    select jsonb_agg(to_jsonb(summary) order by summary.name, summary.id)
    from (
      select root.id, root.name, root.status, root.city,
        account.email, account.phone,
        activity.branch_ids, activity.last_order_at,
        coalesce(activity.daily, '{}'::jsonb) as daily
      from public.shops root
      left join merchant_workspace_private.owners owner on owner.shop_id = root.id
      left join auth.users account on account.id = owner.user_id
      cross join lateral (
        with branches as (
          select s.id from public.shops s
          where s.id = root.id or s.parent_shop_id = root.id
        )
        select
          (select array_agg(id) from branches) as branch_ids,
          (select max(latest.created_at)
            from branches b cross join lateral (
              select o.created_at from public.orders o
              where o.shop_id = b.id order by o.created_at desc limit 1
            ) latest) as last_order_at,
          (select jsonb_object_agg(day, total)
            from (
              select (o.created_at at time zone 'Africa/Algiers')::date as day, count(*) as total
              from branches b join public.orders o on o.shop_id = b.id
              where o.created_at >= first_day and o.created_at < next_day
              group by 1
            ) counts) as daily
      ) activity
      where root.parent_shop_id is null
    ) summary
  ), '[]'::jsonb));
end;
$$;

revoke all on function merchant_workspace_private.admin_order_activity() from public, anon;
grant execute on function merchant_workspace_private.admin_order_activity() to authenticated;

create or replace function public.admin_order_activity()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select merchant_workspace_private.admin_order_activity(); $$;

revoke all on function public.admin_order_activity() from public, anon;
grant execute on function public.admin_order_activity() to authenticated;

notify pgrst, 'reload schema';
