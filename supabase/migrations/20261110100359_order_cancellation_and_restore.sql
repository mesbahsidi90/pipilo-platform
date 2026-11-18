-- Apply after waiting_screen_links.sql, shop_activities.sql, guest_experience.sql and merchant_alert_settings.sql.
begin;
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('preparing', 'ready', 'collected', 'cancelled'));
alter table public.orders add column restored_at timestamptz;

drop index public.orders_active_number;
create unique index orders_active_number on public.orders(shop_id, number)
  where status in ('preparing', 'ready');

create or replace function public.enforce_order_transition()
returns trigger language plpgsql set search_path='' as $$
begin
  if not ((old.status='preparing' and new.status in ('ready','cancelled'))
       or (old.status='ready' and new.status='collected')
       or (old.status='cancelled' and new.status='preparing')) then
    raise exception 'Invalid order transition';
  end if;
  if new.status='preparing' then new.restored_at=clock_timestamp(); end if;
  if new.status='ready' then new.ready_at=clock_timestamp(); new.collected_at=null; end if;
  if new.status='collected' then new.collected_at=clock_timestamp(); end if;
  return new;
end;
$$;

create or replace function public.track_order(ticket uuid)
returns table(number text,status text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
 select o.number,o.status,o.created_at from public.orders o
 where o.token=ticket and coalesce(o.restored_at,o.created_at)>now()-interval '24 hours' limit 1;
$$;

create or replace function public.display_orders(ticket uuid)
returns table(number text,status text)
language sql stable security definer set search_path = '' as $$
  with branch as (
    select d.shop_id as id from merchant_workspace_private.display_links d where d.token=ticket
    union
    select s.id from public.shops s where s.display_token=ticket
      and not exists(select 1 from merchant_workspace_private.display_links d where d.shop_id=s.id)
  )
  select o.number,o.status from branch b join public.orders o on o.shop_id=b.id
  where o.status in ('preparing','ready') and coalesce(o.restored_at,o.created_at)>now()-interval '24 hours'
  order by coalesce(o.restored_at,o.created_at) limit 100;
$$;

create or replace function counter_qr_private.lookup(branch uuid, code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when code is null then jsonb_build_object('name', coalesce(s.name, h.name))
    else (
      select jsonb_build_object('token', o.token)
      from public.orders o
      where o.shop_id = h.id
        and o.tracking_code = code
        and coalesce(o.restored_at,o.created_at)>now() - interval '24 hours'
    )
  end
  from public.shops h
  left join public.shop_settings s on s.shop_id = h.id
  where h.id = branch
    and coalesce(s.tracking_mode, case when h.kind in ('cafe','restaurant','food_court') then 'order' else 'counter' end) = 'counter'
    and h.status = 'active'
    and (code is null or code ~ '^[0-9A-F]{12}$');
$$;

create or replace function public.guest_order_signal(ticket uuid,event_name text) returns boolean
 language plpgsql security definer set search_path='' as $$
declare o record; t timestamptz:=clock_timestamp();
begin
 if ticket is null or event_name not in ('opened','heartbeat','sound_enabled','push_enabled','ready_seen','coming') then return false; end if;
 select id,shop_id,status into o from public.orders where token=ticket and coalesce(restored_at,created_at)>now()-interval '24 hours';
 if not found or o.status not in ('preparing','ready') then return false; end if;
 if event_name in ('ready_seen','coming') and o.status<>'ready' then return false; end if;
 if event_name='push_enabled' and not exists(select 1 from public.push_subscriptions where order_id=o.id) then return false; end if;
 insert into public.order_guest_signals as s(order_id,shop_id,opened_at,last_seen_at,sound_enabled_at,push_enabled_at,ready_seen_at,coming_at)
 values(o.id,o.shop_id,t,t,case when event_name='sound_enabled' then t end,case when event_name='push_enabled' then t end,case when event_name='ready_seen' then t end,case when event_name='coming' then t end)
 on conflict(order_id) do update set
 last_seen_at=case when s.last_seen_at<t-interval '30 seconds' then t else s.last_seen_at end,
 sound_enabled_at=coalesce(s.sound_enabled_at,excluded.sound_enabled_at),
 push_enabled_at=coalesce(s.push_enabled_at,excluded.push_enabled_at),
 ready_seen_at=coalesce(s.ready_seen_at,excluded.ready_seen_at),
 coming_at=coalesce(s.coming_at,excluded.coming_at)
 where s.last_seen_at<t-interval '30 seconds'
 or (s.sound_enabled_at is null and excluded.sound_enabled_at is not null)
 or (s.push_enabled_at is null and excluded.push_enabled_at is not null)
 or (s.ready_seen_at is null and excluded.ready_seen_at is not null)
 or (s.coming_at is null and excluded.coming_at is not null);
 return true;
end; $$;

create or replace function public.guest_order_extras(ticket uuid) returns jsonb
 language sql stable security definer set search_path='' as $$
 select jsonb_build_object('coming_at',g.coming_at,'google_review_url',case when o.status='collected' then coalesce(s.google_review_url,'') else '' end)
 from public.orders o left join public.order_guest_signals g on g.order_id=o.id
 left join public.shop_settings s on s.shop_id=o.shop_id
 where o.token=ticket and coalesce(o.restored_at,o.created_at)>now()-interval '24 hours' limit 1;
$$;

create or replace function customer_design_private.lookup(ticket uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'customer_theme', s.customer_theme,
    'banner_text', s.banner_text,
    'banner_image', s.banner_image,
    'customer_options', s.customer_options,
    'customer_background_image', s.customer_background_image,
    'alert_tone', s.alert_tone
  )
  from public.orders o
  join public.shop_settings s on s.shop_id = o.shop_id
  where o.token = ticket and coalesce(o.restored_at,o.created_at)>now() - interval '24 hours';
$$;

create or replace function public.ticket_branding(ticket uuid) returns table(name text,city text,address text,pickup_message text,logo text)
language sql stable security definer set search_path='' as $$
 select coalesce(s.name,h.name),coalesce(s.city,h.city,''),coalesce(s.address,''),coalesce(s.pickup_message,'تقدر تجي تديه من الكونتوار.'),coalesce(s.logo,'')
 from public.orders o join public.shops h on h.id=o.shop_id left join public.shop_settings s on s.shop_id=h.id
 where o.token=ticket and coalesce(o.restored_at,o.created_at)>now()-interval '24 hours' limit 1;
$$;

commit;
