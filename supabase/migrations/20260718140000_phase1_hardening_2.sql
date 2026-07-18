-- PNAB Caxias — Avaliação Assistida | Fase 1 — hardening (parte 2)
-- O "revoke ... from public" da migração anterior não bastou: o Supabase concede
-- EXECUTE em toda função nova diretamente a anon/authenticated via ALTER DEFAULT
-- PRIVILEGES no momento da criação do projeto — um grant direto a esses papéis,
-- não herdado de PUBLIC. Revoga esse grant direto nas funções que só devem
-- rodar como gatilho (nunca via RPC direto). has_role fica de fora de propósito:
-- é usada dentro das políticas de RLS e precisa continuar executável por
-- authenticated e anon (Seção 4.3 do prompt-mestre; ver 20260718130000).
-- Gatilhos continuam disparando normalmente sem EXECUTE concedido: a checagem
-- de privilégio de uma trigger function não depende do papel que fez o DML.

revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.log_audit_event() from anon, authenticated;
revoke execute on function public.touch_atualizado_em() from anon, authenticated;
revoke execute on function public.enforce_export_ready() from anon, authenticated;
revoke execute on function public.recompute_evaluation() from anon, authenticated;
revoke execute on function public.seed_criterion_scores() from anon, authenticated;
