-- Consequential URWS writes must flow through authority-enforcing RPCs, not direct table mutation.
drop policy if exists urws_decisions_admin_insert on public.urws_decisions;
drop policy if exists urws_remedies_admin_insert on public.urws_remedies;
drop policy if exists urws_remedies_admin_update on public.urws_remedies;
revoke insert,update,delete on public.urws_decisions from authenticated;
revoke insert,update,delete on public.urws_remedies from authenticated;
-- Read grants remain subject to RLS. Security-definer URWS functions retain controlled write capability.
