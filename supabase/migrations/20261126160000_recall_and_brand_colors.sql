-- 1. Re-calls on the waiting screen. When staff call a ready number again
--    («نادي» on a called number, «بيبيلو مرة تانية»), the screen shows and says
--    it again. Kept apart from ready_at so preparation times stay true.
alter table public.orders add column recalled_at timestamptz;

create or replace function public.display_orders(ticket uuid)
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
    case when o.status='ready' then greatest(o.ready_at, o.recalled_at) end
  from branch b join public.orders o on o.shop_id=b.id
  where o.status in ('preparing','ready') and coalesce(o.restored_at,o.created_at)>now()-interval '24 hours'
  order by o.priority desc, coalesce(o.restored_at,o.created_at) limit 100;
$$;

create function public.recall_order(target uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  branch uuid;
  state text;
  last timestamptz;
begin
  select o.shop_id, o.status, o.recalled_at into branch, state, last from public.orders o where o.id = target;
  if actor is null or branch is null or not public.merchant_order_access(actor, branch) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  -- Only a number that is still «جاهز», and not twice within 10 seconds.
  if state <> 'ready' or (last is not null and last > now() - interval '10 seconds') then
    return false;
  end if;
  update public.orders set recalled_at = now() where id = target;
  return true;
end;
$$;
revoke all on function public.recall_order(uuid) from public, anon;
grant execute on function public.recall_order(uuid) to authenticated;

-- 2. Brand colours: besides the ready-made sets, a shop can pick its own
--    colour; the dashboard derives a readable palette from it and saves it.
drop function public.set_screen_style(text, text);
drop function merchant_workspace_private.set_screen_style(text, text);

create function merchant_workspace_private.set_screen_style(digits text, theme text, palette jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  branch uuid := merchant_workspace_private.active_shop();
  style jsonb;
  key text;
begin
  if auth.uid() is null or branch is null then
    raise exception 'Branch access required' using errcode = '42501';
  end if;
  if not merchant_workspace_private.can_edit_settings(branch) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if digits is null or digits not in ('dots', 'bold')
     or theme is null or theme not in ('dark', 'green', 'blue', 'burgundy', 'coffee', 'light', 'custom') then
    raise exception 'Unknown screen style' using errcode = '22023';
  end if;
  style := jsonb_build_object('digits', digits, 'theme', theme);
  if theme = 'custom' then
    if palette is null or jsonb_typeof(palette) <> 'object' then
      raise exception 'Palette required' using errcode = '22023';
    end if;
    foreach key in array array['color','bg','panel','latest','fresh','tile','accent','digit','tileDigit','text','muted'] loop
      if coalesce(palette->>key, '') !~ '^#[0-9a-f]{6}$' then
        raise exception 'Bad palette colour %', key using errcode = '22023';
      end if;
    end loop;
    style := style || jsonb_build_object('palette', (
      select jsonb_object_agg(k, palette->>k)
      from unnest(array['color','bg','panel','latest','fresh','tile','accent','digit','tileDigit','text','muted']) k));
  end if;
  insert into public.shop_settings(shop_id, name, display_style)
  select s.id, s.name, style from public.shops s where s.id = branch
  on conflict (shop_id) do update set display_style = excluded.display_style;
  return style;
end;
$$;
revoke all on function merchant_workspace_private.set_screen_style(text, text, jsonb) from public, anon;
grant execute on function merchant_workspace_private.set_screen_style(text, text, jsonb) to authenticated;

create function public.set_screen_style(digits text, theme text, palette jsonb default null) returns jsonb
language sql set search_path = '' as $$
  select merchant_workspace_private.set_screen_style(digits, theme, palette);
$$;
revoke all on function public.set_screen_style(text, text, jsonb) from public, anon;
grant execute on function public.set_screen_style(text, text, jsonb) to authenticated;

create or replace function public.display_branding(ticket uuid) returns jsonb
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
    'alert_tone', coalesce(s.alert_tone, 'pager'),
    'language', coalesce(s.display_language, 'ar'),
    'digits', coalesce(s.display_style->>'digits', 'dots'),
    'theme', coalesce(s.display_style->>'theme', 'dark'),
    'palette', s.display_style->'palette'
  )
  from branch b
  join public.shops h on h.id = b.id
  left join public.shop_settings s on s.shop_id = b.id
  limit 1;
$$;

notify pgrst, 'reload schema';
