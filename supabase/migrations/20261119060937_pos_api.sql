-- POS API (Pro): a cashier system creates tickets and marks them ready,
-- collected or cancelled with a secret key that belongs to one branch.

alter table public.orders add column external_ref text
  check (external_ref is null or char_length(external_ref) between 1 and 128);
create unique index orders_external_ref on public.orders(shop_id, external_ref)
  where external_ref is not null;
grant select (external_ref) on public.orders to authenticated;

create table private.pos_keys (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  prefix text not null,
  key_hash bytea not null unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  window_start timestamptz,
  window_count integer not null default 0
);
create index pos_keys_shop on private.pos_keys(shop_id);
alter table private.pos_keys enable row level security;
revoke all on private.pos_keys from public, anon, authenticated;

-- Dashboard: keys of the current branch (never the secret itself).
create function public.pos_keys_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when merchant_workspace_private.can_edit_settings(public.current_shop_id()) then
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'label', k.label, 'prefix', k.prefix,
        'created_at', k.created_at, 'last_used_at', k.last_used_at
      ) order by k.created_at desc)
      from private.pos_keys k
      where k.shop_id = public.current_shop_id() and k.revoked_at is null
    ), '[]'::jsonb)
  end;
$$;
revoke all on function public.pos_keys_list() from public, anon;
grant execute on function public.pos_keys_list() to authenticated;

-- Dashboard: new key, shown once. At most 5 active keys per branch.
create function public.pos_key_create(label text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  branch uuid := public.current_shop_id();
  secret text;
  name text := left(btrim(coalesce(label, '')), 60);
begin
  if branch is null or not merchant_workspace_private.can_edit_settings(branch) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if not private.branch_has_paid_plan(branch) then
    return jsonb_build_object('error', 'plan_required');
  end if;
  if name = '' then name := 'POS'; end if;
  perform 1 from public.shops where id = branch for no key update;
  if (select count(*) from private.pos_keys where shop_id = branch and revoked_at is null) >= 5 then
    return jsonb_build_object('error', 'too_many');
  end if;
  secret := 'bpk_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into private.pos_keys(shop_id, label, prefix, key_hash, created_by)
  values (branch, name, left(secret, 12), extensions.digest(secret, 'sha256'), auth.uid());
  return jsonb_build_object('key', secret, 'prefix', left(secret, 12), 'label', name);
end;
$$;
revoke all on function public.pos_key_create(text) from public, anon;
grant execute on function public.pos_key_create(text) to authenticated;

create function public.pos_key_revoke(target uuid) returns boolean
language sql security definer set search_path = '' as $$
  with revoked as (
    update private.pos_keys set revoked_at = now()
    where id = target and shop_id = public.current_shop_id() and revoked_at is null
      and merchant_workspace_private.can_edit_settings(shop_id)
    returning 1
  )
  select exists (select 1 from revoked);
$$;
revoke all on function public.pos_key_revoke(uuid) from public, anon;
grant execute on function public.pos_key_revoke(uuid) to authenticated;

-- Ticket as the API returns it.
create function private.pos_ticket(o public.orders) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'number', o.number, 'branchCode', o.shop_id,
    'externalRef', o.external_ref, 'status', o.status,
    'customerName', o.guest_name,
    'trackingUrl', 'https://bipilo.app/#track/' || o.token,
    'createdAt', o.created_at, 'readyAt', o.ready_at, 'collectedAt', o.collected_at
  );
$$;
revoke all on function private.pos_ticket(public.orders) from public, anon, authenticated;

-- Edge function only (service role): every POS API call goes through here.
-- Returns {status: <http code>, body: <json>}.
create function public.pos_api(api_key text, action text, args jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k private.pos_keys;
  h record;
  o public.orders;
  ref text;
  num text;
  who text;
  target text := coalesce(args->>'ticket', '');
  day_start timestamptz := date_trunc('day', now() at time zone 'Africa/Algiers') at time zone 'Africa/Algiers';
  next_number integer;
  tries integer := 0;
  wanted text;
begin
  if coalesce(api_key, '') !~ '^bpk_[0-9a-f]{48}$' then
    return jsonb_build_object('status', 401, 'body', jsonb_build_object('error', 'invalid_key'));
  end if;
  select * into k from private.pos_keys
  where key_hash = extensions.digest(api_key, 'sha256') and revoked_at is null
  for update;
  if not found then
    return jsonb_build_object('status', 401, 'body', jsonb_build_object('error', 'invalid_key'));
  end if;
  -- 120 calls a minute per key.
  if k.window_start is null or k.window_start < now() - interval '1 minute' then
    update private.pos_keys set window_start = now(), window_count = 1, last_used_at = now() where id = k.id;
  elsif k.window_count >= 120 then
    return jsonb_build_object('status', 429, 'body', jsonb_build_object('error', 'rate_limit'));
  else
    update private.pos_keys set window_count = window_count + 1, last_used_at = now() where id = k.id;
  end if;

  select s.id, s.name, s.status, s.kind into h from public.shops s where s.id = k.shop_id;
  if action = 'branches' then
    return jsonb_build_object('status', 200, 'body', jsonb_build_object('data', jsonb_build_array(
      jsonb_build_object('code', h.id, 'name', h.name, 'active', h.status = 'active'))));
  end if;
  if h.status <> 'active' then
    return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'branch_inactive'));
  end if;
  if not private.branch_has_paid_plan(h.id) then
    return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'plan_required'));
  end if;

  if action = 'create' then
    ref := btrim(coalesce(args->>'externalRef', ''));
    num := btrim(coalesce(args->>'number', ''));
    who := nullif(left(btrim(coalesce(args->>'customerName', '')), 40), '');
    if ref = '' or char_length(ref) > 128 then
      return jsonb_build_object('status', 422, 'body', jsonb_build_object('error', 'invalid_external_ref'));
    end if;
    if coalesce(args->>'branchCode', '') not in ('', h.id::text) then
      return jsonb_build_object('status', 404, 'body', jsonb_build_object('error', 'branch_not_found'));
    end if;
    if num <> '' and num !~ '^[1-9][0-9]{0,3}$' then
      return jsonb_build_object('status', 422, 'body', jsonb_build_object('error', 'invalid_number'));
    end if;
    perform 1 from public.shops where id = h.id for no key update;
    select * into o from public.orders where shop_id = h.id and external_ref = ref;
    if found then
      return jsonb_build_object('status', 200, 'body', private.pos_ticket(o));
    end if;
    if num = '' then
      select coalesce(max(x.number::integer), 0) + 1 into next_number
      from public.orders x
      where x.shop_id = h.id and x.number ~ '^[0-9]{1,4}$' and x.created_at >= day_start;
      loop
        if next_number > 9999 then next_number := 1; end if;
        exit when not exists (
          select 1 from public.orders x
          where x.shop_id = h.id and x.number = next_number::text and x.status in ('preparing', 'ready'));
        next_number := next_number + 1;
        tries := tries + 1;
        if tries > 9999 then
          return jsonb_build_object('status', 409, 'body', jsonb_build_object('error', 'busy'));
        end if;
      end loop;
      num := next_number::text;
    elsif exists (
      select 1 from public.orders x
      where x.shop_id = h.id and x.number = num and x.status in ('preparing', 'ready')) then
      return jsonb_build_object('status', 409, 'body', jsonb_build_object('error', 'number_in_use'));
    end if;
    begin
      insert into public.orders(shop_id, number, guest_name, external_ref)
      values (h.id, num, who, ref)
      returning * into o;
    exception when raise_exception then
      if sqlerrm = 'BIPILO_MONTHLY_TICKET_LIMIT' then
        return jsonb_build_object('status', 403, 'body', jsonb_build_object('error', 'monthly_limit'));
      end if;
      raise;
    end;
    -- The POS prints the tracking link itself: no counter scan needed.
    update public.orders set counter_pending = false where id = o.id and counter_pending;
    select * into o from public.orders where id = o.id;
    return jsonb_build_object('status', 201, 'body', private.pos_ticket(o));
  end if;

  -- The ticket: our id, or the POS's own externalRef.
  if target ~ '^[0-9a-fA-F-]{36}$' then
    select * into o from public.orders where shop_id = h.id and id = target::uuid;
  end if;
  if o.id is null and target <> '' then
    select * into o from public.orders where shop_id = h.id and external_ref = target;
  end if;
  if o.id is null then
    return jsonb_build_object('status', 404, 'body', jsonb_build_object('error', 'ticket_not_found'));
  end if;
  if action = 'get' then
    return jsonb_build_object('status', 200, 'body', private.pos_ticket(o));
  end if;

  wanted := case action when 'ready' then 'ready' when 'complete' then 'collected'
    when 'cancel' then 'cancelled' end;
  if wanted is null then
    return jsonb_build_object('status', 404, 'body', jsonb_build_object('error', 'not_found'));
  end if;
  if o.status = wanted then
    return jsonb_build_object('status', 200, 'body', private.pos_ticket(o));
  end if;
  if not ((o.status = 'preparing' and wanted in ('ready', 'cancelled'))
    or (o.status = 'ready' and wanted = 'collected')) then
    return jsonb_build_object('status', 409, 'body', jsonb_build_object(
      'error', 'invalid_transition', 'status', o.status));
  end if;
  -- A POS ticket never waits for the counter QR scan.
  update public.orders set counter_pending = false where id = o.id and counter_pending;
  begin
    -- The order triggers (ready push, loyalty stamp…) run as usual.
    update public.orders set
      status = wanted,
      accepted_at = case when wanted = 'ready' and order_mode is not null
        then coalesce(accepted_at, clock_timestamp()) else accepted_at end
    where id = o.id and status = o.status
    returning * into o;
  exception when raise_exception or unique_violation then
    return jsonb_build_object('status', 409, 'body', jsonb_build_object('error', 'invalid_transition'));
  end;
  if o.id is null then
    return jsonb_build_object('status', 409, 'body', jsonb_build_object('error', 'changed'));
  end if;
  return jsonb_build_object('status', 200, 'body', private.pos_ticket(o));
end;
$$;
revoke all on function public.pos_api(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.pos_api(text, text, jsonb) to service_role;

notify pgrst, 'reload schema';
