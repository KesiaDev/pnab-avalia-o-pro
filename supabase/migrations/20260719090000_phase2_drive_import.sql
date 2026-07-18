-- PNAB Caxias — Avaliação Assistida | Fase 2
-- Conexão com o Google Drive, pasta-fonte, mapeamento pasta→proponente
-- (motor de reconciliação da Seção 6) e relatório de sincronização (Seção 5.5).

-- ============================================================================
-- 1. CONEXÃO GOOGLE DRIVE — Seção 5
-- ============================================================================

create table public.drive_connections (
  id uuid primary key default gen_random_uuid(),
  connected_by uuid references auth.users(id),
  -- rótulo informativo (a integração usa só o escopo drive.readonly, sem
  -- escopo de e-mail, então não há como validar o endereço real sem pedir
  -- permissão adicional); a administradora pode preencher manualmente
  google_email text,
  refresh_token_encrypted bytea not null,
  scope text not null default 'https://www.googleapis.com/auth/drive.readonly',
  connected_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.drive_sources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.drive_connections(id) on delete cascade,
  drive_folder_id text not null,
  folder_name text,
  periodic_sync_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- mapeamento pasta do Drive → proponente (Seção 6: reconciliação por nome,
-- nunca resolve ambiguidade silenciosamente — proponent_id fica nulo até
-- confirmação humana quando não há correspondência clara)
create table public.source_folders (
  id uuid primary key default gen_random_uuid(),
  drive_source_id uuid not null references public.drive_sources(id) on delete cascade,
  drive_folder_id text not null,
  nome_pasta text not null,
  caminho text,
  proponent_id uuid references public.proponents(id),
  created_at timestamptz not null default now(),
  unique (drive_source_id, drive_folder_id)
);

alter table public.drive_connections enable row level security;
alter table public.drive_sources enable row level security;
alter table public.source_folders enable row level security;

create policy "administradora full access drive_connections"
  on public.drive_connections for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create policy "administradora full access drive_sources"
  on public.drive_sources for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create policy "administradora full access source_folders"
  on public.source_folders for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_drive_connections
  after insert or update or delete on public.drive_connections
  for each row execute function public.log_audit_event();

create trigger audit_drive_sources
  after insert or update or delete on public.drive_sources
  for each row execute function public.log_audit_event();

create trigger audit_source_folders
  after insert or update or delete on public.source_folders
  for each row execute function public.log_audit_event();

-- ============================================================================
-- 2. SINCRONIZAÇÃO E RELATÓRIO DE MUDANÇAS — Seção 5.5
-- ============================================================================

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  drive_source_id uuid not null references public.drive_sources(id) on delete cascade,
  kind text not null check (kind in ('baseline', 'sync')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido', 'erro')),
  stats jsonb,
  error_message text,
  triggered_by uuid references auth.users(id)
);

create table public.sync_changes (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.sync_runs(id) on delete cascade,
  change_type text not null check (change_type in (
    'novo_proponente', 'novo_arquivo', 'arquivo_alterado', 'arquivo_renomeado',
    'arquivo_movido', 'arquivo_excluido_fonte', 'acesso_revogado'
  )),
  proponent_id uuid references public.proponents(id),
  file_id uuid references public.files(id),
  antes text,
  depois text,
  detectado_em timestamptz not null default now(),
  acao_necessaria text
);

alter table public.sync_runs enable row level security;
alter table public.sync_changes enable row level security;

create policy "administradora and auditor read sync_runs"
  on public.sync_runs for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes sync_runs"
  on public.sync_runs for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create policy "administradora and auditor read sync_changes"
  on public.sync_changes for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes sync_changes"
  on public.sync_changes for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

-- ============================================================================
-- 3. RASTREAMENTO DE ARQUIVOS DO DRIVE EM `files`
-- ============================================================================
-- nulos para upload manual (Fase 1) — não quebra o que já existe.

alter table public.files add column drive_file_id text;
alter table public.files add column drive_modified_time timestamptz;
alter table public.files add column drive_checksum text;
alter table public.files add column caminho_relativo text;
alter table public.files add column drive_seen_at timestamptz;

create unique index files_drive_file_id_key on public.files (drive_file_id) where drive_file_id is not null;
