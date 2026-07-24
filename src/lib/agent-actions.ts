// Ponte RPC cliente↔servidor (createServerFn) — mesmo padrão de drive-actions.ts:
// nunca importa *.server.ts no topo, só dentro do corpo de cada .handler().
//
// IMPORTANTE: cada agente é exposto como uma server function independente e o
// cliente chama uma por vez em sequência (ver useRunAgentPipeline). Rodar todos
// os agentes dentro de uma única server function estourava o limite de memória
// do Worker (502 "Worker exceeded memory limit"), porque cada agente baixa
// todos os PDFs do proponente em Buffer + base64 e o heap não era liberado
// entre um agente e outro. Com Workers separados, cada agente ganha memória
// limpa e falhas ficam isoladas por etapa.
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

// Marca como "erro" qualquer agent_run deixado "em_andamento" por mais de 5
// minutos (Worker morto sem passar pelo catch/finally). Sem isso, um 502 no
// meio da execução deixa a linha travada no histórico e o próximo run começa
// sobre um estado incoerente.
async function reapStuckRuns(supabase: SupabaseClient, proponentId: string) {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  await supabase
    .from("agent_runs")
    .update({
      status: "erro",
      finished_at: new Date().toISOString(),
      error_message:
        "Execução interrompida (provável timeout ou limite de memória do Worker). Reexecute os agentes.",
    })
    .eq("proponent_id", proponentId)
    .eq("status", "em_andamento")
    .lt("started_at", cutoff);
}

// Etapa 1 (orquestrador): verifica pré-condições, limpa runs órfãos e libera
// o cliente para chamar os demais agentes um a um.
export const startAgentPipelineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const supabase = context.supabase;
    const proponentId = data.proponentId;

    await reapStuckRuns(supabase, proponentId);

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

    return { ok: true as const, filesCount };
  });

export const runAgent3Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { runAgent3 } = await import("@/lib/agents/agent3-classification.server");
    return runAgent3(context.supabase, data.proponentId, context.userId);
  });

export const runAgent4Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { runAgent4 } = await import("@/lib/agents/agent4-ciclo1.server");
    return runAgent4(context.supabase, data.proponentId, context.userId);
  });

export const runAgent5Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { runAgent5 } = await import("@/lib/agents/agent5-criterio-a.server");
    return runAgent5(context.supabase, data.proponentId, context.userId);
  });

// Agente 6 avalia 4 critérios; expomos um por chamada para dar a cada critério
// um Worker próprio (mesmo motivo: base64 de PDFs pesa muito no heap).
export const runAgent6CriterionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string; criterion: "B" | "C" | "D" | "E" }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { runAgent6Criterion } = await import("@/lib/agents/agent6-merito.server");
    return runAgent6Criterion(context.supabase, data.proponentId, data.criterion, context.userId);
  });

export const runAgent7Fn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { runAgent7 } = await import("@/lib/agents/agent7-bonus.server");
    return runAgent7(context.supabase, data.proponentId, context.userId);
  });

// Fecha o pipeline: só muda status do proponente se ainda não estiver adiante.
export const finishAgentPipelineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const supabase = context.supabase;
    const { data: currentProponent } = await supabase
      .from("proponents")
      .select("status")
      .eq("id", data.proponentId)
      .single();
    if (
      currentProponent &&
      ["nao_importado", "importado", "inventariado", "em_analise"].includes(currentProponent.status)
    ) {
      await supabase
        .from("proponents")
        .update({ status: "avaliacao_proposta" })
        .eq("id", data.proponentId);
    }
    return { ok: true as const };
  });

// Agente 8 (Auditor e Relator) roda sozinho, separado do restante do squad —
// só depois que a avaliadora aprovou a avaliação (nota final definida por
// critério, sem pendência aberta). Rodar antes disso produzia uma minuta
// baseada na proposta dos agentes, que ficava desatualizada assim que a
// avaliadora ajustava alguma nota. Chamado automaticamente por
// useApproveEvaluation, e disponível também para regeneração manual.
export const generateParecerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { proponentId: string }) => data)
  .handler(async ({ context, data }) => {
    await requireAdministradora(context.supabase, context.userId);
    const { runAgent8 } = await import("@/lib/agents/agent8-auditor.server");
    return runAgent8(context.supabase, data.proponentId, context.userId);
  });
