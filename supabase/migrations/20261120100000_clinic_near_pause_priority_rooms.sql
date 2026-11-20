-- Clinics, batch 2:
--   «قرب دورك»: a push to a waiting patient when two or fewer are ahead;
--   «وقّف الأرقام»: the QR stops giving numbers for the rest of the day;
--   priority patients go to the front of the line;
--   rooms (or doctors): «نادِ التالي» per room, the patient sees where to go.

alter table public.orders
  add column priority boolean not null default false,
  add column room text check (room is null or char_length(room) between 1 and 30),
  add column near_alerted_at timestamptz;
-- The board reads orders with select *, so every new column must be readable.
grant select (priority, room, near_alerted_at) on public.orders to authenticated;

create function private.valid_rooms(rooms text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(rooms) <= 10
    and coalesce((select bool_and(char_length(btrim(r)) between 1 and 30 and r = btrim(r))
                  from unnest(rooms) r), true)
    and cardinality(rooms) = (select count(distinct r) from unnest(rooms) r);
$$;

alter table public.shop_settings
  add column queue_paused_on date,
  add column clinic_rooms text[] not null default '{}' check (private.valid_rooms(clinic_rooms));
grant select (queue_paused_on, clinic_rooms) on public.shop_settings to authenticated;
grant insert (clinic_rooms), update (clinic_rooms) on public.shop_settings to authenticated;

create function private.algiers_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Africa/Algiers')::date;
$$;

-- Queue order everywhere: priority first, then time in line, then id.
drop function public.clinic_queue(text, uuid, uuid);
drop function clinic_queue_private.run(text, uuid, uuid);

create function clinic_queue_private.run(operation text, branch uuid, request_token uuid,
  call_room text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  venue text;
  paused boolean;
  rooms text[];
  result public.orders%rowtype;
  next_number integer;
  day_start timestamptz := date_trunc('day', now(), 'Africa/Algiers');
begin
  if operation in ('info','join') then
    target := branch;
  elsif operation in ('add','next') and auth.uid() is not null then
    target := public.current_shop_id();
  else
    raise exception 'Queue access denied' using errcode='42501';
  end if;

  select coalesce(s.name, h.name), coalesce(s.queue_paused_on = private.algiers_today(), false),
         coalesce(s.clinic_rooms, '{}')
    into venue, paused, rooms
  from public.shops h left join public.shop_settings s on s.shop_id=h.id
  where h.id=target and h.kind='clinic' and h.status='active';
  if not found then return null; end if;
  if operation='info' then return jsonb_build_object('name', venue, 'paused', paused); end if;

  perform pg_advisory_xact_lock(hashtextextended(target::text, 673));
  if operation='next' then
    if call_room is not null and not (call_room = any(rooms)) then
      raise exception 'Unknown room' using errcode='22023';
    end if;
    select * into result from public.orders
    where shop_id=target and status='preparing'
      and coalesce(restored_at,created_at)>now()-interval '24 hours'
    order by priority desc, coalesce(restored_at,created_at), id
    limit 1 for update skip locked;
    if not found then return null; end if;
    update public.orders set status='ready', room=call_room where id=result.id returning * into result;
  else
    if operation='join' then
      if request_token is null then raise exception 'Missing request token' using errcode='22023'; end if;
      select * into result from public.orders
      where clinic_request_key=request_token and shop_id=target and created_at>now()-interval '24 hours';
      if found then return jsonb_build_object('number',result.number,'token',result.token); end if;
      if paused then return jsonb_build_object('paused', true); end if;
      if (select count(*) from public.orders where shop_id=target and created_at>now()-interval '1 minute') >= 20
        or (select count(*) from public.orders where shop_id=target and created_at>=day_start) >= 500 then
        return null;
      end if;
    end if;
    if (select count(*) from public.orders where shop_id=target and status in ('preparing','ready') and coalesce(restored_at,created_at)>=day_start) >= 100 then
      return null;
    end if;
    select coalesce(max(number::integer),0) into next_number
    from public.orders where shop_id=target and created_at>=day_start;
    select n into next_number
    from generate_series(1,9999) n
    where not exists (
      select 1 from public.orders o where o.shop_id=target and o.number=n::text
      and (o.status in ('preparing','ready') or o.created_at>=day_start)
    )
    order by case when n>next_number then 0 else 1 end,n limit 1;
    if next_number is null then return null; end if;
    insert into public.orders(shop_id,number,clinic_request_key)
      values(target,next_number::text,case when operation='join' then request_token end)
      returning * into result;
  end if;
  if operation='join' then return jsonb_build_object('number',result.number,'token',result.token); end if;
  return jsonb_build_object('id',result.id,'number',result.number,'token',result.token,
    'status',result.status,'created_at',result.created_at,'tracking_code',result.tracking_code,
    'priority',result.priority,'room',result.room);
end;
$$;
revoke all on function clinic_queue_private.run(text, uuid, uuid, text) from public;
grant execute on function clinic_queue_private.run(text, uuid, uuid, text) to anon, authenticated;

create function public.clinic_queue(operation text, branch uuid default null,
  request_token uuid default null, room text default null)
returns jsonb language sql set search_path = '' as $$
  select clinic_queue_private.run(operation, branch, request_token, room);
$$;
revoke all on function public.clinic_queue(text, uuid, uuid, text) from public;
grant execute on function public.clinic_queue(text, uuid, uuid, text) to anon, authenticated;

-- «قرب دورك»: push once to each waiting patient who now has two or fewer ahead.
create function private.clinic_near_alerts(branch uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare secret text; patient uuid;
begin
  select webhook_secret into secret from private.bippo_push_config where id=true;
  for patient in
    with line as (
      select o.id, o.near_alerted_at,
        row_number() over (order by o.priority desc, coalesce(o.restored_at,o.created_at), o.id) - 1 as ahead
      from public.orders o
      where o.shop_id=branch and o.status='preparing'
        and coalesce(o.restored_at,o.created_at)>now()-interval '24 hours'
    )
    select l.id from line l
    where l.ahead <= 2 and l.near_alerted_at is null
      and exists(select 1 from public.push_subscriptions p where p.order_id=l.id)
  loop
    update public.orders set near_alerted_at=clock_timestamp() where id=patient;
    if secret is not null then
      perform net.http_post(
        url:='https://kdvtqlqiervznhzbpjcx.supabase.co/functions/v1/order-alerts/near',
        headers:=jsonb_build_object('Content-Type','application/json','x-bippo-webhook',secret),
        body:=jsonb_build_object('order_id',patient),
        timeout_milliseconds:=10000);
    end if;
  end loop;
end;
$$;
revoke all on function private.clinic_near_alerts(uuid) from public, anon, authenticated;

create function private.clinic_call_moves_line() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status='preparing' and new.status<>'preparing' and private.is_clinic(new.shop_id) then
    perform private.clinic_near_alerts(new.shop_id);
  end if;
  return null;
end;
$$;
revoke all on function private.clinic_call_moves_line() from public, anon, authenticated;
create trigger clinic_near_alert after update of status on public.orders
  for each row execute function private.clinic_call_moves_line();

-- Reception: mark a waiting patient as priority (pregnant, elderly, urgent) or not.
create function public.clinic_set_priority(ticket uuid, urgent boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare branch uuid := public.current_shop_id();
begin
  if auth.uid() is null or branch is null or not private.is_clinic(branch) then
    raise exception 'Queue access denied' using errcode='42501';
  end if;
  update public.orders set priority=coalesce(urgent,false)
  where id=ticket and shop_id=branch and status='preparing';
  if not found then return false; end if;
  perform private.clinic_near_alerts(branch);
  return true;
end;
$$;
revoke all on function public.clinic_set_priority(uuid, boolean) from public, anon;
grant execute on function public.clinic_set_priority(uuid, boolean) to authenticated;

-- Reception: stop (or reopen) the QR numbers for today. Any team member can.
create function public.clinic_pause(paused boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare branch uuid := public.current_shop_id();
begin
  if auth.uid() is null or branch is null or not private.is_clinic(branch) then
    raise exception 'Queue access denied' using errcode='42501';
  end if;
  insert into public.shop_settings(shop_id, name, queue_paused_on)
    select h.id, h.name, case when paused then private.algiers_today() end
    from public.shops h where h.id = branch
  on conflict (shop_id) do update set queue_paused_on = excluded.queue_paused_on;
  return coalesce(paused, false);
end;
$$;
revoke all on function public.clinic_pause(boolean) from public, anon;
grant execute on function public.clinic_pause(boolean) to authenticated;

-- The patient's page: the line counts priority first, and a called patient sees the room.
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
      'currency', s.menu_currency) end,
    'room', case when o.status = 'ready' then o.room end,
    'queue', case when o.status = 'preparing' and h.kind = 'clinic' then (
      select jsonb_build_object(
        'ahead', (select count(*) from public.orders x
          where x.shop_id = o.shop_id and x.status = 'preparing'
            and coalesce(x.restored_at, x.created_at) > now() - interval '24 hours'
            and (not x.priority, coalesce(x.restored_at, x.created_at), x.id)
              < (not o.priority, coalesce(o.restored_at, o.created_at), o.id)),
        'priority', o.priority,
        'minutes_each', (
          select case when count(*) >= 3
            then round(extract(epoch from max(c.ready_at) - min(c.ready_at)) / 60 / (count(*) - 1))
          end
          from (select x.ready_at from public.orders x
            where x.shop_id = o.shop_id and x.ready_at > now() - interval '3 hours'
            order by x.ready_at desc limit 10) c)
      )) end
  )
  from public.orders o
  join public.shops h on h.id = o.shop_id
  left join public.order_guest_signals g on g.order_id = o.id
  left join public.shop_settings s on s.shop_id = o.shop_id
  where o.token = ticket and coalesce(o.restored_at, o.created_at) > now() - interval '24 hours'
  limit 1;
$$;

-- The waiting screen shows the room next to a called number.
drop function public.display_orders(uuid);
create function public.display_orders(ticket uuid)
returns table(number text, status text, room text)
language sql stable security definer set search_path = '' as $$
  with branch as (
    select d.shop_id as id from merchant_workspace_private.display_links d where d.token=ticket
    union
    select s.id from public.shops s where s.display_token=ticket
      and not exists(select 1 from merchant_workspace_private.display_links d where d.shop_id=s.id)
  )
  select o.number, o.status, case when o.status='ready' then o.room end
  from branch b join public.orders o on o.shop_id=b.id
  where o.status in ('preparing','ready') and coalesce(o.restored_at,o.created_at)>now()-interval '24 hours'
  order by o.priority desc, coalesce(o.restored_at,o.created_at) limit 100;
$$;
revoke all on function public.display_orders(uuid) from public;
grant execute on function public.display_orders(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
