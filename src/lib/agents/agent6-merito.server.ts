// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Agente 6 — Analista de Mérito Cultural (Seção 17, Seções 11–12).
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
  de transformação social não bastam para nota elevada.

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

const criterionResultSchema = z.object({
  proposed_score: z.number().int(),
  applied_band: z.string(),
  justification: z.string(),
  human_review_required: z.boolean().default(false),
  evidencias: z.array(evidenceItemSchema),
});

const MAX_SCORE: Record<"B" | "C" | "D" | "E", number> = { B: 50, C: 10, D: 10, E: 10 };

const CRITERION_INSTRUCTIONS: Record<"B" | "C" | "D" | "E", string> = {
  B: `Avalie APENAS o critério B (0 a 50). Responda em JSON no formato do critério pedido.`,
  C: `Avalie APENAS o critério C (0 a 10). Responda em JSON no formato do critério pedido.`,
  D: `Avalie APENAS o critério D (0 a 10). Responda em JSON no formato do critério pedido.`,
  E: `Avalie APENAS o critério E (0 a 10). Responda em JSON no formato do critério pedido.`,
};

function buildUserPrompt(criterion: "B" | "C" | "D" | "E"): string {
  const max = MAX_SCORE[criterion];
  return `${CRITERION_INSTRUCTIONS[criterion]}

Estrutura obrigatória da resposta:
{"proposed_score": 0-${max}, "applied_band": "...", "justification": "...", "human_review_required": false,
 "evidencias": [{"arquivo":"...","pagina_inicial":1,"pagina_final":1,"descricao_factual":"...","trecho_relevante":"...","ano_da_acao":2020,"local":"...","url":null,"robustez":"alta|media|declaratoria"}]}`;
}

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
    const agentFiles = toAgentFiles(files);

    const scores: Record<"B" | "C" | "D" | "E", number> = { B: 0, C: 0, D: 0, E: 0 };
    const perCriterionErrors: string[] = [];
    const combinedOutput: Record<string, unknown> = {};

    // Uma chamada por critério: payload menor, prompt focado e uma trava em
    // um critério não impede os outros de rodarem. Cada chamada tem seu
    // próprio timeout+retry no ai-gateway.
    for (const criterion of ["B", "C", "D", "E"] as const) {
      try {
        const { data } = await callAgent({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: buildUserPrompt(criterion),
          files: agentFiles,
          responseSchema: criterionResultSchema,
        });

        const clamped = Math.max(
          0,
          Math.min(MAX_SCORE[criterion], Math.round(data.proposed_score)),
        );
        scores[criterion] = clamped;
        combinedOutput[criterion] = data;

        await supabase
          .from("criterion_scores")
          .update({
            proposed_score: clamped,
            applied_band: data.applied_band,
            justification: data.justification,
            human_review_required: data.human_review_required || clamped !== data.proposed_score,
          })
          .eq("proponent_id", proponentId)
          .eq("criterion", criterion);

        for (const ev of data.evidencias) {
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
            ano_da_acao: ev.ano_da_acao,
            local: ev.local,
            observacoes,
            robustez: ev.robustez,
            criado_por_agente: "agente_6",
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        perCriterionErrors.push(`Critério ${criterion}: ${msg}`);
        combinedOutput[criterion] = { error: msg };
        // Marca o critério como pendente de revisão humana ao invés de deixar zero silencioso.
        await supabase
          .from("criterion_scores")
          .update({
            proposed_score: 0,
            applied_band: "não avaliado (falha do agente)",
            justification: `Falha automática: ${msg}. Avaliar manualmente.`,
            human_review_required: true,
          })
          .eq("proponent_id", proponentId)
          .eq("criterion", criterion);
      }
    }

    await recordAgentOutput(supabase, run.id, "merito_b_e", {
      ...combinedOutput,
      computed_scores: scores,
      errors: perCriterionErrors,
    });

    if (perCriterionErrors.length === 4) {
      await finishAgentRun(supabase, run.id, "erro", perCriterionErrors.join(" | "));
      throw new Error(`Todos os critérios de mérito falharam: ${perCriterionErrors.join(" | ")}`);
    }

    await finishAgentRun(
      supabase,
      run.id,
      "concluido",
      perCriterionErrors.length
        ? `Concluído com falhas parciais: ${perCriterionErrors.join(" | ")}`
        : undefined,
    );
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
