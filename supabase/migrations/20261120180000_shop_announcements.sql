-- Announcements from the platform admins to every shop's dashboard
-- («ميزة جديدة», «صيانة الليلة»…). Shops see them until they tap «فهمت»,
-- until the end date, or until an admin ends them.

create table private.announcements (
  id uuid primary key default gen_random_uuid(),
  body_ar text not null check (char_length(btrim(body_ar)) between 1 and 400),
  body_fr text check (body_fr is null or char_length(btrim(body_fr)) between 1 and 400),
  tone text not null default 'info' check (tone in ('info', 'new', 'warning')),
  audience text not null default 'all' check (audience in ('all', 'free', 'paid')),
  link text check (link is null or (char_length(link) <= 300 and link ~ '^https://[^[:space:]]+$')),
  ends_at timestamptz,
  ended_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table private.announcements enable row level security;
revoke all on private.announcements from public, anon, authenticated;
create trigger audit_announcements after insert or update on private.announcements
  for each row execute function private.audit_platform_change();

create table private.announcement_dismissals (
  announcement_id uuid not null references private.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
alter table private.announcement_dismissals enable row level security;
revoke all on private.announcement_dismissals from public, anon, authenticated;

create function private.announcement_live(a private.announcements) returns boolean
language sql stable set search_path = '' as $$
  select a.ended_at is null and (a.ends_at is null or a.ends_at > now());
$$;

-- Admin: post an announcement.
create function public.admin_post_announcement(body_ar text, body_fr text default null,
  tone text default 'info', audience text default 'all', link text default null,
  ends_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare created uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if ends_at is not null and ends_at <= now() then
    raise exception 'End date must be in the future' using errcode='22023';
  end if;
  insert into private.announcements(body_ar, body_fr, tone, audience, link, ends_at)
  values (btrim(body_ar), nullif(btrim(coalesce(body_fr, '')), ''), coalesce(tone, 'info'),
    coalesce(audience, 'all'), nullif(btrim(coalesce(link, '')), ''), ends_at)
  returning id into created;
  return created;
end;
$$;
revoke all on function public.admin_post_announcement(text, text, text, text, text, timestamptz) from public, anon;
grant execute on function public.admin_post_announcement(text, text, text, text, text, timestamptz) to authenticated;

-- Admin: stop showing an announcement.
create function public.admin_end_announcement(target uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  update private.announcements set ended_at = now() where id = target and ended_at is null;
  return found;
end;
$$;
revoke all on function public.admin_end_announcement(uuid) from public, anon;
grant execute on function public.admin_end_announcement(uuid) to authenticated;

-- Admin: the last 50 announcements, with how many accounts tapped «فهمت».
create function public.admin_announcements() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'body_ar', a.body_ar, 'body_fr', a.body_fr, 'tone', a.tone,
      'audience', a.audience, 'link', a.link, 'ends_at', a.ends_at, 'ended_at', a.ended_at,
      'created_at', a.created_at, 'live', private.announcement_live(a),
      'dismissed', (select count(*) from private.announcement_dismissals d where d.announcement_id = a.id)
    ) order by a.created_at desc)
    from (select * from private.announcements order by created_at desc limit 50) a
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_announcements() from public, anon;
grant execute on function public.admin_announcements() to authenticated;

-- Shop dashboard: live announcements for this branch that this account hasn't dismissed.
create function public.my_announcements() returns jsonb
language sql stable security definer set search_path = '' as $$
  with branch as (select public.current_shop_id() as id)
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'body_ar', a.body_ar, 'body_fr', a.body_fr, 'tone', a.tone,
      'link', a.link, 'created_at', a.created_at
    ) order by a.created_at desc), '[]'::jsonb)
  from branch b
  cross join lateral (
    select * from private.announcements x
    where private.announcement_live(x)
      and (x.audience = 'all'
        or (x.audience = 'paid') = coalesce(private.branch_has_paid_plan(b.id), false))
      and not exists (select 1 from private.announcement_dismissals d
        where d.announcement_id = x.id and d.user_id = auth.uid())
    order by x.created_at desc limit 3
  ) a
  where auth.uid() is not null and b.id is not null;
$$;
revoke all on function public.my_announcements() from public, anon;
grant execute on function public.my_announcements() to authenticated;

-- Shop dashboard: «فهمت».
create function public.dismiss_announcement(target uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  insert into private.announcement_dismissals(announcement_id, user_id)
  select id, auth.uid() from private.announcements where id = target
  on conflict do nothing;
  return true;
end;
$$;
revoke all on function public.dismiss_announcement(uuid) from public, anon;
grant execute on function public.dismiss_announcement(uuid) to authenticated;

notify pgrst, 'reload schema';
