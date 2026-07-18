// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Motor de importação/sincronização recursiva do Drive (Fase 2, Seções
// 5.3–5.5 do prompt-mestre). Roda com o cliente Supabase autenticado da
// própria administradora (RLS já garante que só ela pode chamar isso).
import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { decryptRefreshToken, pgByteaToBuffer, refreshAccessToken } from "./google-oauth.server";
import {
  downloadFileBinary,
  exportWorkspaceFileAsPdf,
  getFileMetadata,
  isFolder,
  isGoogleWorkspaceFile,
  walkFolderRecursive,
  type DriveFile,
} from "./google-drive-api.server";

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 200);
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

interface ImportStats {
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

export async function runImport(
  supabase: SupabaseClient<Database>,
  params: { driveSourceId: string; kind: "baseline" | "sync"; userId: string },
): Promise<{ syncRunId: string; stats: ImportStats }> {
  const { driveSourceId, kind, userId } = params;

  const { data: source, error: sourceError } = await supabase
    .from("drive_sources")
    .select("*, drive_connections(*)")
    .eq("id", driveSourceId)
    .single();
  if (sourceError || !source) throw new Error("Pasta-fonte não encontrada.");
  const connection = source.drive_connections as unknown as {
    refresh_token_encrypted: string;
  } | null;
  if (!connection) throw new Error("Conexão Google não encontrada para esta pasta.");

  const { data: run, error: runError } = await supabase
    .from("sync_runs")
    .insert({ drive_source_id: driveSourceId, kind, triggered_by: userId })
    .select()
    .single();
  if (runError || !run) throw new Error("Não foi possível iniciar o sync_run.");

  const stats: ImportStats = {
    subpastas: 0,
    proponentesNovos: 0,
    arquivosNovos: 0,
    arquivosAlterados: 0,
    arquivosRenomeados: 0,
    arquivosMovidos: 0,
    arquivosExcluidos: 0,
    arquivosInalterados: 0,
    avisos: [],
  };

  try {
    const refreshToken = decryptRefreshToken(pgByteaToBuffer(connection.refresh_token_encrypted));
    const { access_token: accessToken } = await refreshAccessToken(refreshToken);

    const items = await walkFolderRecursive(accessToken, source.drive_folder_id);
    const topLevelFolders = items.filter((i) => i.parentPath === "" && isFolder(i.file));
    stats.subpastas = topLevelFolders.length;

    // 1) reconciliar pasta → proponente (Seção 6)
    const folderToProponent = new Map<string, string>();
    for (const { file: folder } of topLevelFolders) {
      const { data: existingLink } = await supabase
        .from("source_folders")
        .select("proponent_id")
        .eq("drive_source_id", driveSourceId)
        .eq("drive_folder_id", folder.id)
        .maybeSingle();

      if (existingLink?.proponent_id) {
        folderToProponent.set(folder.id, existingLink.proponent_id);
        continue;
      }

      const { data: byName } = await supabase
        .from("proponents")
        .select("id")
        .ilike("nome_canonico", folder.name)
        .maybeSingle();

      let proponentId = byName?.id as string | undefined;

      if (!proponentId) {
        const { data: byAlias } = await supabase
          .from("proponent_aliases")
          .select("proponent_id")
          .ilike("alias", folder.name)
          .maybeSingle();
        proponentId = byAlias?.proponent_id as string | undefined;
      }

      if (!proponentId) {
        const { data: newProponent, error: newProponentError } = await supabase
          .from("proponents")
          .insert({ nome_canonico: folder.name, status: "importado", created_by: userId })
          .select()
          .single();
        if (newProponentError || !newProponent) {
          stats.avisos.push(`Falha ao criar proponente para a pasta "${folder.name}".`);
          continue;
        }
        proponentId = newProponent.id;
        await supabase
          .from("proponent_aliases")
          .insert({ proponent_id: proponentId, alias: folder.name, origem: "pasta" });
        stats.proponentesNovos += 1;
        if (kind === "sync") {
          await supabase.from("sync_changes").insert({
            sync_run_id: run.id,
            change_type: "novo_proponente",
            proponent_id: proponentId,
            depois: folder.name,
            acao_necessaria: "Distribuir e iniciar inventário",
          });
        }
      }

      await supabase.from("source_folders").upsert(
        {
          drive_source_id: driveSourceId,
          drive_folder_id: folder.id,
          nome_pasta: folder.name,
          caminho: `/${folder.name}`,
          proponent_id: proponentId,
        },
        { onConflict: "drive_source_id,drive_folder_id" },
      );
      folderToProponent.set(folder.id, proponentId);
    }

    // 2) processar arquivos (tudo que não é pasta)
    const runStartedAt = run.started_at;
    for (const item of items) {
      const { file } = item;
      if (isFolder(file)) continue;
      const proponentId = item.topLevelFolderId
        ? folderToProponent.get(item.topLevelFolderId)
        : undefined;
      if (!proponentId) {
        stats.avisos.push(
          `Arquivo "${file.name}" fora de uma pasta de proponente reconhecida — ignorado.`,
        );
        continue;
      }

      await processFile({
        supabase,
        accessToken,
        file,
        proponentId,
        caminhoRelativo: item.parentPath,
        userId,
        syncRunId: run.id,
        kind,
        stats,
      });
    }

    // 3) detectar exclusões na fonte (arquivos que não apareceram nesta varredura)
    if (kind === "sync") {
      const proponentIds = Array.from(new Set(folderToProponent.values()));
      if (proponentIds.length > 0) {
        const { data: possiblyDeleted } = await supabase
          .from("files")
          .select("id, nome, proponent_id, drive_seen_at")
          .in("proponent_id", proponentIds)
          .not("drive_file_id", "is", null)
          .lt("drive_seen_at", runStartedAt);

        for (const f of possiblyDeleted ?? []) {
          stats.arquivosExcluidos += 1;
          await supabase.from("sync_changes").insert({
            sync_run_id: run.id,
            change_type: "arquivo_excluido_fonte",
            proponent_id: f.proponent_id,
            file_id: f.id,
            antes: f.nome,
            acao_necessaria: "Cópia privada preservada — verificar com a SMC",
          });
        }
      }
    }

    await supabase
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "concluido",
        stats: stats as unknown as never,
      })
      .eq("id", run.id);

    return { syncRunId: run.id, stats };
  } catch (err) {
    await supabase
      .from("sync_runs")
      .update({
        finished_at: new Date().toISOString(),
        status: "erro",
        error_message: err instanceof Error ? err.message : String(err),
        stats: stats as unknown as never,
      })
      .eq("id", run.id);
    throw err;
  }
}

async function processFile(args: {
  supabase: SupabaseClient<Database>;
  accessToken: string;
  file: DriveFile;
  proponentId: string;
  caminhoRelativo: string;
  userId: string;
  syncRunId: string;
  kind: "baseline" | "sync";
  stats: ImportStats;
}) {
  const {
    supabase,
    accessToken,
    file,
    proponentId,
    caminhoRelativo,
    userId,
    syncRunId,
    kind,
    stats,
  } = args;
  const nowIso = new Date().toISOString();

  const { data: existing } = await supabase
    .from("files")
    .select("*, file_versions(*)")
    .eq("drive_file_id", file.id)
    .maybeSingle();

  const checksumChanged = existing && existing.drive_checksum !== (file.md5Checksum ?? null);
  const nameChanged = existing && existing.nome !== file.name;
  const pathChanged = existing && existing.caminho_relativo !== caminhoRelativo;

  if (!existing) {
    const binary = isGoogleWorkspaceFile(file)
      ? await exportWorkspaceFileAsPdf(accessToken, file.id)
      : await downloadFileBinary(accessToken, file.id);
    const hash = sha256(binary);
    const safeName = sanitizeFileName(file.name);
    const storagePath = `${proponentId}/${file.id}/v1-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("dossies-privados")
      .upload(storagePath, binary, {
        upsert: false,
        contentType: file.mimeType,
      });
    if (uploadError) {
      stats.avisos.push(`Falha ao subir "${file.name}": ${uploadError.message}`);
      return;
    }

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .insert({
        proponent_id: proponentId,
        nome: file.name,
        mime_type: file.mimeType,
        tipo_documental: "outro",
        storage_path: storagePath,
        drive_file_id: file.id,
        drive_modified_time: file.modifiedTime,
        drive_checksum: file.md5Checksum ?? null,
        caminho_relativo: caminhoRelativo,
        drive_seen_at: nowIso,
        created_by: userId,
      })
      .select()
      .single();
    if (fileError || !fileRow) {
      stats.avisos.push(`Falha ao registrar "${file.name}" no banco.`);
      return;
    }

    await supabase.from("file_versions").insert({
      file_id: fileRow.id,
      versao: 1,
      sha256: hash,
      tamanho_kb: Math.max(1, Math.round(binary.length / 1024)),
      storage_path: storagePath,
    });

    stats.arquivosNovos += 1;
    if (kind === "sync") {
      await supabase.from("sync_changes").insert({
        sync_run_id: syncRunId,
        change_type: "novo_arquivo",
        proponent_id: proponentId,
        file_id: fileRow.id,
        depois: file.name,
        acao_necessaria: "Reabrir análise",
      });
    }
    return;
  }

  if (checksumChanged) {
    const binary = isGoogleWorkspaceFile(file)
      ? await exportWorkspaceFileAsPdf(accessToken, file.id)
      : await downloadFileBinary(accessToken, file.id);
    const hash = sha256(binary);
    const safeName = sanitizeFileName(file.name);
    const maxVersao = Math.max(
      0,
      ...existing.file_versions.map((v: { versao: number }) => v.versao),
    );
    const novaVersao = maxVersao + 1;
    const storagePath = `${proponentId}/${file.id}/v${novaVersao}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("dossies-privados")
      .upload(storagePath, binary, {
        upsert: false,
        contentType: file.mimeType,
      });
    if (uploadError) {
      stats.avisos.push(`Falha ao subir nova versão de "${file.name}": ${uploadError.message}`);
      return;
    }

    await supabase.from("file_versions").insert({
      file_id: existing.id,
      versao: novaVersao,
      sha256: hash,
      tamanho_kb: Math.max(1, Math.round(binary.length / 1024)),
      storage_path: storagePath,
    });

    await supabase
      .from("files")
      .update({
        nome: file.name,
        drive_modified_time: file.modifiedTime,
        drive_checksum: file.md5Checksum ?? null,
        caminho_relativo: caminhoRelativo,
        drive_seen_at: nowIso,
      })
      .eq("id", existing.id);

    // Seção 5.5: arquivo novo/alterado em candidatura já avaliada gera
    // bloqueio e revisão humana — nunca muda a nota aprovada silenciosamente.
    const { data: evaluation } = await supabase
      .from("evaluations")
      .select("status")
      .eq("proponent_id", proponentId)
      .maybeSingle();
    let acao = "Reabrir análise";
    if (evaluation?.status === "aprovado_pela_avaliadora") {
      await supabase.from("proponents").update({ status: "bloqueado" }).eq("id", proponentId);
      await supabase
        .from("evaluations")
        .update({ status: "reaberto" })
        .eq("proponent_id", proponentId);
      await supabase
        .from("criterion_scores")
        .update({ human_review_required: true })
        .eq("proponent_id", proponentId);
      acao = "Bloquear e revisar avaliação já aprovada";
    }

    stats.arquivosAlterados += 1;
    if (kind === "sync") {
      await supabase.from("sync_changes").insert({
        sync_run_id: syncRunId,
        change_type: "arquivo_alterado",
        proponent_id: proponentId,
        file_id: existing.id,
        antes: `v${maxVersao}`,
        depois: `v${novaVersao}`,
        acao_necessaria: acao,
      });
    }
    return;
  }

  if (nameChanged) {
    await supabase
      .from("files")
      .update({ nome: file.name, caminho_relativo: caminhoRelativo, drive_seen_at: nowIso })
      .eq("id", existing.id);
    stats.arquivosRenomeados += 1;
    if (kind === "sync") {
      await supabase.from("sync_changes").insert({
        sync_run_id: syncRunId,
        change_type: "arquivo_renomeado",
        proponent_id: proponentId,
        file_id: existing.id,
        antes: existing.nome,
        depois: file.name,
        acao_necessaria: "Nenhuma — apenas registrar",
      });
    }
    return;
  }

  if (pathChanged) {
    await supabase
      .from("files")
      .update({ caminho_relativo: caminhoRelativo, drive_seen_at: nowIso })
      .eq("id", existing.id);
    stats.arquivosMovidos += 1;
    if (kind === "sync") {
      await supabase.from("sync_changes").insert({
        sync_run_id: syncRunId,
        change_type: "arquivo_movido",
        proponent_id: proponentId,
        file_id: existing.id,
        antes: existing.caminho_relativo ?? "",
        depois: caminhoRelativo,
        acao_necessaria: "Nenhuma — apenas registrar",
      });
    }
    return;
  }

  await supabase.from("files").update({ drive_seen_at: nowIso }).eq("id", existing.id);
  stats.arquivosInalterados += 1;
}

export async function getFolderName(accessToken: string, folderId: string): Promise<string> {
  const meta = await getFileMetadata(accessToken, folderId);
  return meta.name;
}
