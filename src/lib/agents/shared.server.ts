// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Utilitários compartilhados por todos os agentes: baixar arquivos do
// proponente do bucket privado, e registrar execução em agent_runs/agent_outputs.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AgentFile } from "@/lib/ai-gateway.server";

const BUCKET = "dossies-privados";

export async function startAgentRun(
  supabase: SupabaseClient<Database>,
  params: { proponentId: string; agentName: string; model: string; triggeredBy: string },
) {
  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      proponent_id: params.proponentId,
      agent_name: params.agentName,
      model: params.model,
      prompt_version: "v1",
      triggered_by: params.triggeredBy,
    })
    .select()
    .single();
  if (error || !data)
    throw new Error(`Não foi possível iniciar o agent_run de ${params.agentName}.`);
  return data;
}

export async function finishAgentRun(
  supabase: SupabaseClient<Database>,
  runId: string,
  status: "concluido" | "erro",
  errorMessage?: string,
) {
  await supabase
    .from("agent_runs")
    .update({ status, finished_at: new Date().toISOString(), error_message: errorMessage ?? null })
    .eq("id", runId);
}

export async function recordAgentOutput(
  supabase: SupabaseClient<Database>,
  runId: string,
  outputType: string,
  payload: unknown,
) {
  await supabase
    .from("agent_outputs")
    .insert({ agent_run_id: runId, output_type: outputType, payload: payload as never });
}

export interface ProponentFile {
  id: string;
  versionId: string | null;
  nome: string;
  mimeType: string;
  tipoDocumental: string;
  data: Buffer;
}

// Documentos de identidade (identidade/grp/zimbra) só vão para o Agente 3.
// Agentes de mérito (5, 6, 7) nunca recebem esses tipos — Seção 5.6.
export async function fetchProponentFiles(
  supabase: SupabaseClient<Database>,
  proponentId: string,
  tiposPermitidos?: string[],
): Promise<ProponentFile[]> {
  let query = supabase.from("files").select("*, file_versions(*)").eq("proponent_id", proponentId);
  if (tiposPermitidos) {
    query = query.in("tipo_documental", tiposPermitidos);
  }
  const { data: files, error } = await query;
  if (error || !files) throw new Error("Não foi possível carregar os arquivos do proponente.");

  const result: ProponentFile[] = [];
  for (const file of files) {
    const versions = (file.file_versions ?? []) as Array<{
      id: string;
      versao: number;
      storage_path: string;
    }>;
    const latest = versions.sort((a, b) => b.versao - a.versao)[0];
    const storagePath = latest?.storage_path ?? file.storage_path;
    const { data: blob, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(storagePath);
    if (downloadError || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    result.push({
      id: file.id,
      versionId: latest?.id ?? null,
      nome: file.nome,
      mimeType: file.mime_type ?? "application/octet-stream",
      tipoDocumental: file.tipo_documental,
      data: buffer,
    });
  }
  return result;
}

export function toAgentFiles(files: ProponentFile[]): AgentFile[] {
  return files.map((f) => ({ name: f.nome, mimeType: f.mimeType, data: f.data }));
}

export function findFileByName(files: ProponentFile[], nome: string): ProponentFile | undefined {
  const normalized = nome.trim().toLowerCase();
  return files.find((f) => f.nome.trim().toLowerCase() === normalized);
}

// Tipos de documento liberados para os agentes de mérito (nunca identidade/grp/zimbra).
export const TIPOS_MERITO = ["formulario", "portfolio", "comprobatorio", "outro"] as const;
