import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_LABEL,
  STATUS_TONE,
  excludedNeighborhoods,
  type ImportedFile,
} from "@/lib/mock-data";
import {
  useApproveEvaluation,
  useCriterionScores,
  useFiles,
  useGenerateFicha,
  useGenerateParecer,
  useProponent,
  useUpdateCriterionScore,
  useUpdateProponentTipo,
  useUploadFile,
  type CriterionScoreRow,
  type TipoProponente,
} from "@/lib/queries/proponents";
import {
  useAgentRuns,
  useEvidence,
  useFlags,
  useLatestParecer,
  useRunAgentPipeline,
  type EvidenceRow,
} from "@/lib/queries/agents";
import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  ChevronLeft,
  ExternalLink,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/proponentes/$id")({
  component: ProponentDetail,
});

const CRITERION_LABEL: Record<string, string> = {
  A: "Tempo de atuação em Caxias do Sul",
  B: "Reconhecida atuação na categoria cultural",
  C: "Integração e inovação",
  D: "Atuação com grupos e temáticas sociais",
  E: "Contribuição comunitária",
  F: "Bônus territorial",
  G: "Bônus de ação afirmativa",
};

function ProponentDetail() {
  const { id } = useParams({ from: "/proponentes/$id" });
  const { data: p, isLoading } = useProponent(id);
  const { data: scores } = useCriterionScores(id);
  const updateScore = useUpdateCriterionScore(id);
  const approveEvaluation = useApproveEvaluation(id);
  const runAgents = useRunAgentPipeline(id);
  const queryClient = useQueryClient();

  const rows = useMemo(() => scores ?? [], [scores]);
  const totalProposto = useMemo(
    () => rows.reduce((acc, c) => acc + (c.proposed_score ?? 0), 0),
    [rows],
  );
  const hasPending = rows.some((c) => c.human_review_required);

  async function handleReopen() {
    await supabase.from("proponents").update({ status: "reaberto" }).eq("id", id);
    await supabase.from("evaluations").update({ status: "reaberto" }).eq("proponent_id", id);
    queryClient.invalidateQueries({ queryKey: ["proponents", id] });
    queryClient.invalidateQueries({ queryKey: ["proponents"] });
  }

  if (isLoading) {
    return (
      <AppShell title="Carregando…">
        <div className="text-sm text-muted-foreground">Carregando dossiê…</div>
      </AppShell>
    );
  }

  if (!p) {
    return (
      <AppShell title="Proponente não encontrado">
        <Link to={"/proponentes" as string} className="text-primary hover:underline">
          ← voltar
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={p.nome_canonico}
      subtitle={p.categoria ?? undefined}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={"/proponentes" as string}>
              <ChevronLeft className="w-4 h-4 mr-1" /> voltar
            </Link>
          </Button>
          <StatusBadge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusBadge>
        </div>
      }
    >
      {p.ciclo1_alerta && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/5">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <AlertTitle className="font-serif">
            Correspondência {p.ciclo1_alerta === "exata" ? "exata" : "provável"} com Edital nº
            231/2024 (Ciclo 1)
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            {p.ciclo1_alerta === "exata"
              ? "Pontuação interrompida automaticamente. Encaminhar decisão à Secretaria Municipal da Cultura — a plataforma não desclassifica."
              : "Foi identificada divergência documental que requer verificação pela Secretaria Municipal da Cultura."}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="avaliacao" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="avaliacao">Avaliação A–G</TabsTrigger>
          <TabsTrigger value="dossie">Dossiê e arquivos</TabsTrigger>
          <TabsTrigger value="evidencias">Matriz de evidências</TabsTrigger>
          <TabsTrigger value="parecer">Minuta de parecer</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="avaliacao" className="space-y-4 mt-0">
          <div className="grid grid-cols-3 gap-4">
            <ScoreOverview
              label="Nota proposta pelos agentes"
              value={totalProposto}
              tone="warning"
            />
            <ScoreOverview
              label={hasPending ? "Prévia provisória (pendência humana)" : "Nota da avaliadora"}
              value={p.evaluations?.individual_total ?? 0}
              tone={hasPending ? "warning" : "success"}
              pending={hasPending}
            />
            <Card className="border-border">
              <CardContent className="pt-5 pb-5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                  Ações
                </div>
                <div className="flex flex-col gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={runAgents.isPending}
                    onClick={() => runAgents.mutate()}
                  >
                    <Bot className="w-4 h-4 mr-1.5" />
                    {runAgents.isPending ? "Executando agentes…" : "Executar agentes"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={hasPending || approveEvaluation.isPending}
                    onClick={() => approveEvaluation.mutate()}
                  >
                    {approveEvaluation.isPending ? "Aprovando…" : "Aprovar avaliação"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReopen}>
                    Reabrir análise
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {runAgents.isError && (
            <p className="text-xs text-destructive">
              {(runAgents.error as Error | undefined)?.message ?? "Falha ao executar os agentes."}
            </p>
          )}

          {approveEvaluation.isSuccess && approveEvaluation.data.parecerError && (
            <p className="text-xs text-warning-foreground">
              Avaliação aprovada, mas a minuta de parecer não pôde ser gerada automaticamente (
              {approveEvaluation.data.parecerError}). Gere manualmente na aba "Minuta de parecer".
            </p>
          )}

          <div className="space-y-3">
            {rows.map((c) => (
              <CriterionRow
                key={c.id}
                data={c}
                saving={updateScore.isPending}
                onSave={(patch) => updateScore.mutate({ id: c.id, ...patch })}
              />
            ))}
          </div>

          {hasPending && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="w-4 h-4 text-warning-foreground" />
              <AlertTitle className="font-serif">Nota individual bloqueada</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Um ou mais critérios estão marcados como "revisão humana necessária". O total
                permanece como <span className="font-medium">prévia provisória</span> e não pode ser
                exportado como definitivo.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="dossie">
          <DossieTab proponentId={id} />
        </TabsContent>

        <TabsContent value="evidencias">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Matriz de evidências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EvidenceTable proponentId={id} />
              <p className="text-xs text-muted-foreground mt-4">
                Toda nota deve ser sustentada por evidência com arquivo, versão, página e trecho.
                Ausência de comprovação é registrada sem ser transformada em afirmação de
                inexistência.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parecer">
          <ParecerTab
            proponentId={id}
            hasPending={hasPending}
            exportReady={p.evaluations?.export_ready ?? false}
            tipoProponente={p.tipo_proponente ?? null}
          />
        </TabsContent>

        <TabsContent value="auditoria" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Alertas e trilha de auditoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FlagsList proponentId={id} />
              <p className="text-xs text-muted-foreground mt-4">
                Toda mutação real deste proponente é gravada em <code>audit_logs</code>, com
                usuário/ agente, valor anterior e posterior.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" /> Execuções dos agentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AgentRunsList proponentId={id} />
              <p className="text-xs text-muted-foreground mt-4">
                Quando "Executar agentes" ou a geração da minuta falha com um erro genérico na tela,
                a causa real fica registrada aqui.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 rounded-md border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
        <Users className="w-3.5 h-3.5" />
        <span>
          Bônus F: bairros que <em>não</em> qualificam automaticamente —{" "}
          <span className="font-medium text-foreground">{excludedNeighborhoods.join(", ")}</span>.
        </span>
      </div>
    </AppShell>
  );
}

function ScoreOverview({
  label,
  value,
  tone,
  pending,
}: {
  label: string;
  value: number;
  tone: "warning" | "success";
  pending?: boolean;
}) {
  const cls = tone === "success" ? "text-success" : "text-warning-foreground";
  return (
    <Card className="border-border">
      <CardContent className="pt-5 pb-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className={`font-serif text-4xl ${cls}`}>{value}</span>
          <span className="text-sm text-muted-foreground">/ 110</span>
          {pending && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-warning-foreground">
              prévia
            </span>
          )}
        </div>
        <Progress value={(value / 110) * 100} className="h-1 mt-3" />
      </CardContent>
    </Card>
  );
}

function CriterionRow({
  data,
  onSave,
  saving,
}: {
  data: CriterionScoreRow;
  onSave: (patch: {
    approved_score: number | null;
    human_review_required: boolean;
    justification?: string;
  }) => void;
  saving: boolean;
}) {
  const [approved, setApproved] = useState<number | "">(data.approved_score ?? "");
  const [pending, setPending] = useState(data.human_review_required);
  const [editingText, setEditingText] = useState(false);
  const [justification, setJustification] = useState(data.justification ?? "");

  useEffect(() => {
    setApproved(data.approved_score ?? "");
    setPending(data.human_review_required);
    setJustification(data.justification ?? "");
  }, [data.approved_score, data.human_review_required, data.justification]);

  const dirty =
    approved !== (data.approved_score ?? "") ||
    pending !== data.human_review_required ||
    (editingText && justification !== (data.justification ?? ""));

  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <div className="grid grid-cols-[3rem_1fr_auto] gap-4 items-start">
          <div className="font-serif text-3xl text-primary text-center">{data.criterion}</div>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-medium">{CRITERION_LABEL[data.criterion]}</div>
              <div className="text-xs text-muted-foreground">máx. {data.max_score}</div>
            </div>
            {editingText ? (
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="mt-1 text-xs min-h-[90px]"
                placeholder="Justificativa do critério…"
              />
            ) : (
              data.justification && (
                <p className="text-xs text-muted-foreground mt-1">{data.justification}</p>
              )
            )}
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  if (editingText) setJustification(data.justification ?? "");
                  setEditingText((v) => !v);
                }}
                className="text-[11px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary transition-colors"
              >
                {editingText ? "cancelar edição do texto" : "editar avaliação"}
              </button>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="text-xs text-muted-foreground">Proposta agentes</label>
              <span className="font-mono text-sm tabular-nums w-12 text-right">
                {data.proposed_score ?? "—"}
                <span className="text-[10px] text-muted-foreground">/{data.max_score}</span>
              </span>
              <label className="text-xs text-muted-foreground ml-4">Nota da avaliadora</label>
              <Input
                type="number"
                min={0}
                max={data.max_score}
                value={approved}
                onChange={(e) => {
                  const value = e.target.value === "" ? "" : Number(e.target.value);
                  setApproved(value);
                  // Definir a nota da avaliadora é o ato de revisão humana em
                  // si — fecha a pendência automaticamente. Ainda dá pra
                  // reabrir manualmente pelo botão ao lado, se necessário.
                  if (value !== "") setPending(false);
                }}
                className="w-20 h-8 font-mono text-right"
              />
              <button
                type="button"
                onClick={() => setPending((v) => !v)}
                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                  pending
                    ? "border-warning/50 bg-warning/15 text-warning-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {pending ? "pendência aberta" : "marcar pendência"}
              </button>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={!dirty || saving}
                onClick={() => {
                  onSave({
                    approved_score: approved === "" ? null : approved,
                    human_review_required: pending,
                    ...(editingText ? { justification } : {}),
                  });
                  setEditingText(false);
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <StatusBadge tone={pending ? "warning" : "success"}>
              {pending ? "revisão humana" : "pronto"}
            </StatusBadge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const TIPO_DOCUMENTAL_OPTIONS: ImportedFile["tipo"][] = [
  "formulario",
  "identidade",
  "portfolio",
  "comprobatorio",
  "grp",
  "zimbra",
  "outro",
];

function DossieTab({ proponentId }: { proponentId: string }) {
  const { data: p } = useProponent(proponentId);
  const updateTipo = useUpdateProponentTipo(proponentId);
  const { data: files, isLoading } = useFiles(proponentId);
  const upload = useUploadFile(proponentId);
  const [file, setFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<ImportedFile["tipo"]>("outro");

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    await upload.mutateAsync({ file, tipoDocumental: tipo });
    setFile(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Dados do proponente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-w-xs">
            <Label htmlFor="tipo-proponente">Tipo de proponente</Label>
            <Select
              value={p?.tipo_proponente ?? undefined}
              onValueChange={(v) => updateTipo.mutate(v as TipoProponente)}
            >
              <SelectTrigger id="tipo-proponente">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoa_fisica">Pessoa física</SelectItem>
                <SelectItem value="pessoa_juridica_ou_coletivo">
                  Pessoa jurídica ou coletivo/grupo sem CNPJ
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Detectado automaticamente pelo Agente 3 a partir do formulário de inscrição, GRP e
            protocolo Zimbra ao "Executar agentes" — corrija aqui se necessário. Define qual tabela
            de bônus F/G da ficha oficial é preenchida na geração automática.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" /> Upload manual de teste
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="file">Arquivo</Label>
              <Input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tipo">Classificação</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as ImportedFile["tipo"])}>
                <SelectTrigger id="tipo" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_DOCUMENTAL_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={!file || upload.isPending}>
              {upload.isPending ? "Enviando…" : "Enviar para o bucket privado"}
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground mt-2">
            Vai para o bucket privado <code>dossies-privados</code>, com acesso restrito à
            administradora nesta fase.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Arquivos importados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-y border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Arquivo</th>
                <th className="text-left px-4 py-2 font-medium">Classificação</th>
                <th className="text-right px-4 py-2 font-medium">Tamanho</th>
                <th className="text-center px-4 py-2 font-medium">Versão</th>
                <th className="text-center px-4 py-2 font-medium">Minimizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              )}
              {!isLoading && (files ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-muted-foreground">
                    Nenhum arquivo ainda.
                  </td>
                </tr>
              )}
              {(files ?? []).map((f) => {
                const latest = f.file_versions[0];
                return (
                  <tr key={f.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-2.5 font-mono text-xs">{f.nome}</td>
                    <td className="px-4 py-2.5 capitalize">{f.tipo_documental}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {latest?.tamanho_kb ?? "—"} kB
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono">v{latest?.versao ?? 1}</td>
                    <td className="px-4 py-2.5 text-center">
                      {latest?.minimizado ? (
                        <StatusBadge tone="success">redigido</StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">n/a</StatusBadge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function LinkObservation({ text }: { text: string }) {
  const urlMatch = text.match(/https?:\/\/\S+/);
  if (!urlMatch) return <span className="text-muted-foreground">{text}</span>;
  const url = urlMatch[0].replace(/[.,;)\]]+$/, "");
  const [before, after] = [
    text.slice(0, text.indexOf(url)),
    text.slice(text.indexOf(url) + url.length),
  ];
  return (
    <span className="text-muted-foreground">
      {before}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-info underline underline-offset-2 hover:text-info/80"
      >
        {url}
      </a>
      {after}
    </span>
  );
}

const ROBUSTEZ_TONE: Record<string, "success" | "info" | "neutral"> = {
  alta: "success",
  media: "info",
  declaratoria: "neutral",
};

function EvidenceTable({ proponentId }: { proponentId: string }) {
  const { data: evidence, isLoading } = useEvidence(proponentId);
  const rows = evidence ?? [];

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Nenhuma evidência ainda — clique em "Executar agentes" na aba Avaliação A–G.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
          <th className="text-left px-2 py-2 font-medium w-16">Crit.</th>
          <th className="text-left px-2 py-2 font-medium">Página</th>
          <th className="text-left px-2 py-2 font-medium">Descrição factual</th>
          <th className="text-left px-2 py-2 font-medium w-32">Robustez</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r: EvidenceRow) => (
          <tr key={r.id} className="hover:bg-secondary/20">
            <td className="px-2 py-2.5 font-serif text-primary">{r.criterion}</td>
            <td className="px-2 py-2.5 text-muted-foreground">
              {r.pagina_inicial
                ? `p. ${r.pagina_inicial}${r.pagina_final && r.pagina_final !== r.pagina_inicial ? `–${r.pagina_final}` : ""}`
                : "—"}
            </td>
            <td className="px-2 py-2.5">
              {r.descricao_factual}
              {r.trecho_relevante && (
                <div className="text-xs text-muted-foreground italic mt-0.5">
                  "{r.trecho_relevante}"
                </div>
              )}
              {r.observacoes && (
                <div className="text-[11px] text-info mt-0.5 flex items-start gap-1">
                  <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                  <LinkObservation text={r.observacoes} />
                </div>
              )}
            </td>
            <td className="px-2 py-2.5">
              <StatusBadge tone={ROBUSTEZ_TONE[r.robustez]}>{r.robustez}</StatusBadge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParecerTab({
  proponentId,
  hasPending,
  exportReady,
  tipoProponente,
}: {
  proponentId: string;
  hasPending: boolean;
  exportReady: boolean;
  tipoProponente: TipoProponente | null;
}) {
  const { data: parecer, isLoading } = useLatestParecer(proponentId);
  const generateFicha = useGenerateFicha(proponentId);
  const generateParecer = useGenerateParecer(proponentId);

  const podeGerarFicha = exportReady && !!tipoProponente && !!parecer;
  const motivoBloqueioFicha = !parecer
    ? "gere a minuta primeiro"
    : !exportReady
      ? "aprove a avaliação sem pendências abertas"
      : !tipoProponente
        ? 'defina o "tipo de proponente" na aba Dossiê'
        : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="font-serif text-lg">Minuta de parecer</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!exportReady || generateParecer.isPending}
            onClick={() => generateParecer.mutate()}
            title={!exportReady ? "aprove a avaliação sem pendências abertas" : undefined}
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {generateParecer.isPending
              ? "Gerando minuta…"
              : parecer
                ? "Gerar nova minuta"
                : "Gerar minuta"}
          </Button>
          {parecer && (
            <Button
              size="sm"
              variant="secondary"
              disabled={!podeGerarFicha || generateFicha.isPending}
              onClick={() => generateFicha.mutate()}
              title={motivoBloqueioFicha ?? undefined}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              {generateFicha.isPending ? "Gerando ficha…" : "Gerar ficha preenchida"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : parecer ? (
          <>
            <Textarea
              key={parecer.id}
              className="min-h-[420px] font-serif text-base leading-relaxed bg-card"
              defaultValue={parecer.texto}
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Versão {parecer.versao} · gerada por {parecer.gerado_por_agente}
              {hasPending &&
                " · nota individual ainda é prévia provisória enquanto houver pendência humana"}
            </p>
            {motivoBloqueioFicha && (
              <p className="text-[11px] text-warning-foreground mt-1">
                Ficha ainda não disponível: {motivoBloqueioFicha}.
              </p>
            )}
            {generateFicha.isError && (
              <p className="text-xs text-destructive mt-1">
                {(generateFicha.error as Error | undefined)?.message ?? "Falha ao gerar a ficha."}
              </p>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            {exportReady
              ? 'Nenhuma minuta ainda — clique em "Gerar minuta" acima.'
              : 'A minuta é gerada automaticamente ao clicar em "Aprovar avaliação" (aba Avaliação A–G), com as notas finais já definidas.'}
          </div>
        )}
        {generateParecer.isError && (
          <p className="text-xs text-destructive mt-2">
            {(generateParecer.error as Error | undefined)?.message ??
              "Falha ao gerar a minuta de parecer."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FlagsList({ proponentId }: { proponentId: string }) {
  const { data: flags, isLoading } = useFlags(proponentId);
  const rows = flags ?? [];

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground mb-2">Nenhum alerta registrado.</div>;
  }

  return (
    <ul className="space-y-3 text-sm mb-4">
      {rows.map((f) => (
        <li key={f.id} className="flex gap-4">
          <div className="text-xs text-muted-foreground font-mono w-32 shrink-0">
            {new Date(f.created_at).toLocaleString("pt-BR")}
          </div>
          <StatusBadge tone={f.status === "aberto" ? "warning" : "success"}>{f.status}</StatusBadge>
          <div className="flex-1">
            <div className="font-medium text-xs">{f.tipo}</div>
            <div className="text-xs text-muted-foreground">{f.descricao}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const RUN_STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  concluido: "success",
  em_andamento: "warning",
  erro: "danger",
};

function AgentRunsList({ proponentId }: { proponentId: string }) {
  const { data: runs, isLoading } = useAgentRuns(proponentId);
  const rows = runs ?? [];

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground mb-2">Nenhuma execução ainda.</div>;
  }

  return (
    <ul className="space-y-3 text-sm mb-4">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-4">
          <div className="text-xs text-muted-foreground font-mono w-32 shrink-0">
            {new Date(r.started_at).toLocaleString("pt-BR")}
          </div>
          <StatusBadge tone={RUN_STATUS_TONE[r.status] ?? "neutral"}>{r.status}</StatusBadge>
          <div className="flex-1">
            <div className="font-medium text-xs">{r.agent_name}</div>
            {r.error_message && (
              <div className="text-xs text-destructive mt-0.5">{r.error_message}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
