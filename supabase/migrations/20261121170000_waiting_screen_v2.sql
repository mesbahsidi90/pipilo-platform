-- Waiting screen v2: the time each number was called (newest call shown big,
-- old calls cleared) and the shop's logo and alert tone for the TV.

drop function public.display_orders(uuid);
create function public.display_orders(ticket uuid)
returns table(number text, status text, room text, ready_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with branch as (
    select d.shop_id as id from merchant_workspace_private.display_links d where d.token=ticket
    union
    select s.id from public.shops s where s.display_token=ticket
      and not exists(select 1 from merchant_workspace_private.display_links d where d.shop_id=s.id)
  )
  select o.number, o.status,
    case when o.status='ready' then o.room end,
    case when o.status='ready' then o.ready_at end
  from branch b join public.orders o on o.shop_id=b.id
  where o.status in ('preparing','ready') and coalesce(o.restored_at,o.created_at)>now()-interval '24 hours'
  order by o.priority desc, coalesce(o.restored_at,o.created_at) limit 100;
$$;
revoke all on function public.display_orders(uuid) from public;
grant execute on function public.display_orders(uuid) to anon, authenticated;

create function public.display_branding(ticket uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with branch as (
    select d.shop_id as id from merchant_workspace_private.display_links d where d.token=ticket
    union
    select s.id from public.shops s where s.display_token=ticket
      and not exists(select 1 from merchant_workspace_private.display_links d where d.shop_id=s.id)
  )
  select jsonb_build_object(
    'name', coalesce(nullif(s.name, ''), h.name),
    'kind', h.kind,
    'logo', coalesce(s.logo, ''),
    'alert_tone', coalesce(s.alert_tone, 'pager')
  )
  from branch b
  join public.shops h on h.id = b.id
  left join public.shop_settings s on s.shop_id = b.id
  limit 1;
$$;
revoke all on function public.display_branding(uuid) from public;
grant execute on function public.display_branding(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
