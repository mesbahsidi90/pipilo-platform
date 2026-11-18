-- Digital menu (all plans): sections and items per branch, read publicly
-- through functions only when the branch turns the menu on.

alter table public.shop_settings
  add column menu_enabled boolean not null default false,
  add column menu_currency text not null default 'DZD'
    check (menu_currency in ('DZD', 'EUR', 'USD', 'MAD', 'TND'));

create table public.menu_sections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  name_fr text not null default '' check (char_length(name_fr) <= 60),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, shop_id)
);
create index menu_sections_shop on public.menu_sections(shop_id, position);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  section_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  name_fr text not null default '' check (char_length(name_fr) <= 80),
  description text not null default '' check (char_length(description) <= 200),
  price numeric(10, 2) check (price is null or price between 0 and 99999999),
  available boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- An item always belongs to a section of the same branch.
  foreign key (section_id, shop_id) references public.menu_sections(id, shop_id) on delete cascade
);
create index menu_items_section on public.menu_items(section_id, position);
create index menu_items_shop on public.menu_items(shop_id);

-- Keep menus a sensible size: 40 sections and 400 items per branch.
create function private.menu_size_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'menu_sections'
    and (select count(*) from public.menu_sections where shop_id = new.shop_id) >= 40 then
    raise exception 'BIPILO_MENU_LIMIT' using errcode = 'P0001';
  end if;
  if tg_table_name = 'menu_items'
    and (select count(*) from public.menu_items where shop_id = new.shop_id) >= 400 then
    raise exception 'BIPILO_MENU_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.menu_size_limit() from public, anon, authenticated;
create trigger menu_sections_limit before insert on public.menu_sections
for each row execute function private.menu_size_limit();
create trigger menu_items_limit before insert on public.menu_items
for each row execute function private.menu_size_limit();

alter table public.menu_sections enable row level security;
alter table public.menu_items enable row level security;
revoke all on public.menu_sections, public.menu_items from anon, authenticated;
grant select, insert, update, delete on public.menu_sections, public.menu_items to authenticated;
create policy menu_sections_branch on public.menu_sections for all to authenticated
  using (shop_id = (select public.current_shop_id()))
  with check (shop_id = (select public.current_shop_id()));
create policy menu_items_branch on public.menu_items for all to authenticated
  using (shop_id = (select public.current_shop_id()))
  with check (shop_id = (select public.current_shop_id()));

-- The public menu of a branch, or null when the menu is off.
create function private.menu_payload(branch uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', coalesce(nullif(st.name, ''), h.name),
    'currency', st.menu_currency,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ms.id, 'name', ms.name, 'name_fr', ms.name_fr,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', mi.id, 'name', mi.name, 'name_fr', mi.name_fr,
            'description', mi.description, 'price', mi.price, 'available', mi.available
          ) order by mi.position, mi.created_at)
          from public.menu_items mi where mi.section_id = ms.id
        ), '[]'::jsonb)
      ) order by ms.position, ms.created_at)
      from public.menu_sections ms where ms.shop_id = h.id
    ), '[]'::jsonb)
  )
  from public.shops h
  join public.shop_settings st on st.shop_id = h.id
  where h.id = branch and h.status = 'active' and st.menu_enabled;
$$;
revoke all on function private.menu_payload(uuid) from public, anon, authenticated;

create function public.branch_menu(branch uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.menu_payload(branch);
$$;
revoke all on function public.branch_menu(uuid) from public;
grant execute on function public.branch_menu(uuid) to anon, authenticated;

-- The menu of the branch that issued this ticket (for the order page).
create function public.ticket_menu(ticket uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.menu_payload(o.shop_id) || jsonb_build_object('branch', o.shop_id)
  from public.orders o
  where o.token = ticket and coalesce(o.restored_at, o.created_at) > now() - interval '24 hours';
$$;
revoke all on function public.ticket_menu(uuid) from public;
grant execute on function public.ticket_menu(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
