-- Short screen addresses: bipilo.app/tv/k7m2x9 instead of a 36-character
-- token, so the call screen can be typed on a TV remote. One code per branch,
-- 6 characters from an alphabet without look-alikes (no 0/o, 1/l/i).

create table merchant_workspace_private.display_codes (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  code text not null unique check (code ~ '^[a-hjkmnp-z2-9]{6}$'),
  created_at timestamptz not null default now()
);
alter table merchant_workspace_private.display_codes enable row level security;
revoke all on merchant_workspace_private.display_codes from public, anon, authenticated;

-- 6 characters from 31 (about 887 million codes), from cryptographic random bytes.
create function merchant_workspace_private.new_display_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', get_byte(b, i) % 31 + 1, 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) as b) r, generate_series(0, 5) as i;
$$;

-- The active branch's code, created on first use; `rotate` gives a new one
-- (managers only), and the old address stops working.
create function merchant_workspace_private.waiting_screen_code(rotate boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  branch uuid := merchant_workspace_private.active_shop();
  result text;
begin
  if auth.uid() is null or branch is null then
    raise exception 'Branch access required' using errcode = '42501';
  end if;
  if rotate and not merchant_workspace_private.can_edit_settings(branch) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;
  if not rotate then
    select code into result from merchant_workspace_private.display_codes where shop_id = branch;
    if result is not null then return result; end if;
  end if;
  for attempt in 1..8 loop
    begin
      insert into merchant_workspace_private.display_codes(shop_id, code)
      values (branch, merchant_workspace_private.new_display_code())
      on conflict (shop_id) do update set code = excluded.code, created_at = now()
      returning code into result;
      return result;
    exception when unique_violation then
      -- Another branch already has this code: draw again.
    end;
  end loop;
  raise exception 'Could not create a screen code';
end;
$$;
revoke all on function merchant_workspace_private.waiting_screen_code(boolean) from public;

create function public.waiting_screen_code(rotate boolean default false) returns text
language sql set search_path = '' as $$
  select merchant_workspace_private.waiting_screen_code(rotate);
$$;
revoke all on function public.waiting_screen_code(boolean) from public;
grant execute on function public.waiting_screen_code(boolean) to authenticated;

-- The TV page: short code → the branch's current screen token (null if unknown).
create function public.display_code_token(code text) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(d.token, s.display_token)
  from merchant_workspace_private.display_codes c
  join public.shops s on s.id = c.shop_id
  left join merchant_workspace_private.display_links d on d.shop_id = s.id
  where c.code = lower(btrim(display_code_token.code)) and s.status = 'active';
$$;
revoke all on function public.display_code_token(text) from public;
grant execute on function public.display_code_token(text) to anon, authenticated;

notify pgrst, 'reload schema';
