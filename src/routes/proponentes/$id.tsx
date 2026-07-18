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
  useProponent,
  useUpdateCriterionScore,
  useUploadFile,
  type CriterionScoreRow,
} from "@/lib/queries/proponents";
import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
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
                    disabled={hasPending}
                    onClick={() => approveEvaluation.mutate()}
                  >
                    Aprovar avaliação
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReopen}>
                    Reabrir análise
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

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
              <DemoDataNotice />
              <EvidenceTable />
              <p className="text-xs text-muted-foreground mt-4">
                Toda nota deve ser sustentada por evidência com arquivo, versão, página e trecho.
                Ausência de comprovação é registrada sem ser transformada em afirmação de
                inexistência.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parecer">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Minuta de parecer</CardTitle>
            </CardHeader>
            <CardContent>
              <DemoDataNotice />
              <Textarea
                className="min-h-[420px] font-serif text-base leading-relaxed bg-card"
                defaultValue={`Parecer individual — Edital 119/2026 (PNAB Ciclo 2)
Proponente: ${p.nome_canonico}
Categoria: ${p.categoria ?? "—"}

Observações e pendências: ${hasPending ? "há pendência humana aberta — nota individual permanece como prévia provisória." : "nenhuma pendência humana em aberto."}
`}
              />
              <div className="flex gap-2 mt-4">
                <Button disabled>Salvar minuta</Button>
                <Button variant="outline" disabled>
                  Exportar PDF
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Geração assistida por agentes chega na Fase 3/4 do prompt-mestre.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> Trilha de auditoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DemoDataNotice />
              <p className="text-xs text-muted-foreground">
                As mutações reais deste proponente já estão sendo gravadas em{" "}
                <code>audit_logs</code>. A visualização cronológica desta aba chega junto do Auditor
                (Agente 8), na Fase 3.
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

function DemoDataNotice() {
  return (
    <div className="mb-4 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-[11px] text-muted-foreground">
      Dados de demonstração — esta aba passa a usar dados reais na Fase 3/4 (matriz de evidências e
      agentes).
    </div>
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
  onSave: (patch: { approved_score: number | null; human_review_required: boolean }) => void;
  saving: boolean;
}) {
  const [approved, setApproved] = useState<number | "">(data.approved_score ?? "");
  const [pending, setPending] = useState(data.human_review_required);

  useEffect(() => {
    setApproved(data.approved_score ?? "");
    setPending(data.human_review_required);
  }, [data.approved_score, data.human_review_required]);

  const dirty = approved !== (data.approved_score ?? "") || pending !== data.human_review_required;

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
            {data.justification && (
              <p className="text-xs text-muted-foreground mt-1">{data.justification}</p>
            )}
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
                onChange={(e) => setApproved(e.target.value === "" ? "" : Number(e.target.value))}
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
                onClick={() =>
                  onSave({
                    approved_score: approved === "" ? null : approved,
                    human_review_required: pending,
                  })
                }
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

function EvidenceTable() {
  const rows = [
    {
      crit: "A",
      arq: "3 PORTFOLIO.pdf",
      pag: "p. 4",
      desc: "Matéria do Pioneiro cita atuação em 2010.",
      robustez: "alta",
    },
    {
      crit: "B",
      arq: "4 COMPROVANTES.pdf",
      pag: "p. 12–14",
      desc: "Programa oficial da 33ª Festa da Uva.",
      robustez: "alta",
    },
    {
      crit: "B",
      arq: "3 PORTFOLIO.pdf",
      pag: "p. 22",
      desc: "Cartaz de oficina 2019.",
      robustez: "media",
    },
    {
      crit: "C",
      arq: "4 COMPROVANTES.pdf",
      pag: "p. 41",
      desc: "Contrato com Secretaria Municipal de Educação.",
      robustez: "alta",
    },
    {
      crit: "D",
      arq: "3 PORTFOLIO.pdf",
      pag: "p. 30",
      desc: "Relato de projeto com mulheres em vulnerabilidade — sem comprovação externa.",
      robustez: "declaratoria",
    },
    {
      crit: "F",
      arq: "4 COMPROVANTES.pdf",
      pag: "p. 55",
      desc: "Cartaz de apresentação em Forqueta (bairro rural).",
      robustez: "media",
    },
  ];
  const toneOf: Record<string, "success" | "info" | "neutral"> = {
    alta: "success",
    media: "info",
    declaratoria: "neutral",
  };
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
          <th className="text-left px-2 py-2 font-medium w-16">Crit.</th>
          <th className="text-left px-2 py-2 font-medium">Arquivo</th>
          <th className="text-left px-2 py-2 font-medium w-24">Página</th>
          <th className="text-left px-2 py-2 font-medium">Descrição factual</th>
          <th className="text-left px-2 py-2 font-medium w-32">Robustez</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r, i) => (
          <tr key={i} className="hover:bg-secondary/20">
            <td className="px-2 py-2.5 font-serif text-primary">{r.crit}</td>
            <td className="px-2 py-2.5 font-mono text-xs">{r.arq}</td>
            <td className="px-2 py-2.5 text-muted-foreground">{r.pag}</td>
            <td className="px-2 py-2.5">{r.desc}</td>
            <td className="px-2 py-2.5">
              <StatusBadge tone={toneOf[r.robustez]}>{r.robustez}</StatusBadge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
