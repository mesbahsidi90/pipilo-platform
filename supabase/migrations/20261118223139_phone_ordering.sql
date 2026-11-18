-- Ordering from the phone (Pro): pickup, car or table, from the menu or a
-- typed note. Orders wait for staff to accept them before they can be ready.

alter table public.shop_settings
  add column ordering_enabled boolean not null default false,
  add column ordering_modes text[] not null default array['pickup']::text[]
    check (ordering_modes <@ array['pickup', 'car', 'table']::text[]
      and cardinality(ordering_modes) between 1 and 3);

alter table public.orders
  add column order_mode text check (order_mode in ('pickup', 'car', 'table')),
  add column order_details jsonb,
  add column online_request_key uuid,
  add column accepted_at timestamptz;
create unique index orders_online_request_key on public.orders(shop_id, online_request_key)
  where online_request_key is not null;
grant select (order_mode, order_details, accepted_at) on public.orders to authenticated;

-- An online order cannot be marked ready before staff accept it.
create function private.online_accept_first() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'ready' and old.order_mode is not null and old.accepted_at is null then
    raise exception 'BIPILO_ACCEPT_FIRST' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.online_accept_first() from public, anon, authenticated;
create trigger online_accept_first before update of status on public.orders
for each row execute function private.online_accept_first();

-- Customer: place an order from the menu page. Prices come from the database.
create function public.place_order(branch uuid, mode text, lines jsonb, details jsonb, request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  st record;
  existing uuid;
  line jsonb;
  item record;
  qty integer;
  picked jsonb := '[]'::jsonb;
  total numeric := 0;
  note text := left(btrim(coalesce(details->>'note', '')), 200);
  who text := left(btrim(coalesce(details->>'name', '')), 40);
  place text := left(btrim(coalesce(details->>'table', '')), 10);
  plate text := left(btrim(coalesce(details->>'plate', '')), 20);
  colour text := left(btrim(coalesce(details->>'color', '')), 20);
  day_start timestamptz := date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
  next_number integer;
  tries integer := 0;
  created record;
begin
  if request_key is null or mode is null or mode not in ('pickup', 'car', 'table') then
    return jsonb_build_object('error', 'invalid');
  end if;
  select s.ordering_enabled, s.ordering_modes, s.menu_enabled into st
  from public.shop_settings s join public.shops h on h.id = s.shop_id
  where s.shop_id = branch and h.status = 'active' and h.kind <> 'clinic';
  if not found or not st.ordering_enabled or not st.menu_enabled or not (mode = any(st.ordering_modes))
    or not private.branch_has_paid_plan(branch) then
    return jsonb_build_object('error', 'closed');
  end if;
  -- One order at a time per branch (numbers, retries and the rate limit).
  perform 1 from public.shops where id = branch for no key update;
  select token into existing from public.orders where shop_id = branch and online_request_key = request_key;
  if found then return jsonb_build_object('token', existing); end if;
  if exists (
    select 1 from public.orders where shop_id = branch and online_request_key is not null
      and created_at > now() - interval '1 minute' offset 19 limit 1
  ) then return jsonb_build_object('error', 'rate_limit'); end if;

  if jsonb_typeof(coalesce(lines, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(lines, '[]'::jsonb)) > 30 then
    return jsonb_build_object('error', 'invalid');
  end if;
  for line in select value from jsonb_array_elements(coalesce(lines, '[]'::jsonb)) loop
    if coalesce(line->>'id', '') !~ '^[0-9a-f-]{36}$' or coalesce(line->>'qty', '') !~ '^[0-9]{1,2}$' then
      return jsonb_build_object('error', 'invalid');
    end if;
    qty := (line->>'qty')::integer;
    if qty < 1 or qty > 20 then return jsonb_build_object('error', 'invalid'); end if;
    select mi.name, mi.price, mi.available into item
    from public.menu_items mi where mi.id = (line->>'id')::uuid and mi.shop_id = branch;
    if not found then return jsonb_build_object('error', 'invalid'); end if;
    if not item.available then return jsonb_build_object('error', 'sold_out', 'item', item.name); end if;
    picked := picked || jsonb_build_object('name', item.name, 'qty', qty, 'price', item.price);
    total := total + coalesce(item.price, 0) * qty;
  end loop;
  if jsonb_array_length(picked) = 0 and note = '' then return jsonb_build_object('error', 'empty'); end if;
  if mode = 'table' and place = '' then return jsonb_build_object('error', 'table'); end if;
  if mode = 'car' and plate = '' then return jsonb_build_object('error', 'plate'); end if;

  -- Next free number of the day (1–9999).
  select coalesce(max(o.number::integer), 0) + 1 into next_number
  from public.orders o
  where o.shop_id = branch and o.number ~ '^[0-9]{1,4}$' and o.created_at >= day_start;
  loop
    if next_number > 9999 then next_number := 1; end if;
    exit when not exists (
      select 1 from public.orders o
      where o.shop_id = branch and o.number = next_number::text and o.status in ('preparing', 'ready')
    );
    next_number := next_number + 1;
    tries := tries + 1;
    if tries > 9999 then return jsonb_build_object('error', 'busy'); end if;
  end loop;

  insert into public.orders(shop_id, number, guest_name, order_mode, order_details, online_request_key)
  values (
    branch, next_number::text, nullif(who, ''), mode,
    jsonb_build_object(
      'items', picked, 'total', total, 'note', note,
      'table', nullif(place, ''), 'plate', nullif(plate, ''), 'color', nullif(colour, '')
    ),
    request_key
  )
  returning id, token, number into created;
  -- Online orders never wait for the counter QR scan.
  update public.orders set counter_pending = false where id = created.id and counter_pending;
  return jsonb_build_object('token', created.token, 'number', created.number);
end;
$$;
revoke all on function public.place_order(uuid, text, jsonb, jsonb, uuid) from public;
grant execute on function public.place_order(uuid, text, jsonb, jsonb, uuid) to anon, authenticated;

-- Staff: «قبول» an online order of their branch.
create function public.accept_online_order(target uuid) returns boolean
language sql security definer set search_path = '' as $$
  with accepted as (
    update public.orders set accepted_at = clock_timestamp()
    where id = target and shop_id = (select public.current_shop_id())
      and order_mode is not null and accepted_at is null and status = 'preparing'
    returning 1
  )
  select exists (select 1 from accepted);
$$;
revoke all on function public.accept_online_order(uuid) from public, anon;
grant execute on function public.accept_online_order(uuid) to authenticated;

-- The menu payload now says whether the branch takes orders, and how.
create or replace function private.menu_payload(branch uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'name', coalesce(nullif(st.name, ''), h.name),
    'currency', st.menu_currency,
    'ordering', case when st.ordering_enabled and private.branch_has_paid_plan(h.id)
      then jsonb_build_object('modes', to_jsonb(st.ordering_modes)) end,
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

-- The customer's own order page also shows what they ordered and whether
-- the shop accepted it.
create or replace function public.guest_order_extras(ticket uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'coming_at', g.coming_at,
    'google_review_url', case when o.status = 'collected' then coalesce(s.google_review_url, '') else '' end,
    'private_feedback_enabled', o.status = 'collected' and coalesce(s.private_feedback_enabled, false)
      and private.branch_has_paid_plan(o.shop_id),
    'feedback_sent', exists(select 1 from private.order_feedback f where f.order_id = o.id),
    'rating', (select r.stars from private.order_ratings r where r.order_id = o.id),
    'online', case when o.order_mode is not null then jsonb_build_object(
      'mode', o.order_mode, 'accepted', o.accepted_at is not null, 'details', o.order_details,
      'currency', s.menu_currency) end
  )
  from public.orders o
  left join public.order_guest_signals g on g.order_id = o.id
  left join public.shop_settings s on s.shop_id = o.shop_id
  where o.token = ticket and coalesce(o.restored_at, o.created_at) > now() - interval '24 hours'
  limit 1;
$$;

notify pgrst, 'reload schema';
