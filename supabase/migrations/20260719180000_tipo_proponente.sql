-- PNAB Caxias — Avaliação Assistida | Fase 4 (exportação)
-- A ficha oficial do Edital 119/2026 tem duas tabelas de bônus F/G distintas
-- (pessoas físicas vs. pessoas jurídicas/coletivos sem CNPJ) — precisamos
-- saber qual delas preencher na geração automática da ficha.

create type public.tipo_proponente as enum ('pessoa_fisica', 'pessoa_juridica_ou_coletivo');

alter table public.proponents
  add column tipo_proponente public.tipo_proponente;
