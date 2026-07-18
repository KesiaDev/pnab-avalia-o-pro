import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normativeDocs } from "@/lib/mock-data";
import { BookMarked } from "lucide-react";

export const Route = createFileRoute("/documentos-normativos")({
  component: DocsNormativos,
});

function DocsNormativos() {
  return (
    <AppShell
      title="Documentos normativos"
      subtitle="Biblioteca versionada. Toda avaliação registra quais versões normativas foram utilizadas."
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-primary" /> Documentos vigentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 border-y border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Documento</th>
                <th className="text-left px-4 py-2 font-medium">Versão</th>
                <th className="text-left px-4 py-2 font-medium">Data</th>
                <th className="text-left px-4 py-2 font-medium">Hash</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {normativeDocs.map((d) => (
                <tr key={d.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-3 font-medium">{d.titulo}</td>
                  <td className="px-4 py-3 font-mono text-xs">{d.versao}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.data}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.hash}</td>
                  <td className="px-4 py-3"><StatusBadge tone={d.status === "vigente" ? "success" : "neutral"}>{d.status}</StatusBadge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4 max-w-3xl">
        Regras: apenas as páginas referentes ao Edital nº 231/2024 são usadas para checagem do Ciclo 1. A lista do Edital nº 223/2024 não é utilizada para impedimento. Qualquer atualização gera nova versão e preserva a anterior.
      </p>
    </AppShell>
  );
}
