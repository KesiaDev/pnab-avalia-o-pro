-- PNAB Caxias — Avaliação Assistida | Fase 1
-- RBAC, biblioteca normativa, proponentes, dossiê, notas A–G, avaliação consolidada,
-- trilha de auditoria e storage privado. Ver prompt-mestre, Seções 4, 9, 20.

create extension if not exists pgcrypto with schema extensions;

-- ============================================================================
-- 1. PAPÉIS (RBAC) — Seção 4.3
-- ============================================================================

create type public.app_role as enum (
  'administradora',
  'agente_merito',
  'agente_administrativo',
  'auditor'
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- security definer: evita recursão de RLS ao checar papel dentro de outras policies
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create policy "user reads own roles or administradora reads all"
  on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'administradora'));

create policy "administradora manages roles"
  on public.user_roles for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

-- perfil básico, criado automaticamente no signup
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "user reads own profile or administradora reads all"
  on public.profiles for select
  using (auth.uid() = id or public.has_role(auth.uid(), 'administradora'));

create policy "user updates own profile"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 2. TRILHA DE AUDITORIA — Seção 20 ("campos críticos")
-- ============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  table_name text not null,
  row_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy "administradora and auditor read audit logs"
  on public.audit_logs for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

-- security definer: roda como owner da função (bypassa RLS) para poder registrar
-- qualquer mutação nas tabelas auditadas, independente de quem a disparou
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, table_name, row_id, action, before, after)
  values (
    auth.uid(),
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    TG_OP,
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- 3. BIBLIOTECA NORMATIVA — Seção 3
-- ============================================================================

create type public.normative_status as enum ('vigente', 'arquivado');

create table public.reference_documents (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  created_at timestamptz not null default now()
);

create table public.reference_document_versions (
  id uuid primary key default gen_random_uuid(),
  reference_document_id uuid not null references public.reference_documents(id) on delete cascade,
  versao text not null,
  data date not null,
  hash text not null,
  status public.normative_status not null default 'vigente',
  storage_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.reference_documents enable row level security;
alter table public.reference_document_versions enable row level security;

create policy "roles read reference documents"
  on public.reference_documents for select
  using (
    public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor')
    or public.has_role(auth.uid(), 'agente_administrativo')
  );

create policy "administradora writes reference documents"
  on public.reference_documents for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create policy "roles read reference document versions"
  on public.reference_document_versions for select
  using (
    public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor')
    or public.has_role(auth.uid(), 'agente_administrativo')
  );

create policy "administradora writes reference document versions"
  on public.reference_document_versions for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_reference_document_versions
  after insert or update or delete on public.reference_document_versions
  for each row execute function public.log_audit_event();

-- ============================================================================
-- 4. PROPONENTES — Seções 2.3, 6
-- ============================================================================

create type public.proponent_status as enum (
  'nao_importado', 'importado', 'inventariado', 'em_analise', 'avaliacao_proposta',
  'auditoria_concluida', 'pendencia_humana', 'aprovado_pela_avaliadora', 'bloqueado',
  'reaberto', 'finalizado', 'pendencia_administrativa'
);

create table public.proponents (
  id uuid primary key default gen_random_uuid(),
  nome_canonico text not null,
  categoria text,
  status public.proponent_status not null default 'nao_importado',
  ciclo1_alerta text check (ciclo1_alerta in ('exata', 'provavel') or ciclo1_alerta is null),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.proponent_aliases (
  id uuid primary key default gen_random_uuid(),
  proponent_id uuid not null references public.proponents(id) on delete cascade,
  alias text not null,
  origem text not null,
  created_at timestamptz not null default now()
);

alter table public.proponents enable row level security;
alter table public.proponent_aliases enable row level security;

-- agente_merito não lê proponents nesta fase: ainda não existe o pipeline de
-- minimização documental (Seção 5.6, Fase 3) que justificaria dar acesso a ele
create policy "roles read proponents"
  on public.proponents for select
  using (
    public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor')
    or public.has_role(auth.uid(), 'agente_administrativo')
  );

create policy "administradora writes proponents"
  on public.proponents for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create policy "roles read proponent aliases"
  on public.proponent_aliases for select
  using (
    public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor')
    or public.has_role(auth.uid(), 'agente_administrativo')
  );

create policy "administradora writes proponent aliases"
  on public.proponent_aliases for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_proponents
  after insert or update or delete on public.proponents
  for each row execute function public.log_audit_event();

create or replace function public.touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

create trigger touch_proponents_atualizado_em
  before update on public.proponents
  for each row execute function public.touch_atualizado_em();

-- ============================================================================
-- 5. DOSSIÊ (ARQUIVOS) — Seções 5.3, 5.6, 7
-- ============================================================================

create type public.document_type as enum (
  'formulario', 'identidade', 'portfolio', 'comprobatorio', 'grp', 'zimbra', 'outro'
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  proponent_id uuid not null references public.proponents(id) on delete cascade,
  nome text not null,
  mime_type text,
  tipo_documental public.document_type not null default 'outro',
  storage_path text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.files(id) on delete cascade,
  versao integer not null default 1,
  sha256 text,
  tamanho_kb integer,
  storage_path text not null,
  minimizado boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.files enable row level security;
alter table public.file_versions enable row level security;

-- só administradora e auditor veem metadado de arquivo nesta fase — mesma razão
-- de proponents acima: minimização documental ainda não existe (Fase 3)
create policy "administradora and auditor read files"
  on public.files for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes files"
  on public.files for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create policy "administradora and auditor read file versions"
  on public.file_versions for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes file versions"
  on public.file_versions for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_files
  after insert or update or delete on public.files
  for each row execute function public.log_audit_event();

create trigger audit_file_versions
  after insert or update or delete on public.file_versions
  for each row execute function public.log_audit_event();

-- ============================================================================
-- 6. NOTAS A–G E AVALIAÇÃO CONSOLIDADA — Seção 9, 18.2, 18.3
-- ============================================================================

create table public.criterion_scores (
  id uuid primary key default gen_random_uuid(),
  proponent_id uuid not null references public.proponents(id) on delete cascade,
  criterion text not null check (criterion in ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  max_score integer not null,
  proposed_score integer,
  approved_score integer,
  applied_band text,
  justification text,
  human_review_required boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (proponent_id, criterion)
);

alter table public.criterion_scores enable row level security;

create policy "administradora and auditor read criterion scores"
  on public.criterion_scores for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes criterion scores"
  on public.criterion_scores for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_criterion_scores
  after insert or update or delete on public.criterion_scores
  for each row execute function public.log_audit_event();

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  proponent_id uuid not null unique references public.proponents(id) on delete cascade,
  mandatory_subtotal integer not null default 0,
  bonus_subtotal integer not null default 0,
  individual_total integer not null default 0,
  zero_in_mandatory_criterion boolean not null default false,
  status text not null default 'avaliacao_proposta',
  export_ready boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.evaluations enable row level security;

create policy "administradora and auditor read evaluations"
  on public.evaluations for select
  using (public.has_role(auth.uid(), 'administradora') or public.has_role(auth.uid(), 'auditor'));

create policy "administradora writes evaluations"
  on public.evaluations for all
  using (public.has_role(auth.uid(), 'administradora'))
  with check (public.has_role(auth.uid(), 'administradora'));

create trigger audit_evaluations
  after insert or update or delete on public.evaluations
  for each row execute function public.log_audit_event();

-- export_ready nunca é confiável vindo do cliente: é sempre recalculado aqui,
-- a partir do status e de qualquer criterion_scores.human_review_required em
-- aberto para o proponente (regra de bloqueio de fechamento, Seção 9)
create or replace function public.enforce_export_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending boolean;
begin
  select bool_or(human_review_required) into v_pending
  from public.criterion_scores
  where proponent_id = new.proponent_id;

  new.export_ready := (new.status = 'aprovado_pela_avaliadora') and not coalesce(v_pending, false);
  new.updated_at := now();
  return new;
end;
$$;

create trigger enforce_export_ready_before_write
  before insert or update on public.evaluations
  for each row execute function public.enforce_export_ready();

-- toda mudança em criterion_scores recalcula os totais e o export_ready do
-- proponente (cria a linha de evaluations se ainda não existir)
create or replace function public.recompute_evaluation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proponent_id uuid := coalesce(new.proponent_id, old.proponent_id);
  v_mandatory integer;
  v_bonus integer;
  v_zero boolean;
begin
  select
    coalesce(sum(approved_score) filter (where criterion in ('A', 'B', 'C', 'D', 'E')), 0),
    coalesce(sum(approved_score) filter (where criterion in ('F', 'G')), 0),
    bool_or(approved_score = 0 and criterion in ('A', 'B', 'C', 'D', 'E'))
  into v_mandatory, v_bonus, v_zero
  from public.criterion_scores
  where proponent_id = v_proponent_id;

  insert into public.evaluations (proponent_id, mandatory_subtotal, bonus_subtotal, individual_total, zero_in_mandatory_criterion)
  values (v_proponent_id, coalesce(v_mandatory, 0), coalesce(v_bonus, 0), coalesce(v_mandatory, 0) + coalesce(v_bonus, 0), coalesce(v_zero, false))
  on conflict (proponent_id) do update set
    mandatory_subtotal = excluded.mandatory_subtotal,
    bonus_subtotal = excluded.bonus_subtotal,
    individual_total = excluded.individual_total,
    zero_in_mandatory_criterion = excluded.zero_in_mandatory_criterion;

  return coalesce(new, old);
end;
$$;

create trigger recompute_evaluation_on_score_change
  after insert or update or delete on public.criterion_scores
  for each row execute function public.recompute_evaluation();

-- cadastrar um proponente já semeia as 7 linhas de critério com o teto oficial
-- (Seção 9.1): A=20 B=50 C=10 D=10 E=10 F=5 G=5
create or replace function public.seed_criterion_scores()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.criterion_scores (proponent_id, criterion, max_score)
  values
    (new.id, 'A', 20),
    (new.id, 'B', 50),
    (new.id, 'C', 10),
    (new.id, 'D', 10),
    (new.id, 'E', 10),
    (new.id, 'F', 5),
    (new.id, 'G', 5);
  return new;
end;
$$;

create trigger seed_criterion_scores_on_proponent_insert
  after insert on public.proponents
  for each row execute function public.seed_criterion_scores();

-- ============================================================================
-- 7. STORAGE PRIVADO — Seções 4.2, 5.6, 23
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('dossies-privados', 'dossies-privados', false)
on conflict (id) do nothing;

-- só administradora nesta fase: agente_merito ganha acesso quando existir a
-- versão minimizada (Fase 3); nenhum papel tem acesso ao bucket público
create policy "administradora reads dossies bucket"
  on storage.objects for select
  using (bucket_id = 'dossies-privados' and public.has_role(auth.uid(), 'administradora'));

create policy "administradora writes dossies bucket"
  on storage.objects for insert
  with check (bucket_id = 'dossies-privados' and public.has_role(auth.uid(), 'administradora'));

create policy "administradora updates dossies bucket"
  on storage.objects for update
  using (bucket_id = 'dossies-privados' and public.has_role(auth.uid(), 'administradora'));

create policy "administradora deletes dossies bucket"
  on storage.objects for delete
  using (bucket_id = 'dossies-privados' and public.has_role(auth.uid(), 'administradora'));
