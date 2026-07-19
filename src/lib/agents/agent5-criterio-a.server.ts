// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Agente 5 — Analista de Trajetória e Cronologia (Seção 17, Seção 10).
// Só recebe documentos de mérito (nunca identidade/GRP/Zimbra — Seção 5.6).
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callAgent } from "@/lib/ai-gateway.server";
import {
  checkUrl,
  describeLinkCheck,
  fetchProponentFiles,
  finishAgentRun,
  findFileByName,
  recordAgentOutput,
  startAgentRun,
  TIPOS_MERITO,
  toAgentFiles,
} from "./shared.server";

const SYSTEM_PROMPT = `Você é o Analista de Trajetória e Cronologia da plataforma PNAB Caxias — Avaliação Assistida.

Extraia datas, anos, ações e locais exclusivamente dos documentos anexados. Calcule o critério A por anos
civis inclusivos, considerando 2026 como ano inteiro: tempo = 2026 - ano_inicial + 1. Faixas oficiais:
até 5 anos = 5 pontos; 6 a 15 anos = 10 pontos; 16 a 20 anos = 15 pontos; mais de 20 anos = 20 pontos;
nenhuma atuação comprovada em Caxias do Sul = 0 pontos.

Compare o ano declarado no formulário com o primeiro ano efetivamente comprovado por documento (não
presuma continuidade por evidência isolada). Se houver divergência entre o declarado e o comprovado,
ou entre documentos, não decida sozinho — sinalize a divergência. Para cada evidência, cite arquivo e
página exatos. Quando não houver comprovação suficiente, use a redação padronizada de insuficiência.

Se o documento citar um link (ex.: "Assistir Aqui", URL de vídeo, rede social, matéria online), extraia
a URL exata no campo "url" da evidência correspondente. Você não tem como acessar o link nem assistir o
conteúdo — apenas registre que o proponente forneceu esse link como prova; o sistema vai verificar
separadamente se o link resolve. Nunca marque robustez "alta" para uma evidência cuja única base seja um
link não verificado por você — use "media".`;

const evidenceItemSchema = z.object({
  arquivo: z.string(),
  pagina_inicial: z.number().int().nullable(),
  pagina_final: z.number().int().nullable(),
  descricao_factual: z.string(),
  trecho_relevante: z.string().nullable(),
  ano_da_acao: z.number().int().nullable(),
  local: z.string().nullable(),
  url: z.string().nullable().optional(),
  robustez: z.enum(["alta", "media", "declaratoria"]),
});

const responseSchema = z.object({
  ano_declarado: z.number().int().nullable(),
  primeiro_ano_comprovado: z.number().int().nullable(),
  divergencia: z.boolean(),
  divergencia_descricao: z.string().nullable(),
  justification: z.string(),
  evidencias: z.array(evidenceItemSchema),
});

function computeCriterioA(primeiroAnoComprovado: number | null): { score: number; band: string } {
  if (primeiroAnoComprovado == null)
    return { score: 0, band: "nenhuma atuação comprovada em Caxias do Sul" };
  const tempo = 2026 - primeiroAnoComprovado + 1;
  if (tempo <= 5) return { score: 5, band: "até 5 anos" };
  if (tempo <= 15) return { score: 10, band: "6 a 15 anos" };
  if (tempo <= 20) return { score: 15, band: "16 a 20 anos" };
  return { score: 20, band: "mais de 20 anos" };
}

export async function runAgent5(
  supabase: SupabaseClient<Database>,
  proponentId: string,
  userId: string,
): Promise<{ score: number; band: string }> {
  const run = await startAgentRun(supabase, {
    proponentId,
    agentName: "agente_5_cronologia",
    model: "openai/gpt-5.5",
    triggeredBy: userId,
  });

  try {
    const files = await fetchProponentFiles(supabase, proponentId, [...TIPOS_MERITO]);

    const { data } = await callAgent({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Analise os documentos anexados e responda em JSON:
{"ano_declarado": 2010 ou null, "primeiro_ano_comprovado": 2010 ou null, "divergencia": true/false,
 "divergencia_descricao": "..." ou null, "justification": "...",
 "evidencias": [{"arquivo": "...", "pagina_inicial": 4, "pagina_final": 4, "descricao_factual": "...",
 "trecho_relevante": "...", "ano_da_acao": 2010, "local": "...", "robustez": "alta|media|declaratoria"}]}`,
      files: toAgentFiles(files),
      responseSchema,
    });

    const { score, band } = computeCriterioA(data.primeiro_ano_comprovado);

    await supabase
      .from("criterion_scores")
      .update({
        proposed_score: score,
        applied_band: band,
        justification: data.justification,
        human_review_required: data.divergencia,
      })
      .eq("proponent_id", proponentId)
      .eq("criterion", "A");

    for (const ev of data.evidencias) {
      const file = findFileByName(files, ev.arquivo);
      const observacoes = ev.url ? describeLinkCheck(await checkUrl(ev.url)) : null;
      await supabase.from("evidence").insert({
        proponent_id: proponentId,
        criterion: "A",
        file_id: file?.id ?? null,
        file_version_id: file?.versionId ?? null,
        tipo_documental: file?.tipoDocumental ?? null,
        pagina_inicial: ev.pagina_inicial,
        pagina_final: ev.pagina_final,
        descricao_factual: ev.descricao_factual,
        trecho_relevante: ev.trecho_relevante,
        ano_da_acao: ev.ano_da_acao,
        local: ev.local,
        observacoes,
        robustez: ev.robustez,
        criado_por_agente: "agente_5",
      });
    }

    if (data.divergencia) {
      await supabase.from("flags").insert({
        proponent_id: proponentId,
        tipo: "divergencia_documental",
        descricao: `Critério A: ${data.divergencia_descricao ?? "divergência entre ano declarado e comprovado."}`,
        criado_por_agente: "agente_5",
      });
    }

    await recordAgentOutput(supabase, run.id, "criterio_a", {
      ...data,
      computed_score: score,
      computed_band: band,
    });
    await finishAgentRun(supabase, run.id, "concluido");
    return { score, band };
  } catch (err) {
    await finishAgentRun(
      supabase,
      run.id,
      "erro",
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}
