-- Apply after order_cancellation.sql. Existing tickets keep their tracking links.
begin;

alter table public.orders add column counter_pending boolean;
alter table public.orders add column counter_claim_key uuid;

create unique index orders_counter_pending on public.orders(shop_id)
where counter_pending and status in ('preparing', 'ready');
create unique index orders_counter_claim_key on public.orders(shop_id, counter_claim_key)
where counter_claim_key is not null;

create function counter_qr_private.prepare_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select coalesce(settings.tracking_mode, case
      when shop.kind in ('cafe', 'restaurant', 'food_court') then 'order' else 'counter'
    end) = 'counter' and shop.kind <> 'clinic'
    into new.counter_pending
    from public.shops shop
    left join public.shop_settings settings on settings.shop_id = shop.id
    where shop.id = new.shop_id;
  elsif new.status = 'cancelled' and old.counter_pending then
    new.counter_pending := false;
  elsif old.counter_pending and new.status in ('ready', 'collected') then
    raise exception 'BIPILO_COUNTER_SCAN_REQUIRED';
  end if;
  return new;
end;
$$;
revoke all on function counter_qr_private.prepare_order() from public, anon, authenticated;
create trigger order_counter_scan before insert or update of status on public.orders
for each row execute function counter_qr_private.prepare_order();

create function counter_qr_private.claim(branch uuid, request_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  venue jsonb;
  tracking_token uuid;
begin
  venue := counter_qr_private.lookup(branch, null);
  if venue is null or not exists (
    select 1 from public.shops where id = branch and kind <> 'clinic'
  ) then return null; end if;

  -- Retries with the same key return only the ticket claimed by that request.
  perform pg_advisory_xact_lock(hashtextextended(branch::text, 731));
  select token into tracking_token from public.orders
    where shop_id = branch and counter_claim_key = request_key
      and created_at > now() - interval '24 hours';
  if not found and not exists (
    select 1 from public.orders where shop_id = branch and counter_claim_key = request_key
  ) then
    update public.orders
      set counter_pending = false, counter_claim_key = request_key
      where shop_id = branch and counter_pending and status in ('preparing', 'ready')
        and created_at > now() - interval '24 hours'
      returning token into tracking_token;
  end if;
  return venue || jsonb_build_object('token', tracking_token);
end;
$$;
revoke all on function counter_qr_private.claim(uuid, uuid) from public, anon, authenticated;

create function public.claim_counter_ticket(branch uuid, request_key uuid)
returns jsonb language sql volatile security definer set search_path = '' as $$
  select counter_qr_private.claim(branch, request_key)
  where request_key is not null;
$$;
revoke all on function public.claim_counter_ticket(uuid, uuid) from public;
grant execute on function public.claim_counter_ticket(uuid, uuid) to anon, authenticated;

commit;
