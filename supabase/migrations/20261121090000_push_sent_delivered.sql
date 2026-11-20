-- The ready alert's journey on the staff board: «انرسل» (the push service
-- accepted it) and «وصل» (the customer's phone received it and said so).
-- «شافه» (ready_seen_at) and «جاي» (coming_at) already exist.
-- Both are written by the order-alerts function with the service role.

alter table public.order_guest_signals
  add column push_sent_at timestamptz,
  add column push_delivered_at timestamptz;
grant select (push_sent_at, push_delivered_at) on public.order_guest_signals to authenticated;
