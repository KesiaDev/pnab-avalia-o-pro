import { createFileRoute } from "@tanstack/react-router";
import { AppShell, StatusBadge } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auditoria")({
  component: Auditoria,
});

const AGENTS = [
  { n: 1, nome: "Orquestrador", papel: "Controla estados e distribui tarefas.", status: "ativo" as const },
  { n: 2, nome: "Ingestão, Integridade e Versionamento", papel: "Importa, cataloga e versiona documentos.", status: "ativo" as const },
  { n: 3, nome: "Identidade, Minimização e Conformidade", papel: "Confere identidade e gera versões minimizadas (PII redigido).", status: "ativo" as const },
  { n: 4, nome: "Verificador de Impedimentos", papel: "Checa Ciclo 1 (Edital 231/2024). Ignora Edital 223/2024.", status: "ativo" as const },
  { n: 5, nome: "Analista de Trajetória e Cronologia", papel: "Extrai linha do tempo e avalia critério A.", status: "ativo" as const },
  { n: 6, nome: "Analista de Mérito Cultural", papel: "Avalia B, C, D e E — sem inferir impactos.", status: "ativo" as const },
  { n: 7, nome: "Analista de Bônus F e G", papel: "Territorial e ação afirmativa; MEI da Trajetória Individual = pessoa física.", status: "ativo" as const },
  { n: 8, nome: "Auditor e Relator", papel: "Recalcula, verifica coerência e gera minuta de parecer.", status: "ativo" as const },
];

function Auditoria() {
  return (
    <AppShell
      title="Auditoria e squad de agentes"
      subtitle="Cada agente tem escopo mínimo. Agentes de mérito recebem apenas versões minimizadas dos documentos."
    >
      <div className="grid grid-cols-2 gap-4">
        {AGENTS.map((a) => (
          <Card key={a.n} className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base flex items-center gap-3">
                <span className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-mono text-sm">
                  {a.n}
                </span>
                <span>{a.nome}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{a.papel}</p>
              <div className="mt-3 flex items-center gap-2">
                <StatusBadge tone="success">
                  <ShieldCheck className="w-3 h-3 mr-1 inline" /> {a.status}
                </StatusBadge>
                <span className="text-[11px] text-muted-foreground">Saída JSON validada</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-border bg-card px-6 py-5">
        <h3 className="font-serif text-lg text-foreground">Princípios inegociáveis</h3>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground max-w-3xl">
          <li>• Agentes nunca inventam fatos, presumem datas/locais/públicos ou inferem atributos pessoais.</li>
          <li>• Fonte exclusiva: inscrição, portfólio, comprobatórios, links declarados e documentos normativos versionados.</li>
          <li>• Ausência de comprovação nunca vira afirmação de inexistência.</li>
          <li>• Nenhuma nota se torna definitiva sem aprovação humana expressa da avaliadora.</li>
          <li>• A plataforma não decide classificação, cotas, média entre avaliadores ou homologação.</li>
        </ul>
      </div>
    </AppShell>
  );
}
