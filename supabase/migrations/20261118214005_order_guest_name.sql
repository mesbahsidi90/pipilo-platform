-- Optional customer name typed by staff with the order number.
-- Visible to the branch's staff only: never returned by the public ticket,
-- display or guest functions.
alter table public.orders add column guest_name text
  check (guest_name is null or char_length(guest_name) between 1 and 40);
grant select (guest_name), insert (guest_name) on public.orders to authenticated;
notify pgrst, 'reload schema';
