-- Referral rewards. When a shop that signed up from an invite link buys Pro:
--   * the invited shop pays less on its first Pro branch (invite_discount);
--   * the inviter earns a credit (referral_reward) that comes off its own
--     Pro price, until that price reaches zero.
-- Pro is activated by hand in /admin after payment, so every activation
-- (a branch moving to an active paid plan) is recorded with what to collect.

alter table public.plans
  add column referral_reward numeric not null default 2000 check (referral_reward >= 0),
  add column invite_discount numeric not null default 1000 check (invite_discount >= 0);

-- One row per branch activated on a paid plan, with the price agreed.
create table private.pro_purchases (
  branch uuid primary key references public.shops(id) on delete cascade,
  root uuid not null references public.shops(id) on delete cascade,
  price numeric,
  invite_discount numeric not null default 0,
  credit_used numeric not null default 0,
  total numeric,
  created_at timestamptz not null default now()
);
alter table private.pro_purchases enable row level security;
revoke all on private.pro_purchases from public, anon, authenticated;

-- One reward per invited shop, earned at its first Pro purchase.
create table private.referral_rewards (
  invited_root uuid primary key references public.shops(id) on delete cascade,
  inviter_root uuid not null references public.shops(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);
alter table private.referral_rewards enable row level security;
revoke all on private.referral_rewards from public, anon, authenticated;

-- Branches already on Pro before this change: recorded without discounts,
-- so they never earn or spend anything retroactively.
insert into private.pro_purchases(branch, root)
select s.id, coalesce(s.parent_shop_id, s.id)
from public.shops s
where private.branch_has_paid_plan(s.id)
on conflict do nothing;

create function private.shop_root(branch uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(parent_shop_id, id) from public.shops where id = branch;
$$;
revoke all on function private.shop_root(uuid) from public, anon, authenticated;

create function private.referral_credit(root_shop uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(amount) from private.referral_rewards where inviter_root = root_shop), 0)
       - coalesce((select sum(credit_used) from private.pro_purchases where root = root_shop), 0);
$$;
revoke all on function private.referral_credit(uuid) from public, anon, authenticated;

-- What a branch pays for Pro today: list price, invite discount (first Pro
-- branch of an invited shop), the inviter credit applied, and the total.
create function private.pro_quote(branch uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  root_shop uuid := private.shop_root(branch);
  plan public.plans%rowtype;
  list_price numeric;
  discount numeric := 0;
  credit numeric;
  applied numeric;
begin
  if root_shop is null then return null; end if;
  select * into plan from public.plans where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538';
  if not found then return null; end if;
  list_price := case when plan.launch_branches > 0 then plan.purchase_price else plan.standard_price end;
  if exists (select 1 from private.signup_sources ss
             where ss.shop_id = root_shop and ss.referred_by is not null)
     and not exists (select 1 from private.pro_purchases p where p.root = root_shop) then
    discount := least(plan.invite_discount, list_price);
  end if;
  credit := greatest(private.referral_credit(root_shop), 0);
  applied := least(credit, list_price - discount);
  return jsonb_build_object(
    'price', list_price, 'invite_discount', discount, 'credit', credit,
    'credit_used', applied, 'total', list_price - discount - applied,
    'purchased', exists (select 1 from private.pro_purchases p where p.branch = pro_quote.branch)
  );
end;
$$;
revoke all on function private.pro_quote(uuid) from public, anon, authenticated;

-- A branch moving to an active paid plan is a purchase: record the quote,
-- spend the credit, and reward the inviter on the invited shop's first one.
create function private.record_pro_purchase() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  quote jsonb;
  root_shop uuid;
  inviter uuid;
  first_purchase boolean;
  reward numeric;
begin
  if new.status <> 'active' or not private.branch_has_paid_plan(new.shop_id) then return null; end if;
  if exists (select 1 from private.pro_purchases where branch = new.shop_id) then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('pro_purchase', 0));
  root_shop := private.shop_root(new.shop_id);
  first_purchase := not exists (select 1 from private.pro_purchases where root = root_shop);
  quote := private.pro_quote(new.shop_id);
  insert into private.pro_purchases(branch, root, price, invite_discount, credit_used, total)
  values (new.shop_id, root_shop, (quote->>'price')::numeric, (quote->>'invite_discount')::numeric,
    (quote->>'credit_used')::numeric, (quote->>'total')::numeric)
  on conflict do nothing;
  if first_purchase then
    select ss.referred_by into inviter from private.signup_sources ss where ss.shop_id = root_shop;
    select referral_reward into reward from public.plans where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538';
    if inviter is not null and inviter <> root_shop and coalesce(reward, 0) > 0 then
      insert into private.referral_rewards(invited_root, inviter_root, amount)
      values (root_shop, inviter, reward) on conflict do nothing;
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.record_pro_purchase() from public, anon, authenticated;
create trigger record_pro_purchase after insert or update on public.subscriptions
  for each row execute function private.record_pro_purchase();

-- Shop: its referral numbers, the reward amounts and its credit.
create or replace function public.my_referral() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  root uuid;
  ref_code text;
  plan public.plans%rowtype;
begin
  select coalesce(s.parent_shop_id, s.id) into root
  from public.shops s where s.id = public.current_shop_id();
  if root is null or not merchant_workspace_private.can_edit_settings(root) then
    return null;
  end if;
  select r.code into ref_code from private.referral_codes r where r.shop_id = root;
  if ref_code is null then
    insert into private.referral_codes(shop_id, code)
    values (root, private.new_referral_code())
    on conflict (shop_id) do nothing;
    select r.code into ref_code from private.referral_codes r where r.shop_id = root;
  end if;
  select * into plan from public.plans where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538';
  return jsonb_build_object(
    'code', ref_code,
    'signups', (select count(*) from private.signup_sources ss where ss.referred_by = root),
    'active', (select count(*) from private.signup_sources ss
      where ss.referred_by = root
        and exists (select 1 from public.orders o where o.shop_id = ss.shop_id)),
    'paid', (select count(*) from private.signup_sources ss
      where ss.referred_by = root and private.branch_has_paid_plan(ss.shop_id)),
    'reward', plan.referral_reward,
    'invite_discount', plan.invite_discount,
    'earned', coalesce((select sum(amount) from private.referral_rewards where inviter_root = root), 0),
    'credit', greatest(private.referral_credit(root), 0)
  );
end;
$$;

-- Shop: what this branch would pay for Pro now.
create function public.my_pro_quote() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is not null and public.current_shop_id() is not null
    then private.pro_quote(public.current_shop_id()) end;
$$;
revoke all on function public.my_pro_quote() from public, anon;
grant execute on function public.my_pro_quote() to authenticated;

-- Admin: what to collect from a shop, or what it paid, plus its credit.
create function public.admin_pro_quote(shop uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Platform admin required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'quote', private.pro_quote(shop),
    'purchase', (select to_jsonb(p) - 'root' - 'branch' from private.pro_purchases p where p.branch = shop),
    'earned', coalesce((select sum(amount) from private.referral_rewards
      where inviter_root = private.shop_root(shop)), 0)
  );
end;
$$;
revoke all on function public.admin_pro_quote(uuid) from public, anon;
grant execute on function public.admin_pro_quote(uuid) to authenticated;

create or replace function public.bipilo_plan_catalog() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'purchase_price', purchase_price, 'standard_price', standard_price,
    'launch_branches', launch_branches, 'free_ticket_limit', free_ticket_limit,
    'active', active, 'referral_reward', referral_reward, 'invite_discount', invite_discount
  )
  from public.plans where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538';
$$;

notify pgrst, 'reload schema';
