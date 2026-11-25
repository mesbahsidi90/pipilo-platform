-- The waiting / call screen's language, chosen in «الفروع والأكواد» so the TV
-- follows it without editing the address. Saved like the other shop settings.
alter table public.shop_settings
  add column display_language text not null default 'ar' check (display_language in ('ar', 'fr'));

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
    'language', coalesce(s.display_language, 'ar')
  )
  from branch b
  join public.shops h on h.id = b.id
  left join public.shop_settings s on s.shop_id = b.id
  limit 1;
$$;

-- Managers set it from the dashboard; a branch without a settings row gets one.
create function merchant_workspace_private.set_screen_language(lang text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  branch uuid := merchant_workspace_private.active_shop();
begin
  if auth.uid() is null or branch is null then
    raise exception 'Branch access required' using errcode = '42501';
  end if;
  if not merchant_workspace_private.can_edit_settings(branch) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if lang is null or lang not in ('ar', 'fr') then
    raise exception 'Unknown language' using errcode = '22023';
  end if;
  insert into public.shop_settings(shop_id, name, display_language)
  select s.id, s.name, lang from public.shops s where s.id = branch
  on conflict (shop_id) do update set display_language = excluded.display_language;
  return lang;
end;
$$;
revoke all on function merchant_workspace_private.set_screen_language(text) from public, anon;
grant execute on function merchant_workspace_private.set_screen_language(text) to authenticated;

create function public.set_screen_language(lang text) returns text
language sql set search_path = '' as $$
  select merchant_workspace_private.set_screen_language(lang);
$$;
revoke all on function public.set_screen_language(text) from public, anon;
grant execute on function public.set_screen_language(text) to authenticated;

notify pgrst, 'reload schema';
