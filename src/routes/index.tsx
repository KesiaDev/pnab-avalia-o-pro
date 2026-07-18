import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { proponents, STATUS_LABEL, STATUS_TONE, mockChanges } from "@/lib/mock-data";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, FileWarning, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const total = proponents.length;
  const aprovados = proponents.filter((p) => p.status === "aprovado_pela_avaliadora" || p.status === "finalizado").length;
  const pendencias = proponents.filter((p) => p.pendencias > 0).length;
  const bloqueados = proponents.filter((p) => p.status === "bloqueado").length;

  return (
    <AppShell
      title="Painel da avaliadora"
      subtitle="Visão geral dos dossiês distribuídos, pendências humanas e mudanças recentes na fonte."
      actions={
        <Button asChild>
          <Link to={"/fonte-documental" as string}>Sincronizar Drive</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Proponentes atribuídos" value={String(total)} hint="Edital 119/2026" />
        <StatCard label="Aprovados pela avaliadora" value={`${aprovados}/${total}`} hint={`${Math.round((aprovados / total) * 100)}% concluído`} tone="success" progress={(aprovados / total) * 100} />
        <StatCard label="Com pendência humana" value={String(pendencias)} hint="Requerem revisão" tone="warning" />
        <StatCard label="Bloqueados / impedimentos" value={String(bloqueados)} hint="Alerta Ciclo 1" tone="danger" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2 border-border">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-serif text-lg">Fila de trabalho</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={"/proponentes" as string} className="text-xs">
                Ver todos <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {proponents.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to={"/proponentes/$id" as string}
                  params={{ id: p.id }}
                  className="flex items-center gap-4 px-6 py-3.5 hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.nomeCanonico}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.categoria}</div>
                  </div>
                  {p.ciclo1Alerta && (
                    <StatusBadge tone="danger">
                      <ShieldAlert className="w-3 h-3 mr-1 inline" />
                      Ciclo 1 · {p.ciclo1Alerta}
                    </StatusBadge>
                  )}
                  <StatusBadge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusBadge>
                  <div className="w-16 text-right font-mono text-sm tabular-nums">
                    {p.notaAprovada != null ? (
                      <span className="text-success font-medium">{p.notaAprovada}</span>
                    ) : p.notaProposta != null ? (
                      <span className="text-warning-foreground">~{p.notaProposta}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">/110</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-serif text-lg">Mudanças recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to={"/mudancas" as string} className="text-xs">
                Detalhes <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockChanges.slice(0, 5).map((c) => (
              <div key={c.id} className="flex gap-3 text-sm">
                <ChangeIcon type={c.tipo} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.proponente}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.arquivo ?? "novo dossiê"} · {c.acao}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 rounded-lg border border-warning/40 bg-warning/10 px-5 py-4 flex gap-4 items-start">
        <AlertTriangle className="w-5 h-5 text-warning-foreground shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-medium text-foreground">Nenhuma nota final pode ser fechada com pendência humana aberta.</div>
          <p className="text-muted-foreground mt-1">
            Os totais exibidos nas avaliações permanecem como <span className="font-medium">prévia provisória</span> enquanto qualquer critério A–G estiver com revisão humana pendente. A nota individual só se torna definitiva após aprovação expressa da avaliadora.
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, hint, tone = "neutral", progress }: {
  label: string; value: string; hint?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  progress?: number;
}) {
  const accent = {
    neutral: "text-foreground",
    success: "text-success",
    warning: "text-warning-foreground",
    danger: "text-destructive",
  }[tone];
  return (
    <Card className="border-border">
      <CardContent className="pt-5 pb-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
        <div className={`font-serif text-3xl mt-2 ${accent}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        {progress != null && <Progress value={progress} className="h-1 mt-3" />}
      </CardContent>
    </Card>
  );
}

function ChangeIcon({ type }: { type: string }) {
  const map: Record<string, { icon: typeof CheckCircle2; className: string }> = {
    novo_proponente: { icon: CheckCircle2, className: "text-info bg-info/10" },
    novo_arquivo: { icon: FileWarning, className: "text-warning-foreground bg-warning/15" },
    arquivo_alterado: { icon: AlertTriangle, className: "text-warning-foreground bg-warning/15" },
    arquivo_renomeado: { icon: Clock, className: "text-muted-foreground bg-muted" },
    arquivo_excluido_fonte: { icon: ShieldAlert, className: "text-destructive bg-destructive/10" },
  };
  const { icon: Icon, className } = map[type] ?? map.arquivo_renomeado;
  return (
    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${className}`}>
      <Icon className="w-4 h-4" />
    </div>
  );
}
