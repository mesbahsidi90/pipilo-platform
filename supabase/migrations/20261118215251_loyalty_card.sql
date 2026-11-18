-- Loyalty stamp card (Pro plan): stamps from real orders, no customer account.

alter table public.shop_settings
  add column loyalty_enabled boolean not null default false,
  add column loyalty_goal smallint not null default 9 check (loyalty_goal in (7, 9, 11, 13)),
  add column loyalty_reward text not null default '' check (char_length(loyalty_reward) <= 60),
  add column loyalty_reward_fr text not null default '' check (char_length(loyalty_reward_fr) <= 60);

-- One card per branch and device key (a random id kept in the customer's browser).
create table private.loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  device_key uuid not null,
  created_at timestamptz not null default now(),
  unique (shop_id, device_key)
);
-- Which card an order belongs to (the first device that opens the ticket).
create table private.loyalty_links (
  order_id uuid primary key references public.orders(id) on delete cascade,
  card_id uuid not null references private.loyalty_cards(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index loyalty_links_card on private.loyalty_links(card_id);
create table private.loyalty_stamps (
  order_id uuid primary key references public.orders(id) on delete cascade,
  card_id uuid not null references private.loyalty_cards(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index loyalty_stamps_card_date on private.loyalty_stamps(card_id, created_at);
create table private.loyalty_redemptions (
  id bigint generated always as identity primary key,
  card_id uuid not null references private.loyalty_cards(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  stamps_used smallint not null check (stamps_used > 0),
  redeemed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index loyalty_redemptions_card on private.loyalty_redemptions(card_id);
create index loyalty_redemptions_order on private.loyalty_redemptions(order_id);
alter table private.loyalty_cards enable row level security;
alter table private.loyalty_links enable row level security;
alter table private.loyalty_stamps enable row level security;
alter table private.loyalty_redemptions enable row level security;
revoke all on private.loyalty_cards, private.loyalty_links, private.loyalty_stamps,
  private.loyalty_redemptions from public, anon, authenticated;

-- Every card cycle starts with 2 gift stamps; a redemption uses (goal - 2) real stamps.
create function private.loyalty_state(card uuid, goal smallint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'goal', goal,
    'stamps', least(goal, 2 + greatest(0, s.n - r.used)),
    'complete', 2 + greatest(0, s.n - r.used) >= goal
  )
  from (select count(*)::int as n from private.loyalty_stamps where card_id = card) s,
       (select coalesce(sum(stamps_used), 0)::int as used
          from private.loyalty_redemptions where card_id = card) r;
$$;

-- Stamp a linked order once it is ready or collected: card enabled, paid plan,
-- at most 3 stamps per card per day (Algiers time).
create function private.loyalty_try_stamp(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  link record;
  day_start timestamptz := date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
begin
  select l.card_id, o.shop_id, o.status into link
  from private.loyalty_links l join public.orders o on o.id = l.order_id
  where l.order_id = target;
  if not found or link.status not in ('ready', 'collected') then return; end if;
  if not exists (select 1 from public.shop_settings s where s.shop_id = link.shop_id and s.loyalty_enabled)
    or not private.branch_has_paid_plan(link.shop_id) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(link.card_id::text, 917));
  if (select count(*) from private.loyalty_stamps
      where card_id = link.card_id and created_at >= day_start) >= 3 then return; end if;
  insert into private.loyalty_stamps(order_id, card_id) values (target, link.card_id)
  on conflict (order_id) do nothing;
end;
$$;

create function private.loyalty_order_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' then
    delete from private.loyalty_stamps where order_id = new.id;
  elsif new.status in ('ready', 'collected') and old.status is distinct from new.status then
    perform private.loyalty_try_stamp(new.id);
  end if;
  return null;
end;
$$;
revoke all on function private.loyalty_state(uuid, smallint), private.loyalty_try_stamp(uuid),
  private.loyalty_order_status() from public, anon, authenticated;
create trigger loyalty_order_status after update of status on public.orders
for each row execute function private.loyalty_order_status();

-- Customer: the card for this ticket on this device (created on first open).
create function public.loyalty_card(ticket uuid, device uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o record;
  s record;
  card uuid;
begin
  if ticket is null or device is null then return null; end if;
  select id, shop_id, status into o from public.orders
  where token = ticket and coalesce(restored_at, created_at) > now() - interval '24 hours';
  if not found or o.status = 'cancelled' then return null; end if;
  select loyalty_enabled, loyalty_goal, loyalty_reward, loyalty_reward_fr into s
  from public.shop_settings where shop_id = o.shop_id;
  if not coalesce(s.loyalty_enabled, false) or not private.branch_has_paid_plan(o.shop_id) then
    return null;
  end if;
  select l.card_id into card from private.loyalty_links l where l.order_id = o.id;
  if card is null then
    insert into private.loyalty_cards(shop_id, device_key) values (o.shop_id, device)
    on conflict (shop_id, device_key) do update set device_key = excluded.device_key
    returning id into card;
    insert into private.loyalty_links(order_id, card_id) values (o.id, card)
    on conflict (order_id) do nothing;
    select l.card_id into card from private.loyalty_links l where l.order_id = o.id;
    perform private.loyalty_try_stamp(o.id);
  end if;
  -- A ticket already opened on another device keeps that device's card.
  if not exists (select 1 from private.loyalty_cards c where c.id = card and c.device_key = device) then
    return null;
  end if;
  return private.loyalty_state(card, s.loyalty_goal) || jsonb_build_object(
    'reward', s.loyalty_reward,
    'reward_fr', s.loyalty_reward_fr,
    'stamped', exists (select 1 from private.loyalty_stamps st where st.order_id = o.id),
    'redeemed', exists (select 1 from private.loyalty_redemptions r where r.order_id = o.id)
  );
end;
$$;
revoke all on function public.loyalty_card(uuid, uuid) from public;
grant execute on function public.loyalty_card(uuid, uuid) to anon, authenticated;

-- Staff: card progress for the current branch's orders.
create function public.branch_loyalty(order_ids uuid[])
returns table(order_id uuid, stamps integer, goal integer, complete boolean, redeemed boolean)
language sql stable security definer set search_path = '' as $$
  select l.order_id, (x.st->>'stamps')::int, (x.st->>'goal')::int, (x.st->>'complete')::boolean,
    exists (select 1 from private.loyalty_redemptions r where r.order_id = l.order_id)
  from private.loyalty_links l
  join public.orders o on o.id = l.order_id
  join public.shop_settings s on s.shop_id = o.shop_id
  cross join lateral (select private.loyalty_state(l.card_id, s.loyalty_goal) as st) x
  where o.id = any(order_ids[1:300])
    and o.shop_id = (select public.current_shop_id())
    and s.loyalty_enabled;
$$;
revoke all on function public.branch_loyalty(uuid[]) from public, anon;
grant execute on function public.branch_loyalty(uuid[]) to authenticated;

-- Staff: «صرفتها» — redeem a full card on this order.
create function public.redeem_loyalty(target uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  o record;
  card uuid;
  goal smallint;
  st jsonb;
begin
  select id, shop_id into o from public.orders
  where id = target and shop_id = (select public.current_shop_id());
  if not found then raise exception 'Order not found' using errcode = '42501'; end if;
  select card_id into card from private.loyalty_links where order_id = o.id;
  select loyalty_goal into goal from public.shop_settings where shop_id = o.shop_id and loyalty_enabled;
  if card is null or goal is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(card::text, 917));
  st := private.loyalty_state(card, goal);
  if not (st->>'complete')::boolean then return st || jsonb_build_object('redeemed', false); end if;
  insert into private.loyalty_redemptions(card_id, order_id, stamps_used, redeemed_by)
  values (card, o.id, goal - 2, auth.uid());
  return private.loyalty_state(card, goal) || jsonb_build_object('redeemed', true);
end;
$$;
revoke all on function public.redeem_loyalty(uuid) from public, anon;
grant execute on function public.redeem_loyalty(uuid) to authenticated;

notify pgrst, 'reload schema';
