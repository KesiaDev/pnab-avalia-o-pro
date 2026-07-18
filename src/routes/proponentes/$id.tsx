import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  criteria, findProponent, mockFiles, STATUS_LABEL, STATUS_TONE, sumScore, excludedNeighborhoods,
} from "@/lib/mock-data";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, FileText, ShieldAlert, ShieldCheck, Sparkles, Users } from "lucide-react";

export const Route = createFileRoute("/proponentes/$id")({
  component: ProponentDetail,
});

function ProponentDetail() {
  const { id } = useParams({ from: "/proponentes/$id" });
  const p = findProponent(id);
  const [scores, setScores] = useState(() =>
    criteria.map((c) => ({ ...c, aprovado: c.aprovado ?? c.proposto })),
  );

  const totalProposto = useMemo(() => sumScore(scores, "proposto"), [scores]);
  const totalAprovado = useMemo(() => sumScore(scores, "aprovado"), [scores]);
  const hasPending = scores.some((c) => c.humanReviewRequired);

  if (!p) {
    return (
      <AppShell title="Proponente não encontrado">
        <Link to={"/proponentes" as string} className="text-primary hover:underline">← voltar</Link>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={p.nomeCanonico}
      subtitle={`${p.categoria} · Processo GRP 2026/${id.replace("p-", "")}0 · Protocolo Zimbra #7${id.replace("p-", "")}42`}
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
      {p.ciclo1Alerta && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/5">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <AlertTitle className="font-serif">
            Correspondência {p.ciclo1Alerta === "exata" ? "exata" : "provável"} com Edital nº 231/2024 (Ciclo 1)
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            {p.ciclo1Alerta === "exata"
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
          <TabsTrigger value="auditoria">Auditoria e trilha</TabsTrigger>
        </TabsList>

        <TabsContent value="avaliacao" className="space-y-4 mt-0">
          <div className="grid grid-cols-3 gap-4">
            <ScoreOverview label="Nota proposta pelos agentes" value={totalProposto} tone="warning" />
            <ScoreOverview
              label={hasPending ? "Prévia provisória (pendência humana)" : "Nota da avaliadora"}
              value={totalAprovado}
              tone={hasPending ? "warning" : "success"}
              pending={hasPending}
            />
            <Card className="border-border">
              <CardContent className="pt-5 pb-5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ações</div>
                <div className="flex flex-col gap-2 mt-3">
                  <Button size="sm" disabled={hasPending}>Aprovar avaliação</Button>
                  <Button size="sm" variant="outline">Reabrir análise</Button>
                  <Button size="sm" variant="ghost">Marcar pendência</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            {scores.map((c, idx) => (
              <CriterionRow
                key={c.key}
                data={c}
                onChange={(next) => setScores((prev) => prev.map((x, i) => (i === idx ? next : x)))}
              />
            ))}
          </div>

          {hasPending && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="w-4 h-4 text-warning-foreground" />
              <AlertTitle className="font-serif">Nota individual bloqueada</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                Um ou mais critérios estão marcados como "revisão humana necessária". O total permanece como <span className="font-medium">prévia provisória</span> e não pode ser exportado como definitivo.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="dossie">
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
                    <th className="text-right px-4 py-2 font-medium">Pág.</th>
                    <th className="text-right px-4 py-2 font-medium">Tamanho</th>
                    <th className="text-center px-4 py-2 font-medium">Versão</th>
                    <th className="text-center px-4 py-2 font-medium">Minimizado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mockFiles.map((f) => (
                    <tr key={f.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-2.5 font-mono text-xs">{f.nome}</td>
                      <td className="px-4 py-2.5 capitalize">{f.tipo}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.paginas}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.tamanhoKb} kB</td>
                      <td className="px-4 py-2.5 text-center font-mono">v{f.versao}</td>
                      <td className="px-4 py-2.5 text-center">
                        {f.minimizado ? (
                          <StatusBadge tone="success">redigido</StatusBadge>
                        ) : (
                          <StatusBadge tone="neutral">n/a</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evidencias">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Matriz de evidências
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EvidenceTable />
              <p className="text-xs text-muted-foreground mt-4">
                Toda nota deve ser sustentada por evidência com arquivo, versão, página e trecho. Ausência de comprovação é registrada sem ser transformada em afirmação de inexistência.
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
              <Textarea
                className="min-h-[420px] font-serif text-base leading-relaxed bg-card"
                defaultValue={`Parecer individual — Edital 119/2026 (PNAB Ciclo 2)
Proponente: ${p.nomeCanonico}
Categoria: ${p.categoria}
Avaliadora: Viviane da Rocha Palma · Contrato 2026/531

Fundamentação por critério:

A · Tempo de atuação em Caxias do Sul (proposta: ${scores[0].proposto}/20)
Primeiro ano comprovado nos autos: 2010, conforme matéria do jornal Pioneiro anexada ao portfólio (3 PORTFOLIO.pdf, p. 4). Considerando anos civis inclusivos até 2026, a proponente conta com 17 anos de atuação, aplicando-se a faixa de 16 a 20 anos.

B · Reconhecida atuação (proposta: ${scores[1].proposto}/50)
Trajetória contínua e diversificada, com ações comprovadas em diferentes anos e contextos culturais locais. Faixa 31–40 aplicada; não se identificou notoriedade em nível excepcional que justifique 41–50.

[…]

Observações e pendências: ${hasPending ? "há pendência humana aberta — nota individual permanece como prévia provisória." : "nenhuma pendência humana em aberto."}
`}
              />
              <div className="flex gap-2 mt-4">
                <Button>Salvar minuta</Button>
                <Button variant="outline">Exportar PDF</Button>
                <Button variant="ghost">Recompor com agentes</Button>
              </div>
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
              <ul className="space-y-3 text-sm">
                {AUDIT_TRAIL.map((e, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="text-xs text-muted-foreground font-mono w-32 shrink-0">{e.when}</div>
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{e.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
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

function ScoreOverview({ label, value, tone, pending }: {
  label: string; value: number;
  tone: "warning" | "success"; pending?: boolean;
}) {
  const cls = tone === "success" ? "text-success" : "text-warning-foreground";
  return (
    <Card className="border-border">
      <CardContent className="pt-5 pb-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className={`font-serif text-4xl ${cls}`}>{value}</span>
          <span className="text-sm text-muted-foreground">/ 110</span>
          {pending && <span className="ml-2 text-[10px] uppercase tracking-wider text-warning-foreground">prévia</span>}
        </div>
        <Progress value={(value / 110) * 100} className="h-1 mt-3" />
      </CardContent>
    </Card>
  );
}

function CriterionRow({ data, onChange }: {
  data: typeof criteria[number];
  onChange: (next: typeof criteria[number]) => void;
}) {
  return (
    <Card className="border-border">
      <CardContent className="py-4">
        <div className="grid grid-cols-[3rem_1fr_auto] gap-4 items-start">
          <div className="font-serif text-3xl text-primary text-center">{data.key}</div>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-medium">{data.label}</div>
              <div className="text-xs text-muted-foreground">máx. {data.max} · {data.evidencias} evidências</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.fundamentacao}</p>
            <div className="flex items-center gap-3 mt-3">
              <label className="text-xs text-muted-foreground">Proposta agentes</label>
              <span className="font-mono text-sm tabular-nums w-12 text-right">
                {data.proposto ?? "—"}<span className="text-[10px] text-muted-foreground">/{data.max}</span>
              </span>
              <label className="text-xs text-muted-foreground ml-4">Nota da avaliadora</label>
              <Input
                type="number"
                min={0}
                max={data.max}
                value={data.aprovado ?? ""}
                onChange={(e) => onChange({ ...data, aprovado: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-20 h-8 font-mono text-right"
              />
              <button
                type="button"
                onClick={() => onChange({ ...data, humanReviewRequired: !data.humanReviewRequired })}
                className={`ml-auto text-[11px] px-2 py-1 rounded border transition-colors ${
                  data.humanReviewRequired
                    ? "border-warning/50 bg-warning/15 text-warning-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {data.humanReviewRequired ? "pendência aberta" : "marcar pendência"}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            <StatusBadge tone={data.humanReviewRequired ? "warning" : "success"}>
              {data.humanReviewRequired ? "revisão humana" : "pronto"}
            </StatusBadge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceTable() {
  const rows = [
    { crit: "A", arq: "3 PORTFOLIO.pdf", pag: "p. 4", desc: "Matéria do Pioneiro cita atuação em 2010.", robustez: "alta" },
    { crit: "B", arq: "4 COMPROVANTES.pdf", pag: "p. 12–14", desc: "Programa oficial da 33ª Festa da Uva.", robustez: "alta" },
    { crit: "B", arq: "3 PORTFOLIO.pdf", pag: "p. 22", desc: "Cartaz de oficina 2019.", robustez: "media" },
    { crit: "C", arq: "4 COMPROVANTES.pdf", pag: "p. 41", desc: "Contrato com Secretaria Municipal de Educação.", robustez: "alta" },
    { crit: "D", arq: "3 PORTFOLIO.pdf", pag: "p. 30", desc: "Relato de projeto com mulheres em vulnerabilidade — sem comprovação externa.", robustez: "declaratoria" },
    { crit: "F", arq: "4 COMPROVANTES.pdf", pag: "p. 55", desc: "Cartaz de apresentação em Forqueta (bairro rural).", robustez: "media" },
  ];
  const toneOf: Record<string, "success" | "info" | "neutral"> = {
    alta: "success", media: "info", declaratoria: "neutral",
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
            <td className="px-2 py-2.5"><StatusBadge tone={toneOf[r.robustez]}>{r.robustez}</StatusBadge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const AUDIT_TRAIL = [
  { when: "14/03 · 12:04", title: "Sincronização automática", detail: "Nenhuma mudança neste dossiê." },
  { when: "14/03 · 10:22", title: "Agente 8 — Auditor emitiu relatório", detail: "Recálculo A–G confirmado. Nenhuma divergência." },
  { when: "14/03 · 09:47", title: "Agente 6 — Analista de Mérito Cultural", detail: "Nota proposta B=32, C=6, D=5, E=6. Evidências vinculadas." },
  { when: "14/03 · 09:11", title: "Agente 3 — Identidade e Minimização", detail: "Nome canônico validado por RG. Versões minimizadas geradas para 3 arquivos." },
  { when: "10/03 · 09:12", title: "Baseline criado", detail: "8 subpastas · 47 arquivos · hash raiz sha256:0af12c…" },
];
