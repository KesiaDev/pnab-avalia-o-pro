import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useActiveDriveConnection,
  useDriveSource,
  useRecentSyncChanges,
  useRunSync,
} from "@/lib/queries/drive";

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
  const { data: connection } = useActiveDriveConnection();
  const { data: source } = useDriveSource(connection?.id);
  const { data: changes, isLoading } = useRecentSyncChanges();
  const runSync = useRunSync();

  return (
    <AppShell
      title="Mudanças desde a última sincronização"
      subtitle="Relatório factual das diferenças detectadas na fonte. Nada altera notas automaticamente."
      actions={
        <Button
          size="sm"
          disabled={!source || runSync.isPending}
          onClick={() => source && runSync.mutate(source.id)}
        >
          {runSync.isPending ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      }
    >
      {!source && (
        <div className="mb-4 text-sm text-muted-foreground">
          Nenhuma pasta do Drive conectada ainda — configure em "Fonte documental".
        </div>
      )}
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
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Carregando…
                </td>
              </tr>
            )}
            {!isLoading && (changes ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhuma mudança registrada ainda.
                </td>
              </tr>
            )}
            {(changes ?? []).map((c) => (
              <tr key={c.id} className="hover:bg-secondary/20">
                <td className="px-4 py-3 font-medium">{LABEL[c.change_type] ?? c.change_type}</td>
                <td className="px-4 py-3">
                  {(c.proponents as { nome_canonico: string } | null)?.nome_canonico ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {(c.files as { nome: string } | null)?.nome ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {c.antes && c.depois ? (
                    <>
                      {c.antes} → <span className="text-foreground">{c.depois}</span>
                    </>
                  ) : (
                    (c.depois ?? c.antes ?? "—")
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(c.detectado_em).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-xs">{c.acao_necessaria ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
