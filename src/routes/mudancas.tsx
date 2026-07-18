import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockChanges } from "@/lib/mock-data";

export const Route = createFileRoute("/mudancas")({
  component: Mudancas,
});

const LABEL: Record<string, string> = {
  novo_proponente: "Novo proponente",
  novo_arquivo: "Novo arquivo",
  arquivo_alterado: "Arquivo alterado",
  arquivo_renomeado: "Arquivo renomeado",
  arquivo_movido: "Arquivo movido",
  arquivo_excluido_fonte: "Excluído na fonte",
  acesso_revogado: "Acesso revogado",
};

function Mudancas() {
  return (
    <AppShell
      title="Mudanças desde a última sincronização"
      subtitle="Relatório factual das diferenças detectadas na fonte. Nada altera notas automaticamente."
      actions={<Button size="sm">Sincronizar agora</Button>}
    >
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Mudança</th>
              <th className="text-left px-4 py-3 font-medium">Proponente</th>
              <th className="text-left px-4 py-3 font-medium">Arquivo</th>
              <th className="text-left px-4 py-3 font-medium">Antes → Depois</th>
              <th className="text-left px-4 py-3 font-medium">Detectado</th>
              <th className="text-left px-4 py-3 font-medium">Ação necessária</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockChanges.map((c) => (
              <tr key={c.id} className="hover:bg-secondary/20">
                <td className="px-4 py-3 font-medium">{LABEL[c.tipo] ?? c.tipo}</td>
                <td className="px-4 py-3">{c.proponente}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.arquivo ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {c.antes && c.depois ? <>{c.antes} → <span className="text-foreground">{c.depois}</span></> : "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.detectadoEm).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 text-xs">{c.acao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
