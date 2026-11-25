-- The waiting / call screen's look, chosen in «الفروع والأكواد»: the number
-- style (dots or plain bold digits) and one of the ready-made colour sets.
alter table public.shop_settings
  add column display_style jsonb not null default '{}'::jsonb;

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
    'theme', coalesce(s.display_style->>'theme', 'dark')
  )
  from branch b
  join public.shops h on h.id = b.id
  left join public.shop_settings s on s.shop_id = b.id
  limit 1;
$$;

create function merchant_workspace_private.set_screen_style(digits text, theme text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  branch uuid := merchant_workspace_private.active_shop();
  style jsonb;
begin
  if auth.uid() is null or branch is null then
    raise exception 'Branch access required' using errcode = '42501';
  end if;
  if not merchant_workspace_private.can_edit_settings(branch) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if digits is null or digits not in ('dots', 'bold')
     or theme is null or theme not in ('dark', 'green', 'blue', 'burgundy', 'coffee', 'light') then
    raise exception 'Unknown screen style' using errcode = '22023';
  end if;
  style := jsonb_build_object('digits', digits, 'theme', theme);
  insert into public.shop_settings(shop_id, name, display_style)
  select s.id, s.name, style from public.shops s where s.id = branch
  on conflict (shop_id) do update set display_style = excluded.display_style;
  return style;
end;
$$;
revoke all on function merchant_workspace_private.set_screen_style(text, text) from public, anon;
grant execute on function merchant_workspace_private.set_screen_style(text, text) to authenticated;

create function public.set_screen_style(digits text, theme text) returns jsonb
language sql set search_path = '' as $$
  select merchant_workspace_private.set_screen_style(digits, theme);
$$;
revoke all on function public.set_screen_style(text, text) from public, anon;
grant execute on function public.set_screen_style(text, text) to authenticated;

notify pgrst, 'reload schema';
