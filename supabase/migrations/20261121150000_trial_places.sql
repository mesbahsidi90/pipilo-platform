-- Fixed QR codes in the /jarreb trial (clinic «خذ رقم دور», counter, invoice):
-- the poster carries a public place id; a second phone uses it to take a
-- number, claim the cashier's pending order, or open an invoice number. The
-- trial board then pulls those tickets into its own list.

create table public.trial_places (
  place uuid primary key,
  session_hash text not null unique check (char_length(session_hash) = 64),
  shop_name text not null check (char_length(shop_name) between 1 and 100),
  kind text not null check (kind in ('cafe', 'restaurant', 'food_court', 'laundry', 'car_wash', 'tailor', 'clinic', 'other')),
  tracking_mode text not null default 'order' check (tracking_mode in ('order', 'counter', 'invoice')),
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '6 hours'
);
create index trial_places_expiry on public.trial_places (expires_at);
alter table public.trial_places enable row level security;
revoke all on public.trial_places from public, anon, authenticated;

alter table public.trial_tickets
  add column counter_pending boolean not null default false,
  add column origin text not null default 'owner' check (origin in ('owner', 'join', 'counter', 'invoice')),
  add column request_key uuid;
create unique index trial_tickets_request on public.trial_tickets (session_hash, request_key)
  where request_key is not null;
