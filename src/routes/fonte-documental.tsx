import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, FolderOpen, Info, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/fonte-documental")({
  component: FonteDocumental,
});

function FonteDocumental() {
  return (
    <AppShell
      title="Fonte documental"
      subtitle="Conecte a pasta compartilhada do Google Drive da SMC. A plataforma criará uma cópia privada e versionada."
    >
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" /> Conexão com Google Drive
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="flex-1">
                  <div className="font-medium text-foreground">Conta conectada</div>
                  <div className="text-xs text-muted-foreground">viviane.avaliacao.pnab@gmail.com · escopo <span className="font-mono">drive.file</span></div>
                </div>
                <Button variant="outline" size="sm">Desconectar</Button>
              </div>

              <div className="space-y-2">
                <Label>Pasta selecionada</Label>
                <div className="flex gap-2">
                  <Input value="PNAB 119/2026 — Viviane (avaliadora)" readOnly className="bg-muted/40 font-mono text-xs" />
                  <Button variant="outline">Selecionar via Picker</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O link isolado da pasta não é suficiente. O acesso é feito exclusivamente pela conta OAuth autorizada acima.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button>Sincronizar agora</Button>
                <Button variant="outline">Criar nova fotografia (baseline)</Button>
                <Button variant="ghost">Validar acesso</Button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <Label className="text-sm">Verificação periódica</Label>
                  <p className="text-xs text-muted-foreground">Revarredura recursiva a cada 2h com relatório de mudanças.</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg">Baseline documental (fotografia inicial)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Field label="Iniciada por" value="Viviane da Rocha Palma" />
              <Field label="Data/hora" value="10/03/2026 · 09:12" />
              <Field label="Subpastas" value="8 proponentes" />
              <Field label="Arquivos" value="47 arquivos · 62,3 MB" />
              <Field label="Duplicados detectados" value="3" />
              <Field label="Acesso revogado" value="0" />
              <Field label="Divergências com planilha" value="1 (pendência administrativa)" />
              <Field label="Hash raiz" value="sha256:0af12c…" mono />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Alert>
            <ShieldCheck className="w-4 h-4" />
            <AlertTitle className="font-serif">Permissão mínima</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Usamos o escopo <span className="font-mono">drive.file</span> via Google Picker — apenas os itens selecionados são acessíveis. Se a enumeração recursiva exigir, oferecemos modo <span className="font-mono">drive.readonly</span> com aviso explícito.
            </AlertDescription>
          </Alert>

          <Alert className="border-info/30 bg-info/5">
            <Info className="w-4 h-4 text-info" />
            <AlertTitle className="font-serif">Regras invioláveis</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground space-y-1.5 mt-2">
              <p>• A cópia privada nunca é excluída se um arquivo é removido na fonte.</p>
              <p>• Modificações criam nova versão — avaliações já aprovadas não mudam automaticamente.</p>
              <p>• Novo arquivo em candidatura já avaliada gera bloqueio e revisão humana.</p>
              <p>• Nenhum arquivo do Drive é alterado ou excluído pela plataforma.</p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}
