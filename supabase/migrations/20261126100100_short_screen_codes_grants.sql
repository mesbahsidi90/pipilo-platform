-- The dashboard calls public.waiting_screen_code() as the signed-in user, so
-- that user needs execute on the private function behind it (as with
-- waiting_screen_link). Visitors never need the code generator or the code RPC.
grant execute on function merchant_workspace_private.waiting_screen_code(boolean) to authenticated;
revoke execute on function public.waiting_screen_code(boolean) from anon;
revoke all on function merchant_workspace_private.new_display_code() from public, anon, authenticated;
notify pgrst, 'reload schema';
