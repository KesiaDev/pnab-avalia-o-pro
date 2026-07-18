export type ProponentStatus =
  | "nao_importado"
  | "importado"
  | "inventariado"
  | "em_analise"
  | "avaliacao_proposta"
  | "auditoria_concluida"
  | "pendencia_humana"
  | "aprovado_pela_avaliadora"
  | "bloqueado"
  | "reaberto"
  | "finalizado"
  | "pendencia_administrativa";

export const STATUS_LABEL: Record<ProponentStatus, string> = {
  nao_importado: "Não importado",
  importado: "Importado",
  inventariado: "Inventariado",
  em_analise: "Em análise",
  avaliacao_proposta: "Avaliação proposta",
  auditoria_concluida: "Auditoria concluída",
  pendencia_humana: "Pendência humana",
  aprovado_pela_avaliadora: "Aprovado pela avaliadora",
  bloqueado: "Bloqueado",
  reaberto: "Reaberto",
  finalizado: "Finalizado",
  pendencia_administrativa: "Pendência administrativa",
};

export const STATUS_TONE: Record<
  ProponentStatus,
  "neutral" | "info" | "warning" | "success" | "danger"
> = {
  nao_importado: "neutral",
  importado: "info",
  inventariado: "info",
  em_analise: "info",
  avaliacao_proposta: "warning",
  auditoria_concluida: "warning",
  pendencia_humana: "warning",
  aprovado_pela_avaliadora: "success",
  bloqueado: "danger",
  reaberto: "warning",
  finalizado: "success",
  pendencia_administrativa: "danger",
};

export const ROLE_LABEL: Record<string, string> = {
  administradora: "Administradora",
  agente_merito: "Agente de mérito",
  agente_administrativo: "Agente administrativo",
  auditor: "Auditor",
};

export interface Proponent {
  id: string;
  nomeCanonico: string;
  aliases: string[];
  categoria: string;
  status: ProponentStatus;
  notaProposta: number | null;
  notaAprovada: number | null;
  pendencias: number;
  atualizadoEm: string;
  ciclo1Alerta?: "exata" | "provavel" | null;
}

export const proponents: Proponent[] = [
  {
    id: "p-001",
    nomeCanonico: "Ana Beatriz Machado",
    aliases: ["Ana B. Machado", "Ana Beatriz M."],
    categoria: "Trajetória Individual — Música",
    status: "avaliacao_proposta",
    notaProposta: 82,
    notaAprovada: null,
    pendencias: 1,
    atualizadoEm: "2026-03-14T10:22:00Z",
  },
  {
    id: "p-002",
    nomeCanonico: "Coletivo Raízes do Planalto",
    aliases: ["Raízes Planalto", "Grupo Raízes"],
    categoria: "Trajetória Coletiva — Dança",
    status: "pendencia_humana",
    notaProposta: 71,
    notaAprovada: null,
    pendencias: 3,
    atualizadoEm: "2026-03-13T17:05:00Z",
    ciclo1Alerta: "provavel",
  },
  {
    id: "p-003",
    nomeCanonico: "João Vitor Salvatti",
    aliases: ["J. V. Salvatti"],
    categoria: "Trajetória Individual — Teatro",
    status: "aprovado_pela_avaliadora",
    notaProposta: 94,
    notaAprovada: 96,
    pendencias: 0,
    atualizadoEm: "2026-03-12T09:41:00Z",
  },
  {
    id: "p-004",
    nomeCanonico: "Marlene Oliveira dos Santos",
    aliases: ["Marlene O. Santos", "Marlene Santos"],
    categoria: "Trajetória Individual — Artesanato",
    status: "em_analise",
    notaProposta: null,
    notaAprovada: null,
    pendencias: 0,
    atualizadoEm: "2026-03-14T11:58:00Z",
  },
  {
    id: "p-005",
    nomeCanonico: "Estúdio Interzona",
    aliases: ["Interzona Produções"],
    categoria: "Trajetória Coletiva — Audiovisual",
    status: "bloqueado",
    notaProposta: null,
    notaAprovada: null,
    pendencias: 2,
    atualizadoEm: "2026-03-11T14:12:00Z",
    ciclo1Alerta: "exata",
  },
  {
    id: "p-006",
    nomeCanonico: "Rafael Bonatto (aguardando docs)",
    aliases: ["Rafael Bonatto"],
    categoria: "Trajetória Individual — Literatura",
    status: "pendencia_administrativa",
    notaProposta: null,
    notaAprovada: null,
    pendencias: 1,
    atualizadoEm: "2026-03-10T08:00:00Z",
  },
  {
    id: "p-007",
    nomeCanonico: "Sofia Antunes",
    aliases: ["S. Antunes"],
    categoria: "Trajetória Individual — Artes Visuais",
    status: "auditoria_concluida",
    notaProposta: 88,
    notaAprovada: null,
    pendencias: 0,
    atualizadoEm: "2026-03-14T08:30:00Z",
  },
  {
    id: "p-008",
    nomeCanonico: "Cia. Passo & Sopro",
    aliases: ["Passo e Sopro"],
    categoria: "Trajetória Coletiva — Circo",
    status: "importado",
    notaProposta: null,
    notaAprovada: null,
    pendencias: 0,
    atualizadoEm: "2026-03-14T12:04:00Z",
  },
];

export interface CriterionScore {
  key: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  label: string;
  max: number;
  proposto: number | null;
  aprovado: number | null;
  evidencias: number;
  fundamentacao: string;
  humanReviewRequired: boolean;
}

export const criteria: CriterionScore[] = [
  {
    key: "A",
    label: "Tempo de atuação em Caxias do Sul",
    max: 20,
    proposto: 15,
    aprovado: null,
    evidencias: 4,
    fundamentacao:
      "Primeiro ano comprovado: 2010 (matéria Pioneiro, arquivo 3 PORTFOLIO.pdf, p. 4). Faixa aplicada: 16 a 20 anos.",
    humanReviewRequired: false,
  },
  {
    key: "B",
    label: "Reconhecida atuação na categoria cultural",
    max: 50,
    proposto: 32,
    aprovado: null,
    evidencias: 11,
    fundamentacao:
      "Trajetória contínua e diversificada com reconhecimento local identificável. Faixa 31–40.",
    humanReviewRequired: false,
  },
  {
    key: "C",
    label: "Integração e inovação",
    max: 10,
    proposto: 6,
    aprovado: null,
    evidencias: 3,
    fundamentacao: "Relação comprovada com educação (oficinas em escolas municipais, 2019 e 2022).",
    humanReviewRequired: false,
  },
  {
    key: "D",
    label: "Atuação com grupos e temáticas sociais",
    max: 10,
    proposto: 5,
    aprovado: null,
    evidencias: 2,
    fundamentacao: "Ações comprovadas com mulheres em situação de vulnerabilidade.",
    humanReviewRequired: false,
  },
  {
    key: "E",
    label: "Contribuição comunitária",
    max: 10,
    proposto: 6,
    aprovado: null,
    evidencias: 3,
    fundamentacao:
      "Formação continuada de agentes locais, com contratação de profissionais da comunidade.",
    humanReviewRequired: false,
  },
  {
    key: "F",
    label: "Bônus territorial",
    max: 5,
    proposto: 5,
    aprovado: null,
    evidencias: 1,
    fundamentacao: "Ação comprovada no bairro Forqueta (não integra a lista de bairros excluídos).",
    humanReviewRequired: false,
  },
  {
    key: "G",
    label: "Bônus de ação afirmativa",
    max: 5,
    proposto: 5,
    aprovado: null,
    evidencias: 1,
    fundamentacao: "Autodeclaração como mulher no formulário de inscrição, item 4.2.",
    humanReviewRequired: false,
  },
];

export interface ImportedFile {
  id: string;
  nome: string;
  tipo: "formulario" | "identidade" | "portfolio" | "comprobatorio" | "grp" | "zimbra" | "outro";
  paginas: number;
  tamanhoKb: number;
  versao: number;
  sha256: string;
  atualizadoEm: string;
  minimizado: boolean;
}

export const mockFiles: ImportedFile[] = [
  {
    id: "f1",
    nome: "1 FORMULARIO_INSCRICAO.pdf",
    tipo: "formulario",
    paginas: 12,
    tamanhoKb: 480,
    versao: 2,
    sha256: "a1b2c3…",
    atualizadoEm: "2026-03-14",
    minimizado: true,
  },
  {
    id: "f2",
    nome: "2 RG_CNH.pdf",
    tipo: "identidade",
    paginas: 2,
    tamanhoKb: 220,
    versao: 1,
    sha256: "d4e5f6…",
    atualizadoEm: "2026-03-10",
    minimizado: false,
  },
  {
    id: "f3",
    nome: "3 PORTFOLIO.pdf",
    tipo: "portfolio",
    paginas: 42,
    tamanhoKb: 8120,
    versao: 3,
    sha256: "aa11bb…",
    atualizadoEm: "2026-03-14",
    minimizado: true,
  },
  {
    id: "f4",
    nome: "4 COMPROVANTES_2015-2024.pdf",
    tipo: "comprobatorio",
    paginas: 68,
    tamanhoKb: 12400,
    versao: 1,
    sha256: "cc22dd…",
    atualizadoEm: "2026-03-10",
    minimizado: true,
  },
  {
    id: "f5",
    nome: "5 GRP_PROCESSO.pdf",
    tipo: "grp",
    paginas: 3,
    tamanhoKb: 190,
    versao: 1,
    sha256: "ee33ff…",
    atualizadoEm: "2026-03-10",
    minimizado: false,
  },
  {
    id: "f6",
    nome: "6 PROTOCOLO_ZIMBRA.pdf",
    tipo: "zimbra",
    paginas: 1,
    tamanhoKb: 88,
    versao: 1,
    sha256: "gg44hh…",
    atualizadoEm: "2026-03-10",
    minimizado: false,
  },
];

export interface ChangeEntry {
  id: string;
  tipo:
    | "novo_proponente"
    | "novo_arquivo"
    | "arquivo_alterado"
    | "arquivo_renomeado"
    | "arquivo_movido"
    | "arquivo_excluido_fonte"
    | "acesso_revogado";
  proponente: string;
  arquivo?: string;
  antes?: string;
  depois?: string;
  detectadoEm: string;
  acao: string;
}

export const mockChanges: ChangeEntry[] = [
  {
    id: "c1",
    tipo: "novo_proponente",
    proponente: "Cia. Passo & Sopro",
    detectadoEm: "2026-03-14T12:04:00Z",
    acao: "Distribuir e iniciar inventário",
  },
  {
    id: "c2",
    tipo: "arquivo_alterado",
    proponente: "Ana Beatriz Machado",
    arquivo: "3 PORTFOLIO.pdf",
    antes: "v2 · 7.8MB",
    depois: "v3 · 8.1MB",
    detectadoEm: "2026-03-14T10:22:00Z",
    acao: "Bloquear e revisar avaliação já proposta",
  },
  {
    id: "c3",
    tipo: "novo_arquivo",
    proponente: "Sofia Antunes",
    arquivo: "ANEXO_MATERIAS.pdf",
    detectadoEm: "2026-03-14T09:11:00Z",
    acao: "Reabrir análise",
  },
  {
    id: "c4",
    tipo: "arquivo_renomeado",
    proponente: "João Vitor Salvatti",
    arquivo: "3 PORTFOLIO.pdf",
    antes: "portfolio_final.pdf",
    depois: "3 PORTFOLIO.pdf",
    detectadoEm: "2026-03-13T18:00:00Z",
    acao: "Nenhuma — apenas registrar",
  },
  {
    id: "c5",
    tipo: "arquivo_excluido_fonte",
    proponente: "Estúdio Interzona",
    arquivo: "5 GRP.pdf",
    detectadoEm: "2026-03-13T14:22:00Z",
    acao: "Cópia privada preservada — verificar com SMC",
  },
];

export interface NormativeDoc {
  id: string;
  titulo: string;
  versao: string;
  data: string;
  hash: string;
  status: "vigente" | "arquivado";
}

export const normativeDocs: NormativeDoc[] = [
  {
    id: "n1",
    titulo: "Edital de Chamamento Público nº 119/2026 e anexos",
    versao: "v1.0",
    data: "2026-01-15",
    hash: "sha256:e11d9…",
    status: "vigente",
  },
  {
    id: "n2",
    titulo: "Modelo de Ficha de Avaliação — Edital 119/2026",
    versao: "v1.0",
    data: "2026-01-15",
    hash: "sha256:8c2a1…",
    status: "vigente",
  },
  {
    id: "n3",
    titulo: "Relação de contemplados — Edital nº 231/2024 (PNAB Ciclo 1)",
    versao: "v1.2",
    data: "2024-12-10",
    hash: "sha256:22f81…",
    status: "vigente",
  },
  {
    id: "n4",
    titulo: "Contrato nº 2026/531 — Viviane da Rocha Palma",
    versao: "v1.0",
    data: "2026-02-01",
    hash: "sha256:4a9b0…",
    status: "vigente",
  },
  {
    id: "n5",
    titulo: "Lei Municipal nº 8.741/2021 — Bairros de Caxias do Sul",
    versao: "v1.0",
    data: "2021-11-04",
    hash: "sha256:1de6c…",
    status: "vigente",
  },
  {
    id: "n6",
    titulo: "SEPLAN — Regiões Administrativas por Bairros",
    versao: "2025",
    data: "2025-03-20",
    hash: "sha256:77b2c…",
    status: "vigente",
  },
  {
    id: "n7",
    titulo: "Planilha Geral de Notas — Edital 119/2026",
    versao: "v0.4 (rascunho)",
    data: "2026-03-01",
    hash: "sha256:0aa11…",
    status: "vigente",
  },
];

export const excludedNeighborhoods = [
  "Centro",
  "Exposição",
  "São Pelegrino",
  "Rio Branco",
  "Nossa Senhora de Lourdes",
  "Santa Catarina",
  "Pio X",
  "Panazzolo",
  "Jardim América",
  "Madureira",
  "Universitário",
];

export function findProponent(id: string) {
  return proponents.find((p) => p.id === id);
}

export function sumScore(cs: CriterionScore[], field: "proposto" | "aprovado") {
  return cs.reduce((acc, c) => acc + (c[field] ?? 0), 0);
}
