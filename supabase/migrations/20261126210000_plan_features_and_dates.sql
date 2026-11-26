-- Subscriptions managed from the admin: each plan carries its own features,
-- monthly ticket limit and billing type; each subscription has a start and
-- an end date. After the end date a shop keeps its plan for 7 days of grace,
-- then falls back to the default (free) plan.

-- 1. Plans: features, limits, billing, and what the pricing page shows.
alter table public.plans
  add column features text[] not null default '{}',
  add column ticket_limit integer,
  add column billing text not null default 'once',
  add column price numeric,
  add column is_public boolean not null default false,
  add column is_default boolean not null default false,
  add column position integer not null default 0,
  add column name_fr text,
  add column notes_ar text,
  add column notes_fr text;
alter table public.plans
  add constraint plans_features_known
    check (features <@ array['reports', 'feedback', 'loyalty', 'ordering', 'pos']::text[]),
  add constraint plans_billing_known check (billing in ('free', 'once', 'monthly', 'yearly')),
  add constraint plans_ticket_limit_valid check (ticket_limit is null or ticket_limit between 1 and 1000000),
  add constraint plans_price_valid check (price is null or (price >= 0 and price < 1e10)),
  add constraint plans_texts_short check (
    coalesce(length(name_fr), 0) <= 80 and coalesce(length(notes_ar), 0) <= 1000
    and coalesce(length(notes_fr), 0) <= 1000);
create unique index plans_one_default on public.plans (is_default) where is_default;

-- One-time backfill by the migration itself (no signed-in admin to audit).
alter table public.plans disable trigger audit_plans;

-- The existing free plan becomes the default; its limit is the one the Pro
-- plan used to hold for free branches.
update public.plans set
  billing = 'free', price = 0, is_default = true, is_public = true, position = 0,
  name_fr = 'Gratuite',
  ticket_limit = coalesce((select free_ticket_limit from public.plans
    where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538'), 100),
  notes_ar = E'QR ومتابعة بلا حساب مع تنبيه\nرابط تقييم قوقل بعد الاستلام\nلوحة الطلبات أو الطابور\nسجل آخر 7 أيام',
  notes_fr = E'QR, suivi sans compte et notification\nLien d’avis Google après le retrait\nGestion des commandes ou de la file\nHistorique des 7 derniers jours'
where id = (select id from public.plans
  where coalesce(monthly_price, 0) = 0 and purchase_price is null order by created_at limit 1);

update public.plans set
  billing = 'once', price = purchase_price, is_public = true, position = 1, name_fr = 'Pro',
  ticket_limit = null,
  features = array['reports', 'feedback', 'loyalty', 'ordering', 'pos'],
  notes_ar = E'شعارك، ألوانك، قوالب وبانرات\nشاشة انتظار وصلاحيات الفريق\nدعم مباشر على واتساب',
  notes_fr = E'Logo, couleurs, thèmes et bannières\nÉcran d’attente et droits d’équipe\nAssistance directe sur WhatsApp'
where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538';

update public.plans set billing = 'monthly', price = monthly_price
where price is null and coalesce(monthly_price, 0) > 0;
alter table public.plans enable trigger audit_plans;

-- 2. Subscriptions get a start date.
alter table public.subscriptions add column started_at timestamptz;
alter table public.subscriptions disable trigger audit_subscriptions;
update public.subscriptions s set started_at = coalesce(
  (select h.created_at from public.shops h where h.id = s.shop_id), s.updated_at, now());
alter table public.subscriptions enable trigger audit_subscriptions;
alter table public.subscriptions
  alter column started_at set default now(),
  alter column started_at set not null,
  add constraint subscriptions_dates check (period_end is null or period_end > started_at);

-- 3. The plan a branch runs on now: its subscription (started, not past the
--    7-day grace), otherwise the default plan.
create function private.branch_plan(branch uuid)
returns public.plans language plpgsql stable security definer set search_path = '' as $$
declare plan public.plans;
begin
  select p.* into plan
  from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.shop_id = branch and s.status in ('active', 'trial')
    and s.started_at <= now()
    and (s.period_end is null or s.period_end + interval '7 days' > now());
  if not found then
    select p.* into plan from public.plans p where p.is_default;
  end if;
  return plan;
end;
$$;

create function private.branch_has_feature(branch uuid, feature text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(feature = any(p.features), false) from private.branch_plan(branch) p;
$$;

create or replace function private.branch_has_paid_plan(branch uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(p.price, p.purchase_price, p.monthly_price, 0) > 0
  from private.branch_plan(branch) p;
$$;

-- 4. Each paid gate now asks for its own feature. The function bodies stay
--    as they are; only the gate call changes.
do $$
declare
  item record;
  body text;
begin
  for item in select * from (values
    ('public.branch_order_feedback()'::regprocedure, 'feedback'),
    ('public.guest_order_extras(uuid)'::regprocedure, 'feedback'),
    ('public.submit_order_feedback(uuid,text)'::regprocedure, 'feedback'),
    ('public.loyalty_card(uuid,uuid)'::regprocedure, 'loyalty'),
    ('private.loyalty_try_stamp(uuid)'::regprocedure, 'loyalty'),
    ('public.place_order(uuid,text,jsonb,jsonb,uuid)'::regprocedure, 'ordering'),
    ('private.menu_payload(uuid)'::regprocedure, 'ordering'),
    ('public.pos_api(text,text,jsonb)'::regprocedure, 'pos'),
    ('public.pos_key_create(text)'::regprocedure, 'pos')
  ) as gates(fn, feature) loop
    body := pg_get_functiondef(item.fn);
    if body !~ 'private\.branch_has_paid_plan\(' then
      raise exception 'No paid gate found in %', item.fn;
    end if;
    body := regexp_replace(body, 'private\.branch_has_paid_plan\(([^()]*)\)',
      'private.branch_has_feature(\1, ''' || item.feature || ''')', 'g');
    execute body;
  end loop;
end;
$$;

-- An ended subscription no longer stops the shop: it keeps working on the
-- default plan (the end date only changes the plan, see branch_plan).
-- A cancelled or past-due subscription still stops it, as before.
do $$
declare
  fn regprocedure;
  body text;
begin
  foreach fn in array array[
    'merchant_workspace_private.can_operate(uuid)'::regprocedure,
    'public.invoice_ticket(uuid,text,uuid)'::regprocedure
  ] loop
    body := pg_get_functiondef(fn);
    if position('(sub.period_end is null or sub.period_end > now())' in body) = 0 then
      raise exception 'End-date check not found in %', fn;
    end if;
    execute replace(body, '(sub.period_end is null or sub.period_end > now())', 'true');
  end loop;
end;
$$;

-- 5. Monthly ticket limit from the branch's plan (none = unlimited).
create or replace function private.enforce_monthly_ticket_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  month_start timestamptz;
  month_end timestamptz;
  ticket_limit integer;
begin
  -- Serialize order creation per branch, including self-service clinic tickets.
  perform 1 from public.shops where id = new.shop_id for no key update;
  select p.ticket_limit into ticket_limit from private.branch_plan(new.shop_id) p;
  if ticket_limit is null then return new; end if;
  month_start := date_trunc('month', new.created_at at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
  month_end := (date_trunc('month', new.created_at at time zone 'Africa/Algiers') + interval '1 month') at time zone 'Africa/Algiers';
  if exists (
    select 1 from public.orders
    where shop_id = new.shop_id and created_at >= month_start and created_at < month_end
    offset (ticket_limit - 1) limit 1
  ) then
    raise exception 'BIPILO_MONTHLY_TICKET_LIMIT' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- The free limit shown in the admin and on the pricing page = default plan's.
do $$
declare body text;
begin
  body := pg_get_functiondef('public.admin_shop_overview()'::regprocedure);
  body := regexp_replace(body,
    'select free_ticket_limit from public\.plans\s+where id = ''d87033d1-e08b-4612-ad31-9ebd17b39538''',
    'select ticket_limit from public.plans where is_default');
  if body !~ 'where is_default' then raise exception 'free limit not found in admin_shop_overview'; end if;
  execute body;
end;
$$;

create or replace function public.bipilo_plan_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'purchase_price', purchase_price, 'standard_price', standard_price,
    'launch_branches', launch_branches,
    'free_ticket_limit', (select d.ticket_limit from public.plans d where d.is_default),
    'active', active, 'referral_reward', referral_reward, 'invite_discount', invite_discount
  )
  from public.plans where id = 'd87033d1-e08b-4612-ad31-9ebd17b39538';
$$;

-- 6. What the shop runs on now, for the dashboard (features, dates, grace).
create function public.current_branch_plan()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  branch uuid := public.current_shop_id();
  plan public.plans;
  sub record;
  has_sub boolean;
begin
  if auth.uid() is null or branch is null then return null; end if;
  select * into plan from private.branch_plan(branch);
  select s.plan_id, s.status, s.started_at, s.period_end, p.name as plan_name
    into sub
  from public.subscriptions s left join public.plans p on p.id = s.plan_id
  where s.shop_id = branch;
  has_sub := found;
  return jsonb_build_object(
    'branch', branch,
    'plan_id', plan.id,
    'name', plan.name,
    'name_fr', plan.name_fr,
    'features', to_jsonb(coalesce(plan.features, '{}'::text[])),
    'ticket_limit', plan.ticket_limit,
    'paid', coalesce(plan.price, plan.purchase_price, plan.monthly_price, 0) > 0,
    'subscription', case when has_sub then jsonb_build_object(
      'plan_id', sub.plan_id, 'plan_name', sub.plan_name, 'status', sub.status,
      'started_at', sub.started_at, 'period_end', sub.period_end) end,
    'grace_until', case when has_sub and sub.plan_id = plan.id and sub.period_end is not null
      and sub.period_end <= now() then sub.period_end + interval '7 days' end
  );
end;
$$;
revoke all on function public.current_branch_plan() from public, anon;
grant execute on function public.current_branch_plan() to authenticated;

-- 7. Plans shown on the pricing page.
create function public.bipilo_plans()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'name_fr', name_fr,
    'price', coalesce(price, purchase_price, monthly_price, 0), 'currency', currency,
    'billing', billing, 'features', to_jsonb(features), 'ticket_limit', ticket_limit,
    'notes_ar', notes_ar, 'notes_fr', notes_fr, 'is_default', is_default
  ) order by position, created_at), '[]'::jsonb)
  from public.plans where active and is_public;
$$;
revoke all on function public.bipilo_plans() from public;
grant execute on function public.bipilo_plans() to anon, authenticated;

-- 8. Admin save: the subscription start date joins the shop form.
drop function public.admin_save_shop(uuid, text, text, text, text, uuid, text, timestamptz, text);
create function public.admin_save_shop(shop uuid, shop_name text, shop_kind text, shop_city text,
  shop_status text, plan uuid, subscription_status text, ends_at timestamptz, internal_notes text,
  starts_at timestamptz default null)
returns uuid language plpgsql set search_path = '' as $$
declare result uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if starts_at is not null and ends_at is not null and ends_at <= starts_at then
    raise exception 'End date must be after the start date' using errcode = '22023';
  end if;
  if shop is null then
    insert into public.shops(name, kind, city, status)
    values (trim(shop_name), shop_kind, trim(shop_city), shop_status) returning id into result;
  else
    update public.shops set name = trim(shop_name), kind = shop_kind, city = trim(shop_city),
      status = shop_status where id = shop returning id into result;
    if result is null then raise exception 'Shop not found'; end if;
  end if;
  insert into public.subscriptions(shop_id, plan_id, status, period_end, started_at)
  values (result, plan, subscription_status, ends_at, coalesce(starts_at, now()))
  on conflict (shop_id) do update set plan_id = excluded.plan_id, status = excluded.status,
    period_end = excluded.period_end,
    started_at = coalesce(starts_at, public.subscriptions.started_at),
    updated_at = now();
  insert into public.shop_notes(shop_id, notes) values (result, internal_notes)
  on conflict (shop_id) do update set notes = excluded.notes;
  return result;
end;
$$;
revoke all on function public.admin_save_shop(uuid, text, text, text, text, uuid, text, timestamptz, text, timestamptz) from public, anon;
grant execute on function public.admin_save_shop(uuid, text, text, text, text, uuid, text, timestamptz, text, timestamptz) to authenticated;

notify pgrst, 'reload schema';
