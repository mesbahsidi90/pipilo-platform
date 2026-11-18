
alter table public.shop_settings drop constraint shop_settings_tracking_mode_check;
alter table public.shop_settings add constraint shop_settings_tracking_mode_check
  check (tracking_mode in ('order', 'counter', 'invoice'));
alter table public.orders add column invoice_request_key uuid;
create unique index orders_invoice_request_key on public.orders(shop_id, invoice_request_key)
  where invoice_request_key is not null;

create function public.invoice_ticket(branch uuid, order_number text default null, request_key uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  venue text;
  ticket uuid;
begin
  select s.name into venue from public.shop_settings s join public.shops h on h.id = s.shop_id
  where s.shop_id = branch and s.tracking_mode = 'invoice' and h.kind <> 'clinic' and h.status = 'active';
  if not found then return null; end if;
  if order_number is null then return jsonb_build_object('name', venue); end if;
  if request_key is null or order_number !~ '^[1-9][0-9]{0,3}$' then return null; end if;
  perform 1 from public.shops where id = branch for no key update;
  if not exists (
    select 1 from public.shops s
    join public.shop_settings settings on settings.shop_id = s.id
    join public.shops root on root.id = coalesce(s.parent_shop_id, s.id)
    join public.subscriptions sub on sub.shop_id = root.id
    where s.id = branch and s.status = 'active' and root.status = 'active'
      and s.kind <> 'clinic' and settings.tracking_mode = 'invoice'
      and sub.status in ('active', 'trial') and (sub.period_end is null or sub.period_end > now())
  ) then return null; end if;
  select o.token into ticket from public.orders o
    where o.shop_id = branch and o.invoice_request_key = request_key
      and o.number = order_number and o.status <> 'cancelled'
      and o.created_at > now() - interval '24 hours';
  if found then return jsonb_build_object('token', ticket); end if;
  if exists (select 1 from public.orders o where o.shop_id = branch and o.invoice_request_key = request_key)
    then return jsonb_build_object('error', 'duplicate'); end if;
  if exists (
    select 1 from public.orders o where o.shop_id = branch and o.number = order_number
      and o.status <> 'cancelled'
      and o.created_at >= (date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers')
  ) then return jsonb_build_object('error', 'duplicate'); end if;
  if exists (
    select 1 from public.orders o where o.shop_id = branch and o.invoice_request_key is not null
      and o.created_at > now() - interval '1 minute' offset 29 limit 1
  ) then return jsonb_build_object('error', 'rate_limit'); end if;
  begin
    insert into public.orders(shop_id, number, invoice_request_key)
      values(branch, order_number, request_key) returning token into ticket;
  exception when unique_violation then
    return jsonb_build_object('error', 'duplicate');
  end;
  return jsonb_build_object('token', ticket);
end;
$$;
revoke all on function public.invoice_ticket(uuid, text, uuid) from public;
grant execute on function public.invoice_ticket(uuid, text, uuid) to anon, authenticated;
