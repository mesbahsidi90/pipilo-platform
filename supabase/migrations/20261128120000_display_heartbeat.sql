-- Is the waiting screen connected? Each open screen (TV page or in-app) sends
-- a heartbeat about once a minute; «نداء سريع» shows when it was last seen.

create table merchant_workspace_private.display_seen (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table merchant_workspace_private.display_seen enable row level security;
revoke all on merchant_workspace_private.display_seen from public, anon, authenticated;

-- Called by the screen with its token (same lookup as display_orders).
-- Writes at most every 20 seconds per branch.
create function public.display_heartbeat(ticket uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare branch uuid;
begin
  select b.id into branch from (
    select d.shop_id as id from merchant_workspace_private.display_links d where d.token = ticket
    union
    select s.id from public.shops s where s.display_token = ticket
      and not exists (select 1 from merchant_workspace_private.display_links d where d.shop_id = s.id)
  ) b limit 1;
  if branch is null then return false; end if;
  insert into merchant_workspace_private.display_seen as seen (shop_id, seen_at) values (branch, now())
  on conflict (shop_id) do update set seen_at = now()
  where seen.seen_at < now() - interval '20 seconds';
  return true;
end;
$$;
revoke all on function public.display_heartbeat(uuid) from public;
grant execute on function public.display_heartbeat(uuid) to anon, authenticated;

-- For the staff of the current branch: when its screen was last seen.
create function public.waiting_screen_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'seen_at', (select s.seen_at from merchant_workspace_private.display_seen s
      where s.shop_id = public.current_shop_id()),
    'now', now())
  where auth.uid() is not null and public.current_shop_id() is not null;
$$;
revoke all on function public.waiting_screen_status() from public, anon;
grant execute on function public.waiting_screen_status() to authenticated;

notify pgrst, 'reload schema';
