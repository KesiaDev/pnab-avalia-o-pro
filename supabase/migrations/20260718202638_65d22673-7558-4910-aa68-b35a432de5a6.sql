alter function public.touch_atualizado_em() set search_path = public;

revoke execute on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.log_audit_event() from public;
revoke execute on function public.touch_atualizado_em() from public;
revoke execute on function public.enforce_export_ready() from public;
revoke execute on function public.recompute_evaluation() from public;
revoke execute on function public.seed_criterion_scores() from public;