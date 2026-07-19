import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, FolderOpen, Info, ShieldCheck } from "lucide-react";
import {
  useActiveDriveConnection,
  useDriveSource,
  useDisconnectGoogle,
  useLatestSyncRun,
  useRunBaseline,
  useRunSync,
  useSaveDriveSource,
  useStartGoogleOAuth,
} from "@/lib/queries/drive";

interface FonteSearch {
  connected?: string;
  google_error?: string;
  google_error_detail?: string;
}

export const Route = createFileRoute("/fonte-documental")({
  validateSearch: (search: Record<string, unknown>): FonteSearch => ({
    connected: typeof search.connected === "string" ? search.connected : undefined,
    google_error: typeof search.google_error === "string" ? search.google_error : undefined,
    google_error_detail:
      typeof search.google_error_detail === "string" ? search.google_error_detail : undefined,
  }),
  component: FonteDocumental,
});

const ERROR_LABEL: Record<string, string> = {
  missing_code: "O Google não retornou um código de autorização.",
  unauthorized: "Sua conta não tem papel de administradora — conexão recusada.",
  no_refresh_token:
    "O Google não devolveu um refresh token. Tente desconectar no Google e conectar de novo (prompt=consent já está ativo).",
  save_failed: "Falha ao salvar a conexão no banco.",
  access_denied: "Acesso negado na tela de consentimento do Google.",
  unexpected: "Erro inesperado durante a conexão.",
};

function FonteDocumental() {
  const search = Route.useSearch();
  const { data: connection, isLoading: loadingConnection } = useActiveDriveConnection();
  const { data: source } = useDriveSource(connection?.id);
  const { data: latestRun } = useLatestSyncRun(source?.id);
  const startOAuth = useStartGoogleOAuth();
  const disconnect = useDisconnectGoogle();
  const saveSource = useSaveDriveSource();
  const runBaseline = useRunBaseline();
  const runSync = useRunSync();

  const [folderInput, setFolderInput] = useState("");
  const [changingFolder, setChangingFolder] = useState(false);

  const stats = latestRun?.stats as
    | {
        subpastas: number;
        proponentesNovos: number;
        arquivosNovos: number;
        arquivosAlterados: number;
        arquivosRenomeados: number;
        arquivosMovidos: number;
        arquivosExcluidos: number;
        arquivosInalterados: number;
        avisos: string[];
      }
    | null
    | undefined;

  return (
    <AppShell
      title="Fonte documental"
      subtitle="Conecte a pasta compartilhada do Google Drive da SMC. A plataforma criará uma cópia privada e versionada."
    >
      {search.connected && (
        <Alert className="mb-4 border-success/30 bg-success/5">
          <CheckCircle2 className="w-4 h-4 text-success" />
          <AlertTitle className="font-serif">Conta Google conectada</AlertTitle>
        </Alert>
      )}
      {search.google_error && (
        <Alert className="mb-4 border-destructive/40 bg-destructive/5">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <AlertTitle className="font-serif">Falha na conexão</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            {ERROR_LABEL[search.google_error] ?? search.google_error}
            {search.google_error_detail && (
              <div className="mt-1 font-mono text-[11px] opacity-80">
                {search.google_error_detail}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" /> Conexão com Google Drive
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingConnection ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : connection ? (
                <div className="flex items-center gap-3 rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium text-foreground">Conta conectada</div>
                    <div className="text-xs text-muted-foreground">
                      escopo <span className="font-mono">drive.readonly</span> · desde{" "}
                      {new Date(connection.connected_at).toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnect.mutate(connection.id)}
                  >
                    Desconectar
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-md border border-border bg-secondary/40 px-4 py-3 text-sm">
                  <div className="flex-1 text-muted-foreground">
                    Nenhuma conta Google conectada.
                  </div>
                  <Button
                    size="sm"
                    disabled={startOAuth.isPending}
                    onClick={() => startOAuth.mutate()}
                  >
                    Conectar conta Google
                  </Button>
                </div>
              )}

              {connection && (
                <div className="space-y-2">
                  <Label>Pasta selecionada</Label>
                  {source && !changingFolder ? (
                    <div className="flex gap-2">
                      <Input
                        value={`${source.folder_name} (${source.drive_folder_id})`}
                        readOnly
                        className="bg-muted/40 font-mono text-xs"
                      />
                      <Button variant="outline" onClick={() => setChangingFolder(true)}>
                        Trocar pasta
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Cole a URL ou o ID da pasta do Drive"
                        value={folderInput}
                        onChange={(e) => setFolderInput(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        disabled={!folderInput || saveSource.isPending}
                        onClick={() =>
                          saveSource.mutate(
                            { connectionId: connection.id, folderUrlOrId: folderInput },
                            {
                              onSuccess: () => {
                                setChangingFolder(false);
                                setFolderInput("");
                              },
                            },
                          )
                        }
                      >
                        Salvar pasta
                      </Button>
                      {source && (
                        <Button variant="ghost" onClick={() => setChangingFolder(false)}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O acesso é feito exclusivamente pela conta OAuth conectada acima, com escopo{" "}
                    <span className="font-mono">drive.readonly</span>.
                  </p>
                </div>
              )}

              {source && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    disabled={runBaseline.isPending}
                    onClick={() => runBaseline.mutate(source.id)}
                  >
                    {runBaseline.isPending
                      ? "Criando baseline…"
                      : "Criar nova fotografia (baseline)"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={runSync.isPending}
                    onClick={() => runSync.mutate(source.id)}
                  >
                    {runSync.isPending ? "Sincronizando…" : "Sincronizar agora"}
                  </Button>
                </div>
              )}
              {(runBaseline.isError || runSync.isError) && (
                <p className="text-xs text-destructive">
                  {(runBaseline.error as Error | undefined)?.message ??
                    (runSync.error as Error | undefined)?.message}
                </p>
              )}
            </CardContent>
          </Card>

          {latestRun && (
            <Card>
              <CardHeader>
                <CardTitle className="font-serif text-lg">
                  {latestRun.kind === "baseline"
                    ? "Baseline documental (fotografia inicial)"
                    : "Última sincronização"}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <Field label="Status" value={latestRun.status} />
                <Field
                  label="Iniciado em"
                  value={new Date(latestRun.started_at).toLocaleString("pt-BR")}
                />
                <Field label="Subpastas" value={String(stats?.subpastas ?? 0)} />
                <Field label="Proponentes novos" value={String(stats?.proponentesNovos ?? 0)} />
                <Field label="Arquivos novos" value={String(stats?.arquivosNovos ?? 0)} />
                <Field label="Arquivos alterados" value={String(stats?.arquivosAlterados ?? 0)} />
                <Field
                  label="Renomeados / movidos"
                  value={`${stats?.arquivosRenomeados ?? 0} / ${stats?.arquivosMovidos ?? 0}`}
                />
                <Field label="Excluídos na fonte" value={String(stats?.arquivosExcluidos ?? 0)} />
                {latestRun.error_message && (
                  <div className="col-span-2 text-destructive text-xs">
                    {latestRun.error_message}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Alert>
            <ShieldCheck className="w-4 h-4" />
            <AlertTitle className="font-serif">Permissão mínima</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Escopo <span className="font-mono">drive.readonly</span> com uma conta Google dedicada
              — enxerga só o que essa conta tiver acesso, e a plataforma nunca altera nem exclui
              nada na fonte.
            </AlertDescription>
          </Alert>

          <Alert className="border-info/30 bg-info/5">
            <Info className="w-4 h-4 text-info" />
            <AlertTitle className="font-serif">Regras invioláveis</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground space-y-1.5 mt-2">
              <p>• A cópia privada nunca é excluída se um arquivo é removido na fonte.</p>
              <p>
                • Modificações criam nova versão — avaliações já aprovadas não mudam
                automaticamente.
              </p>
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
