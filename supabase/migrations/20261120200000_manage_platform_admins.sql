-- Platform admins can add and remove other admins from /admin.
-- Guards: the account must already exist, an admin cannot remove themself,
-- and the platform never ends up with zero admins. Every change is audited.

alter table public.platform_admins
  add column added_by uuid references auth.users(id) on delete set null;

-- Email, or a phone typed as 0551…, 551…, +213 551… or 213551….
create function private.find_account(contact text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  value text := lower(btrim(coalesce(contact, '')));
  digits text := regexp_replace(value, '[^0-9]', '', 'g');
  found_id uuid;
begin
  if value = '' then return null; end if;
  if value ~ '^\+?[0-9 ().-]{6,24}$' then
    if digits ~ '^0[5-7][0-9]{8}$' then digits := '213' || substr(digits, 2);
    elsif digits ~ '^[5-7][0-9]{8}$' then digits := '213' || digits;
    end if;
    select id into found_id from auth.users where phone = digits limit 1;
  else
    select id into found_id from auth.users where lower(email) = value limit 1;
  end if;
  return found_id;
end;
$$;
revoke all on function private.find_account(text) from public, anon, authenticated;

create function public.admin_list_admins() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', a.user_id, 'email', u.email, 'phone', u.phone,
      'added_at', a.created_at, 'last_sign_in_at', u.last_sign_in_at,
      'added_by', coalesce(b.email, b.phone), 'self', a.user_id = auth.uid()
    ) order by a.created_at)
    from public.platform_admins a
    left join auth.users u on u.id = a.user_id
    left join auth.users b on b.id = a.added_by
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_list_admins() from public, anon;
grant execute on function public.admin_list_admins() to authenticated;

-- Returns 'added', 'already' or 'not_found'.
create function public.admin_add_admin(contact text) returns text
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  target := private.find_account(contact);
  if target is null then return 'not_found'; end if;
  insert into public.platform_admins(user_id, added_by) values (target, auth.uid())
  on conflict (user_id) do nothing;
  if not found then return 'already'; end if;
  insert into public.admin_audit(actor_id, entity, entity_id, action)
  values (auth.uid(), 'platform_admins', target::text, 'INSERT');
  return 'added';
end;
$$;
revoke all on function public.admin_add_admin(text) from public, anon;
grant execute on function public.admin_add_admin(text) to authenticated;

-- Returns 'removed', 'self', 'last' or 'not_admin'.
create function public.admin_remove_admin(target uuid) returns text
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  if target = auth.uid() then return 'self'; end if;
  -- Two admins removing each other at once must not leave the platform without one.
  lock table public.platform_admins in share row exclusive mode;
  if not exists (select 1 from public.platform_admins where user_id = target) then
    return 'not_admin';
  end if;
  if (select count(*) from public.platform_admins) <= 1 then return 'last'; end if;
  delete from public.platform_admins where user_id = target;
  insert into public.admin_audit(actor_id, entity, entity_id, action)
  values (auth.uid(), 'platform_admins', target::text, 'DELETE');
  return 'removed';
end;
$$;
revoke all on function public.admin_remove_admin(uuid) from public, anon;
grant execute on function public.admin_remove_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
