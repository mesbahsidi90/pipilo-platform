-- Clinics: reception adds a patient with name and phone, a called patient
-- who didn't come can be marked «ما جاش» (and put back in line later), and
-- the patient's page shows how many are ahead and an estimated wait.

alter table public.orders add column guest_phone text
  check (guest_phone is null or guest_phone ~ '^\+?[0-9]{6,15}$');
grant select (guest_phone) on public.orders to authenticated;

create function private.is_clinic(branch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.shops where id = branch and kind = 'clinic');
$$;
revoke all on function private.is_clinic(uuid) from public, anon, authenticated;

-- Same rules as before, plus: in a clinic a called patient can be marked absent.
create or replace function public.enforce_order_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not ((old.status='preparing' and new.status in ('ready','cancelled'))
       or (old.status='ready' and new.status='collected')
       or (old.status='ready' and new.status='cancelled' and private.is_clinic(new.shop_id))
       or (old.status='cancelled' and new.status='preparing')) then
    raise exception 'Invalid order transition';
  end if;
  if new.status='preparing' then new.restored_at=clock_timestamp(); end if;
  if new.status='ready' then new.ready_at=clock_timestamp(); new.collected_at=null; end if;
  if new.status='collected' then new.collected_at=clock_timestamp(); end if;
  return new;
end;
$$;

-- Reception: add a patient to the queue with an optional name and phone.
create function public.clinic_add_patient(guest text default null, phone text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ticket jsonb;
  who text := nullif(left(regexp_replace(btrim(coalesce(guest, '')), '\s+', ' ', 'g'), 40), '');
  digits text := nullif(regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if digits is not null and digits !~ '^\+?[0-9]{6,15}$' then
    return jsonb_build_object('error', 'phone');
  end if;
  ticket := clinic_queue_private.run('add', null, null);
  if ticket is null then return null; end if;
  update public.orders set guest_name = who, guest_phone = digits
  where id = (ticket->>'id')::uuid;
  return ticket || jsonb_build_object('guest_name', who, 'guest_phone', digits);
end;
$$;
revoke all on function public.clinic_add_patient(text, text) from public, anon;
grant execute on function public.clinic_add_patient(text, text) to authenticated;

-- The patient's page: people ahead and an estimate from today's call pace.
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
    'queue', case when o.status = 'preparing' and h.kind = 'clinic' then (
      select jsonb_build_object(
        'ahead', (select count(*) from public.orders x
          where x.shop_id = o.shop_id and x.status = 'preparing'
            and coalesce(x.restored_at, x.created_at) > now() - interval '24 hours'
            and (coalesce(x.restored_at, x.created_at), x.id) < (coalesce(o.restored_at, o.created_at), o.id)),
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

notify pgrst, 'reload schema';
