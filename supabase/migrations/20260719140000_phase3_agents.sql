-- PNAB Caxias — Avaliação Assistida | Fase 3
-- Squad de agentes: classificação documental, matriz de evidências,
-- verificação de impedimento (Ciclo 1), alertas, minuta de parecer e
-- trilha de execução de cada agente (Seções 7, 8, 15, 16, 19, 20).

-- ============================================================================
-- 1. CLASSIFICAÇÃO DOCUMENTAL — Seção 7 (Agente 3)
-- ============================================================================

create table public.document_classifications (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  file_version_id uuid references public.file_versions(id) on delete cascade,
  tipo_documental public.document_type not null,
  confianca numeric,
  justificativa text,
  criado_por_agente text not null default 'agente_3',
  created_at timestamptz not null default now()
);

alter table public.document_classifications enable row level security;

create policy "administradora and auditor read document_classifications"
  on public.document_classifications for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes document_classifications"
  on public.document_classifications for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

-- ============================================================================
-- 2. MATRIZ DE EVIDÊNCIAS — Seção 8
-- ============================================================================

create type public.evidence_robustez as enum ('alta', 'media', 'declaratoria');

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  proponent_id uuid not null references public.proponents(id) on delete cascade,
  criterion text not null check (criterion in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  file_id uuid references public.files(id),
  file_version_id uuid references public.file_versions(id),
  pagina_inicial integer,
  pagina_final integer,
  tipo_documental public.document_type,
  descricao_factual text not null,
  trecho_relevante text,
  data_da_acao date,
  ano_da_acao integer,
  local text,
  bairro text,
  regiao_administrativa text,
  publico text,
  parceiros text,
  resultado_comprovado text,
  robustez public.evidence_robustez not null,
  duplicata_de uuid references public.evidence(id),
  observacoes text,
  criado_por_agente text not null,
  validado_pelo_humano boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.evidence enable row level security;

create policy "administradora and auditor read evidence"
  on public.evidence for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes evidence"
  on public.evidence for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_evidence
  after insert or update or delete on public.evidence
  for each row execute function public.log_audit_event();

-- ============================================================================
-- 3. IMPEDIMENTO — CICLO 1 — Seção 15 (Agente 4)
-- ============================================================================
-- Fica vazia até a administradora importar a relação real de contemplados
-- do Edital nº 231/2024 — até lá, o Agente 4 sempre resulta "sem
-- correspondência" (nunca inventa, nunca impede por conta própria).

create table public.cycle1_awardees (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'nome_civil' check (tipo in (
    'nome_civil', 'nome_social', 'nome_artistico', 'razao_social', 'nome_fantasia',
    'grupo', 'coletivo', 'espaco', 'representante'
  )),
  origem_edital text not null default '231/2024',
  created_at timestamptz not null default now()
);

alter table public.cycle1_awardees enable row level security;

create policy "administradora and auditor read cycle1_awardees"
  on public.cycle1_awardees for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes cycle1_awardees"
  on public.cycle1_awardees for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

-- ============================================================================
-- 4. ALERTAS — Seções 15, 16
-- ============================================================================

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  proponent_id uuid not null references public.proponents(id) on delete cascade,
  tipo text not null check (tipo in (
    'ciclo1_exata', 'ciclo1_provavel', 'conteudo_discriminatorio', 'divergencia_documental', 'outro'
  )),
  descricao text not null,
  file_id uuid references public.files(id),
  pagina integer,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  criado_por_agente text,
  created_at timestamptz not null default now()
);

alter table public.flags enable row level security;

create policy "administradora and auditor read flags"
  on public.flags for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes flags"
  on public.flags for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_flags
  after insert or update or delete on public.flags
  for each row execute function public.log_audit_event();

-- ============================================================================
-- 5. MINUTA DE PARECER — Seção 19 (Agente 8)
-- ============================================================================

create table public.pareceres (
  id uuid primary key default gen_random_uuid(),
  proponent_id uuid not null references public.proponents(id) on delete cascade,
  versao integer not null default 1,
  texto text not null,
  gerado_por_agente text not null default 'agente_8',
  aprovado_pela_avaliadora boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.pareceres enable row level security;

create policy "administradora and auditor read pareceres"
  on public.pareceres for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes pareceres"
  on public.pareceres for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_pareceres
  after insert or update or delete on public.pareceres
  for each row execute function public.log_audit_event();

-- ============================================================================
-- 6. TRILHA DE EXECUÇÃO DOS AGENTES — Seção 20
-- ============================================================================

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  proponent_id uuid references public.proponents(id) on delete cascade,
  agent_name text not null,
  model text,
  prompt_version text,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido', 'erro')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_message text,
  triggered_by uuid references auth.users(id)
);

create table public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  output_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.agent_runs enable row level security;
alter table public.agent_outputs enable row level security;

create policy "administradora and auditor read agent_runs"
  on public.agent_runs for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes agent_runs"
  on public.agent_runs for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create policy "administradora and auditor read agent_outputs"
  on public.agent_outputs for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes agent_outputs"
  on public.agent_outputs for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));
