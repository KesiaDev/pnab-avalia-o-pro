-- PNAB Caxias — Avaliação Assistida | Fase 1 — hardening
-- Corrige os avisos do linter do Supabase após 20260718120000_phase1_schema.sql:
--   1) search_path fixo em todas as funções (evita search_path hijacking);
--   2) revoga o EXECUTE público (default do Postgres) de toda função SECURITY DEFINER,
--      concedendo de volta só onde é realmente necessário para as policies de RLS.
-- Revogar EXECUTE de funções de trigger não impede o disparo do trigger: a checagem
-- de privilégio nesse caso é feita na definição do trigger (dono da tabela), não em
-- cada instrução DML de quem dispara o gatilho.

alter function public.touch_atualizado_em() set search_path = public;

revoke execute on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.log_audit_event() from public;
revoke execute on function public.touch_atualizado_em() from public;
revoke execute on function public.enforce_export_ready() from public;
revoke execute on function public.recompute_evaluation() from public;
revoke execute on function public.seed_criterion_scores() from public;
