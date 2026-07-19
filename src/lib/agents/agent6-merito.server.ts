// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Agente 6 — Analista de Mérito Cultural (Seção 17, Seções 11–12).
// Só recebe documentos de mérito (nunca identidade/GRP/Zimbra — Seção 5.6).
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callAgent } from "@/lib/ai-gateway.server";
import {
  fetchProponentFiles,
  finishAgentRun,
  findFileByName,
  recordAgentOutput,
  startAgentRun,
  TIPOS_MERITO,
  toAgentFiles,
} from "./shared.server";

const SYSTEM_PROMPT = `Você é o Analista de Mérito Cultural da plataforma PNAB Caxias — Avaliação Assistida.

Avalie os critérios B, C, D e E conforme as réguas oficiais abaixo. Use somente os documentos anexados.
Não conte a mesma ação mais de uma vez (deduplique ações citadas em vários arquivos). Não use volume de
páginas como mérito. Não infira impactos que não estejam documentados. Comparações com a trajetória de
outros proponentes podem ser usadas exclusivamente para calibrar qual faixa se aplica dentro da régua
oficial — nunca para acrescentar fatos que não constem nos documentos deste proponente. A identidade
pessoal do proponente não gera automaticamente nota no critério D; nunca infira atributos por foto, nome
ou aparência. Quando não houver comprovação suficiente, use a redação padronizada de insuficiência.

CRITÉRIO B — Reconhecida atuação na categoria cultural (máximo 50). Considere pertinência à categoria,
trajetória, ações em Caxias do Sul, continuidade, regularidade, diversidade, alcance, reconhecimento,
coerência entre fontes. Não repita automaticamente o tempo do critério A. Faixas: 0 = nenhuma atuação
comprovada; 1–10 = muito incipiente/isolada; 11–20 = limitada, poucas ações; 21–30 = consistente, com
relevância local identificável; 31–40 = forte, contínua, diversificada e reconhecida; 41–50 = excepcional
e notória, amplamente comprovada.

CRITÉRIOS C, D, E — escala 0 a 10 cada. 0 = não comprovado; 1–2 = incipiente/isolado; 3–4 = limitado/
esporádico; 5–6 = consistente e recorrente; 7–8 = forte, contínuo, claramente demonstrado; 9–10 = notório,
central à trajetória, robustamente comprovado.
- C (integração e inovação): relação entre cultura e educação, saúde, assistência social, meio ambiente,
  esporte, turismo, patrimônio, tecnologia, desenvolvimento comunitário. Não presuma integração só pelo
  perfil do público.
- D (grupos e temáticas sociais): atuação comprovada com pessoas negras, povos indígenas, pessoas com
  deficiência, mulheres, pessoas LGBTQIAPN+, idosos, crianças, grupos em vulnerabilidade.
- E (contribuição comunitária): ações dentro da comunidade, parceria comunitária, formação de agentes,
  contratação de profissionais, criação de trabalho e renda, ampliação de acesso. Declarações genéricas
  de transformação social não bastam para nota elevada.`;

const evidenceItemSchema = z.object({
  arquivo: z.string(),
  pagina_inicial: z.number().int().nullable(),
  pagina_final: z.number().int().nullable(),
  descricao_factual: z.string(),
  trecho_relevante: z.string().nullable(),
  ano_da_acao: z.number().int().nullable(),
  local: z.string().nullable(),
  robustez: z.enum(["alta", "media", "declaratoria"]),
});

const criterionResultSchema = z.object({
  proposed_score: z.number().int(),
  applied_band: z.string(),
  justification: z.string(),
  human_review_required: z.boolean().default(false),
  evidencias: z.array(evidenceItemSchema),
});

const responseSchema = z.object({
  B: criterionResultSchema,
  C: criterionResultSchema,
  D: criterionResultSchema,
  E: criterionResultSchema,
});

const MAX_SCORE: Record<"B" | "C" | "D" | "E", number> = { B: 50, C: 10, D: 10, E: 10 };

export async function runAgent6(
  supabase: SupabaseClient<Database>,
  proponentId: string,
  userId: string,
): Promise<Record<"B" | "C" | "D" | "E", number>> {
  const run = await startAgentRun(supabase, {
    proponentId,
    agentName: "agente_6_merito",
    model: "openai/gpt-5.5",
    triggeredBy: userId,
  });

  try {
    const files = await fetchProponentFiles(supabase, proponentId, [...TIPOS_MERITO]);

    const { data } = await callAgent({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Analise os documentos anexados e avalie os critérios B, C, D e E. Responda em JSON:
{"B": {"proposed_score": 0-50, "applied_band": "...", "justification": "...", "human_review_required": false,
 "evidencias": [{"arquivo":"...","pagina_inicial":1,"pagina_final":1,"descricao_factual":"...","trecho_relevante":"...","ano_da_acao":2020,"local":"...","robustez":"alta|media|declaratoria"}]},
 "C": {... mesma estrutura, 0-10}, "D": {... mesma estrutura, 0-10}, "E": {... mesma estrutura, 0-10}}`,
      files: toAgentFiles(files),
      responseSchema,
    });

    const scores: Record<"B" | "C" | "D" | "E", number> = { B: 0, C: 0, D: 0, E: 0 };

    for (const criterion of ["B", "C", "D", "E"] as const) {
      const result = data[criterion];
      const clamped = Math.max(
        0,
        Math.min(MAX_SCORE[criterion], Math.round(result.proposed_score)),
      );
      scores[criterion] = clamped;

      await supabase
        .from("criterion_scores")
        .update({
          proposed_score: clamped,
          applied_band: result.applied_band,
          justification: result.justification,
          human_review_required: result.human_review_required || clamped !== result.proposed_score,
        })
        .eq("proponent_id", proponentId)
        .eq("criterion", criterion);

      for (const ev of result.evidencias) {
        const file = findFileByName(files, ev.arquivo);
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
          ano_da_acao: ev.ano_da_acao,
          local: ev.local,
          robustez: ev.robustez,
          criado_por_agente: "agente_6",
        });
      }
    }

    await recordAgentOutput(supabase, run.id, "merito_b_e", { ...data, computed_scores: scores });
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
