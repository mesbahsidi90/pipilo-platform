begin;

alter table public.shops drop constraint shops_kind_check,
  add constraint shops_kind_check check (kind in ('cafe','restaurant','other','food_court','laundry','car_wash','tailor','clinic'));

alter table public.orders add column clinic_request_key uuid;
create unique index orders_clinic_request_key on public.orders(shop_id,clinic_request_key)
  where clinic_request_key is not null;

create schema clinic_queue_private;
revoke all on schema clinic_queue_private from public;
grant usage on schema clinic_queue_private to anon, authenticated;

create function clinic_queue_private.run(operation text, branch uuid, request_token uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  target uuid;
  venue text;
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

  select coalesce(s.name, h.name) into venue
  from public.shops h left join public.shop_settings s on s.shop_id=h.id
  where h.id=target and h.kind='clinic' and h.status='active';
  if not found then return null; end if;
  if operation='info' then return jsonb_build_object('name', venue); end if;

  perform pg_advisory_xact_lock(hashtextextended(target::text, 673));
  if operation='next' then
    select * into result from public.orders
    where shop_id=target and status='preparing'
      and coalesce(restored_at,created_at)>now()-interval '24 hours'
    order by coalesce(restored_at,created_at),id
    limit 1 for update skip locked;
    if not found then return null; end if;
    update public.orders set status='ready' where id=result.id returning * into result;
  else
    if operation='join' then
      if request_token is null then raise exception 'Missing request token' using errcode='22023'; end if;
      select * into result from public.orders
      where clinic_request_key=request_token and shop_id=target and created_at>now()-interval '24 hours';
      if found then return jsonb_build_object('number',result.number,'token',result.token); end if;
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
    'status',result.status,'created_at',result.created_at,'tracking_code',result.tracking_code);
end;
$$;
revoke all on function clinic_queue_private.run(text,uuid,uuid) from public;
grant execute on function clinic_queue_private.run(text,uuid,uuid) to anon,authenticated;

create function public.clinic_queue(operation text, branch uuid default null, request_token uuid default null)
returns jsonb language sql volatile security invoker set search_path='' as $$
  select clinic_queue_private.run(operation,branch,request_token);
$$;
revoke all on function public.clinic_queue(text,uuid,uuid) from public;
grant execute on function public.clinic_queue(text,uuid,uuid) to anon,authenticated;
create or replace function public.create_my_shop(shop_name text,shop_kind text,shop_city text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); result uuid; starter uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,741));
 select shop_id into result from public.memberships where user_id=actor;
 if result is not null then return result; end if;
 if length(trim(shop_name)) not between 1 and 100 or shop_kind not in ('cafe','restaurant','other','food_court','laundry','car_wash','tailor','clinic') or length(shop_city)>100 or shop_name is null or shop_kind is null or shop_city is null then raise exception 'Invalid shop details' using errcode='22023'; end if;
 select id into starter from public.plans where active and monthly_price=0 order by created_at,id limit 1;
 if starter is null then raise exception 'التسجيل متوقف مؤقتًا، تواصل مع إدارة bippo.'; end if;
 result:=gen_random_uuid();
 insert into private.shop_signup_scope(tx,actor,shop) values(txid_current(),actor,result);
 insert into public.shops(id,name,kind,city,status) values(result,trim(shop_name),shop_kind,trim(shop_city),'active');
 insert into public.memberships(user_id,shop_id) values(actor,result);
 insert into public.subscriptions(shop_id,plan_id,status) values(result,starter,'active');
 insert into public.shop_settings(shop_id,name,city,tracking_mode)
 values(result,trim(shop_name),trim(shop_city),case when shop_kind in ('cafe','restaurant','food_court') then 'order' else 'counter' end);
 delete from private.shop_signup_scope where tx=txid_current();
 return result;
end; $$;
create or replace function customer_design_private.lookup(ticket uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'customer_theme', s.customer_theme,
    'banner_text', s.banner_text,
    'banner_image', s.banner_image,
    'customer_options', s.customer_options,
    'customer_background_image', s.customer_background_image,
    'alert_tone', s.alert_tone, 'kind', h.kind
  )
  from public.orders o
  join public.shops h on h.id = o.shop_id
  left join public.shop_settings s on s.shop_id = o.shop_id
  where o.token = ticket and coalesce(o.restored_at,o.created_at)>now() - interval '24 hours';
$$;

alter table public.shop_settings add column waiting_mode text
  check (waiting_mode in ('onsite','return'));

create function clinic_queue_private.configure_shop(
  shop_name text, shop_kind text, shop_city text, tracking_preference text, waiting_preference text
) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); target uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if tracking_preference is null or tracking_preference not in ('order','counter')
    or waiting_preference is null or waiting_preference not in ('onsite','return')
    or (shop_kind='clinic' and (tracking_preference<>'counter' or waiting_preference<>'onsite'))
    or (shop_kind in ('laundry','car_wash','tailor') and waiting_preference<>'return') then
    raise exception 'Invalid setup choices' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,741));
  select shop_id into target from public.memberships where user_id=actor;
  if target is not null then return target; end if;
  target := public.create_my_shop(shop_name,shop_kind,shop_city);
  update public.shop_settings set tracking_mode=tracking_preference, waiting_mode=waiting_preference
    where shop_id=target;
  return target;
end;
$$;
revoke all on function clinic_queue_private.configure_shop(text,text,text,text,text) from public;
grant execute on function clinic_queue_private.configure_shop(text,text,text,text,text) to authenticated;

create function public.create_my_shop(
  shop_name text, shop_kind text, shop_city text, tracking_preference text, waiting_preference text
) returns uuid language sql security invoker set search_path='' as $$
  select clinic_queue_private.configure_shop(shop_name,shop_kind,shop_city,tracking_preference,waiting_preference);
$$;
revoke all on function public.create_my_shop(text,text,text,text,text) from public;
grant execute on function public.create_my_shop(text,text,text,text,text) to authenticated;

commit;
