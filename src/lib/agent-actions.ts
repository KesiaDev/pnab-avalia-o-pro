// Ponte RPC cliente↔servidor (createServerFn) — mesmo padrão de drive-actions.ts:
// nunca importa *.server.ts no topo, só dentro do corpo de cada .handler().
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

// Agente 1 — Orquestrador: controle de sequência em TypeScript puro (mais
// confiável que IA para checar pré-condições e liberar as próximas etapas).
// Nunca analisa mérito por conta própria.
export const runAgentPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const supabase = context.supabase;
    const proponentId = data.proponentId;

    const { data: orchestratorRun } = await supabase
      .from("agent_runs")
      .insert({
        proponent_id: proponentId,
        agent_name: "agente_1_orquestrador",
        model: "n/a (determinístico)",
        prompt_version: "v1",
        triggered_by: context.userId,
      })
      .select()
      .single();

    const { count: filesCount } = await supabase
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("proponent_id", proponentId);

    if (!filesCount || filesCount === 0) {
      if (orchestratorRun) {
        await supabase
          .from("agent_runs")
          .update({
            status: "erro",
            finished_at: new Date().toISOString(),
            error_message: "Nenhum arquivo importado para este proponente — dossiê vazio.",
          })
          .eq("id", orchestratorRun.id);
      }
      throw new Error(
        "Nenhum arquivo importado para este proponente. Sincronize o Drive ou faça upload manual antes de executar os agentes.",
      );
    }

    if (orchestratorRun) {
      await supabase
        .from("agent_runs")
        .update({ status: "concluido", finished_at: new Date().toISOString() })
        .eq("id", orchestratorRun.id);
    }

    const results: Record<string, unknown> = {};

    const { runAgent3 } = await import("@/lib/agents/agent3-classification.server");
    results.agente3 = await runAgent3(supabase, proponentId, context.userId);

    const { runAgent4 } = await import("@/lib/agents/agent4-ciclo1.server");
    results.agente4 = await runAgent4(supabase, proponentId, context.userId);

    const { runAgent5 } = await import("@/lib/agents/agent5-criterio-a.server");
    results.agente5 = await runAgent5(supabase, proponentId, context.userId);

    const { runAgent6 } = await import("@/lib/agents/agent6-merito.server");
    results.agente6 = await runAgent6(supabase, proponentId, context.userId);

    const { runAgent7 } = await import("@/lib/agents/agent7-bonus.server");
    results.agente7 = await runAgent7(supabase, proponentId, context.userId);

    const { runAgent8 } = await import("@/lib/agents/agent8-auditor.server");
    results.agente8 = await runAgent8(supabase, proponentId, context.userId);

    const { data: currentProponent } = await supabase
      .from("proponents")
      .select("status")
      .eq("id", proponentId)
      .single();
    if (
      currentProponent &&
      ["nao_importado", "importado", "inventariado", "em_analise"].includes(currentProponent.status)
    ) {
      await supabase
        .from("proponents")
        .update({ status: "avaliacao_proposta" })
        .eq("id", proponentId);
    }

    return results;
  });
