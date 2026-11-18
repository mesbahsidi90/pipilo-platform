create index if not exists owners_user_id_idx on merchant_workspace_private.owners(user_id);
create index if not exists admin_audit_actor_id_idx on public.admin_audit(actor_id);
