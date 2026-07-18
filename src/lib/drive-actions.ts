// Ponte RPC cliente↔servidor (createServerFn). Este arquivo é importado por
// código de cliente, então nunca importa os módulos *.server.ts no topo —
// só dentro do corpo de cada .handler(), via import() dinâmico, igual ao
// padrão já usado em client.server.ts.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireAdministradora(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "administradora",
  });
  if (error || !data) {
    throw new Error("Apenas a administradora pode executar esta ação.");
  }
}

export const startGoogleOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { buildGoogleAuthUrl } = await import("@/lib/google-oauth.server");
    return { url: buildGoogleAuthUrl(context.userId) };
  });

export const saveDriveSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { connectionId: string; folderUrlOrId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const supabase = context.supabase;
    const { extractFolderId, refreshAccessToken, decryptRefreshToken, pgByteaToBuffer } =
      await import("@/lib/google-oauth.server");
    const { getFolderName } = await import("@/lib/drive-import.server");

    const { data: connection, error: connError } = await supabase
      .from("drive_connections")
      .select("*")
      .eq("id", data.connectionId)
      .single();
    if (connError || !connection) throw new Error("Conexão não encontrada.");

    const folderId = extractFolderId(data.folderUrlOrId);
    const refreshToken = decryptRefreshToken(
      pgByteaToBuffer(connection.refresh_token_encrypted as unknown as string),
    );
    const { access_token: accessToken } = await refreshAccessToken(refreshToken);
    const folderName = await getFolderName(accessToken, folderId);

    const { data: source, error: sourceError } = await supabase
      .from("drive_sources")
      .insert({
        connection_id: data.connectionId,
        drive_folder_id: folderId,
        folder_name: folderName,
      })
      .select()
      .single();
    if (sourceError || !source) throw new Error("Não foi possível salvar a pasta-fonte.");

    return { source };
  });

export const runBaselineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { driveSourceId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { runImport } = await import("@/lib/drive-import.server");
    return runImport(context.supabase, {
      driveSourceId: data.driveSourceId,
      kind: "baseline",
      userId: context.userId,
    });
  });

export const runSyncFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { driveSourceId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { runImport } = await import("@/lib/drive-import.server");
    return runImport(context.supabase, {
      driveSourceId: data.driveSourceId,
      kind: "sync",
      userId: context.userId,
    });
  });

export const disconnectGoogleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { connectionId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("drive_connections")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.connectionId);
    if (error) throw new Error("Não foi possível desconectar.");
    return { ok: true };
  });

// Chamado a partir do beforeLoad da rota /api/google/oauth/callback — essa
// rota nunca importa *.server.ts diretamente, só esta server function.
export const handleGoogleOAuthCallback = createServerFn({ method: "GET" })
  .validator((data: { code?: string; state?: string; error?: string }) => data)
  .handler(async ({ data }) => {
    if (data.error) {
      return { ok: false as const, errorCode: data.error };
    }
    if (!data.code || !data.state) {
      return { ok: false as const, errorCode: "missing_code" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { exchangeCodeForTokens, encryptRefreshToken, bufferToPgBytea } =
      await import("@/lib/google-oauth.server");

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.state)
      .eq("role", "administradora")
      .maybeSingle();
    if (!roleRow) {
      return { ok: false as const, errorCode: "unauthorized" };
    }

    const tokens = await exchangeCodeForTokens(data.code);
    if (!tokens.refresh_token) {
      return { ok: false as const, errorCode: "no_refresh_token" };
    }

    const encrypted = bufferToPgBytea(encryptRefreshToken(tokens.refresh_token));
    const { error: insertError } = await supabaseAdmin.from("drive_connections").insert({
      connected_by: data.state,
      refresh_token_encrypted: encrypted as unknown as never,
      scope: tokens.scope,
    });
    if (insertError) {
      return { ok: false as const, errorCode: "save_failed" };
    }

    return { ok: true as const };
  });
