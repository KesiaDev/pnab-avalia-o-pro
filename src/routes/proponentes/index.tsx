import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { proponents, STATUS_LABEL, STATUS_TONE } from "@/lib/mock-data";
import { Search, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/proponentes/")({
  component: ProponentesList,
});

function ProponentesList() {
  return (
    <AppShell
      title="Proponentes"
      subtitle="Dossiês atribuídos à avaliadora. Cada linha abre o dossiê completo com evidências, avaliação A–G e auditoria."
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filtrar por nome, alias, categoria…" className="pl-9 bg-card" />
        </div>
        <div className="text-xs text-muted-foreground">{proponents.length} proponentes</div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-secondary/50 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-4 py-3 font-medium">Proponente</th>
              <th className="text-left px-4 py-3 font-medium">Categoria</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-center px-4 py-3 font-medium">Alerta</th>
              <th className="text-center px-4 py-3 font-medium">Pend.</th>
              <th className="text-right px-4 py-3 font-medium">Nota proposta</th>
              <th className="text-right px-4 py-3 font-medium">Nota aprovada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {proponents.map((p) => (
              <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3">
                  <Link to={"/proponentes/$id" as string} params={{ id: p.id }} className="font-medium hover:underline">
                    {p.nomeCanonico}
                  </Link>
                  {p.aliases.length > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      alias: {p.aliases.join(" · ")}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.categoria}</td>
                <td className="px-4 py-3"><StatusBadge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</StatusBadge></td>
                <td className="px-4 py-3 text-center">
                  {p.ciclo1Alerta ? (
                    <StatusBadge tone="danger">
                      <ShieldAlert className="w-3 h-3 mr-1 inline" />
                      {p.ciclo1Alerta}
                    </StatusBadge>
                  ) : (
                    <span className="text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center font-mono tabular-nums">
                  {p.pendencias > 0 ? <span className="text-warning-foreground font-medium">{p.pendencias}</span> : <span className="text-muted-foreground/50">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {p.notaProposta != null ? <span>{p.notaProposta}<span className="text-[10px] text-muted-foreground">/110</span></span> : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {p.notaAprovada != null ? <span className="text-success font-semibold">{p.notaAprovada}<span className="text-[10px] text-muted-foreground">/110</span></span> : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
