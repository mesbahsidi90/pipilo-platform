-- Defence in depth: the push keys table already has no grants for browser
-- roles; row level security makes sure it stays closed even if a grant is
-- ever added by mistake. Server code reads it as service_role (bypasses RLS).
alter table private.bippo_push_config enable row level security;
revoke all on private.bippo_push_config from public, anon, authenticated;
