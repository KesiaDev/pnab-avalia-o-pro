// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Agente 7 — Analista de Bônus F e G (Seção 17, Seções 13–14).
// Só recebe documentos de mérito (nunca identidade/GRP/Zimbra — Seção 5.6).
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callAgent } from "@/lib/ai-gateway.server";
import {
  checkUrl,
  describeLimitedProcessing,
  describeLinkCheck,
  fetchProponentFiles,
  finishAgentRun,
  findFileByName,
  getLimitedProcessingFiles,
  recordAgentOutput,
  startAgentRun,
  TIPOS_MERITO,
  toAgentFiles,
} from "./shared.server";

// 8 primeiros: Edital nº 119/2026. 3 últimos: parametrização complementar
// definida pela avaliadora, ainda sem validação formal da SMC (Seção 13).
const EXCLUDED_NEIGHBORHOODS = [
  "Centro",
  "Exposição",
  "São Pelegrino",
  "Rio Branco",
  "Nossa Senhora de Lourdes",
  "Santa Catarina",
  "Pio X",
  "Panazzolo",
  "Jardim América",
  "Madureira",
  "Universitário",
];

const SYSTEM_PROMPT = `Você é o Analista de Bônus da plataforma PNAB Caxias — Avaliação Assistida.

CRITÉRIO F (bônus territorial, binário: 5 ou 0 pontos). O local relevante é o local da AÇÃO CULTURAL, não a
residência do proponente. Bairros que NÃO qualificam automaticamente: ${EXCLUDED_NEIGHBORHOODS.join(", ")}.
Podem qualificar: outros bairros urbanos oficialmente reconhecidos, área rural, distrito, localidade rural,
território comprovadamente vulnerável, área de povos/comunidades tradicionais. Uma única ação qualificável
comprovada já é suficiente para os 5 pontos. Se houver só rua ou descrição ambígua do local, NÃO pesquise
livremente — marque "human_review_required": true e explique a ambiguidade na justificativa. Nunca
pesquise a internet para inferir o bairro.

CRITÉRIO G (bônus de ação afirmativa, binário: 5 ou 0 pontos). Depende EXCLUSIVAMENTE da autodeclaração do
formulário de inscrição (mulher ou pessoa LGBTQIAPN+ para Trajetória Individual). MEI inscrito na
Trajetória Individual é tratado como pessoa física — mesma regra. Nunca infira a condição por nome, foto
ou qualquer outro indício — só use o que está expressamente marcado no formulário.

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
  local: z.string().nullable(),
  bairro: z.string().nullable(),
  url: z.string().nullable().optional(),
  robustez: z.enum(["alta", "media", "declaratoria"]),
});

const bonusResultSchema = z.object({
  proposed_score: z.number().int(),
  justification: z.string(),
  human_review_required: z.boolean().default(false),
  evidencias: z.array(evidenceItemSchema),
});

const responseSchema = z.object({ F: bonusResultSchema, G: bonusResultSchema });

export async function runAgent7(
  supabase: SupabaseClient<Database>,
  proponentId: string,
  userId: string,
): Promise<Record<"F" | "G", number>> {
  const run = await startAgentRun(supabase, {
    proponentId,
    agentName: "agente_7_bonus",
    model: "openai/gpt-5.5",
    triggeredBy: userId,
  });

  try {
    const files = await fetchProponentFiles(supabase, proponentId, [...TIPOS_MERITO]);
    const limitedFiles = getLimitedProcessingFiles(files);
    const limitedReviewRequired = limitedFiles.length > 0;
    const limitedNote = limitedReviewRequired ? `${describeLimitedProcessing(files)}. ` : "";

    const { data } = await callAgent({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Analise os documentos anexados e avalie os bônus F e G. Responda em JSON:
{"F": {"proposed_score": 0 ou 5, "justification": "...", "human_review_required": false,
 "evidencias": [{"arquivo":"...","pagina_inicial":1,"pagina_final":1,"descricao_factual":"...","trecho_relevante":"...","local":"...","bairro":"..." ou null,"robustez":"alta|media|declaratoria"}]},
 "G": {"proposed_score": 0 ou 5, "justification": "...", "human_review_required": false, "evidencias": [...]}}`,
      files: toAgentFiles(files),
      responseSchema,
    });

    const scores: Record<"F" | "G", number> = { F: 0, G: 0 };

    for (const criterion of ["F", "G"] as const) {
      const result = data[criterion];
      const score = result.proposed_score >= 5 ? 5 : 0;
      scores[criterion] = score;

      await supabase
        .from("criterion_scores")
        .update({
          proposed_score: score,
          applied_band: score === 5 ? "comprovado" : "não comprovado",
          justification: `${limitedNote}${result.justification}`,
          human_review_required: result.human_review_required || limitedReviewRequired,
        })
        .eq("proponent_id", proponentId)
        .eq("criterion", criterion);

      for (const ev of result.evidencias) {
        const file = findFileByName(files, ev.arquivo);
        const observacoes = ev.url ? describeLinkCheck(await checkUrl(ev.url)) : null;
        await supabase.from("evidence").insert({
          proponent_id: proponentId,
          criterion,
          file_id: file?.id ?? null,
          file_version_id: file?.versionId ?? null,
          tipo_documental: file?.tipoDocumental ?? null,
          pagina_inicial: ev.pagina_inicial,
          pagina_final: ev.pagina_final,
          descricao_factual: ev.descricao_factual,
          trecho_relevante: ev.trecho_relevante,
          local: ev.local,
          bairro: ev.bairro,
          observacoes,
          robustez: ev.robustez,
          criado_por_agente: "agente_7",
        });
      }

      if (limitedReviewRequired) {
        await supabase.from("flags").insert({
          proponent_id: proponentId,
          tipo: "outro",
          descricao: `Critério ${criterion} requer revisão humana porque houve processamento limitado. ${describeLimitedProcessing(files)}.`,
          criado_por_agente: "agente_7",
        });
      }
    }

    await recordAgentOutput(supabase, run.id, "bonus_f_g", {
      ...data,
      computed_scores: scores,
      processamento_limitado: limitedFiles.map((file) => file.nome),
    });
    await finishAgentRun(supabase, run.id, "concluido");
    return scores;
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
