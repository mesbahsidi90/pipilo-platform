-- Trial tickets: the /jarreb trial keeps its dashboard in the browser, but a
-- ticket scanned by a second phone must exist on the server. Each trial
-- order is mirrored here for 6 hours, with its own push subscriptions and the
-- same customer signals as real orders. Only the order-alerts function (service
-- role) reads or writes these tables; real shops and orders are not touched.

create table public.trial_tickets (
  token uuid primary key,
  session_hash text not null check (char_length(session_hash) = 64),
  client_hash text,
  number text not null check (char_length(number) between 1 and 8),
  shop_name text not null check (char_length(shop_name) between 1 and 100),
  kind text not null check (kind in ('cafe', 'restaurant', 'food_court', 'laundry', 'car_wash', 'tailor', 'clinic', 'other')),
  status text not null default 'preparing' check (status in ('preparing', 'ready', 'collected', 'cancelled')),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  collected_at timestamptz,
  expires_at timestamptz not null default now() + interval '6 hours',
  opened_at timestamptz,
  last_seen_at timestamptz,
  push_enabled_at timestamptz,
  push_sent_at timestamptz,
  push_delivered_at timestamptz,
  ready_seen_at timestamptz,
  coming_at timestamptz
);
create index trial_tickets_session on public.trial_tickets (session_hash);
create index trial_tickets_client on public.trial_tickets (client_hash, created_at);
create index trial_tickets_expiry on public.trial_tickets (expires_at);
alter table public.trial_tickets enable row level security;
revoke all on public.trial_tickets from public, anon, authenticated;

create table public.trial_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  token uuid not null references public.trial_tickets(token) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  language text check (language is null or language in ('ar', 'fr')),
  site_origin text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (token, endpoint)
);
alter table public.trial_push_subscriptions enable row level security;
revoke all on public.trial_push_subscriptions from public, anon, authenticated;
