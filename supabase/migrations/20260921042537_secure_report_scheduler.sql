-- pg_net is not relocatable. This newly provisioned extension has no live
-- requests yet; recreate it in extensions before enabling the dispatcher.
drop extension pg_net;
create extension pg_net with schema extensions;
revoke all on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
