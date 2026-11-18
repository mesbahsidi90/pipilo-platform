-- Apply after clinic_queue.sql and merchant_branches_team.sql.

alter table public.plans add column if not exists purchase_price numeric(12,2)
  check (purchase_price >= 0);
alter table public.plans
  add column if not exists standard_price numeric(12,2) check (standard_price > 0),
  add column if not exists launch_branches integer check (launch_branches between 0 and 100000),
  add column if not exists free_ticket_limit integer check (free_ticket_limit between 1 and 100000);

-- The audited admin UI remains the normal way to edit plans and grant access.
-- The migration itself runs without an application user.
alter table public.plans disable trigger audit_plans;
insert into public.plans (id, name, purchase_price, currency, standard_price, launch_branches, free_ticket_limit)
values ('d87033d1-e08b-4612-ad31-9ebd17b39538', 'احترافية · دفعة واحدة', 9900, 'DZD', 14900, 20, 100)
on conflict (id) do nothing;
update public.plans
set standard_price = coalesce(standard_price, 14900),
    launch_branches = coalesce(launch_branches, 20),
    free_ticket_limit = coalesce(free_ticket_limit, 100)
where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538'
  and (standard_price is null or launch_branches is null or free_ticket_limit is null);
alter table public.plans enable trigger audit_plans;

create or replace function public.bipilo_plan_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'purchase_price', purchase_price, 'standard_price', standard_price,
    'launch_branches', launch_branches, 'free_ticket_limit', free_ticket_limit,
    'active', active
  )
  from public.plans where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538';
$$;
revoke all on function public.bipilo_plan_catalog() from public;
grant execute on function public.bipilo_plan_catalog() to anon, authenticated;

create or replace function private.branch_has_paid_plan(branch uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.shop_id = branch and s.status in ('active', 'trial')
      and (s.period_end is null or s.period_end > now())
      and (p.purchase_price > 0 or p.monthly_price > 0)
  );
$$;
revoke all on function private.branch_has_paid_plan(uuid) from public, anon, authenticated;

create or replace function public.current_branch_has_paid_plan()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.branch_has_paid_plan(public.current_shop_id());
$$;
revoke all on function public.current_branch_has_paid_plan() from public, anon;
grant execute on function public.current_branch_has_paid_plan() to authenticated;

create or replace function private.enforce_monthly_ticket_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  month_start timestamptz;
  month_end timestamptz;
  ticket_limit integer;
begin
  -- Serialize order creation per branch, including self-service clinic tickets.
  perform 1 from public.shops where id = new.shop_id for no key update;

  if private.branch_has_paid_plan(new.shop_id) then
    return new;
  end if;

  month_start := date_trunc('month', new.created_at at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
  month_end := (date_trunc('month', new.created_at at time zone 'Africa/Algiers') + interval '1 month') at time zone 'Africa/Algiers';
  select free_ticket_limit into ticket_limit from public.plans
    where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538';

  if exists (
    select 1 from public.orders
    where shop_id = new.shop_id and created_at >= month_start and created_at < month_end
    offset (coalesce(ticket_limit, 100) - 1) limit 1
  ) then
    raise exception 'BIPILO_MONTHLY_TICKET_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_monthly_ticket_limit() from public, anon, authenticated;
drop trigger if exists monthly_ticket_limit on public.orders;
create trigger monthly_ticket_limit before insert on public.orders
for each row execute function private.enforce_monthly_ticket_limit();

-- Apply after order_cancellation.sql. Existing tickets keep their tracking links.

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
