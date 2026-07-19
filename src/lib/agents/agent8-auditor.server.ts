// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Agente 8 — Auditor e Relator (Seção 17, Seção 19). Não relê PDFs: trabalha
// sobre as notas e evidências já produzidas pelos agentes 5, 6 e 7.
// A checagem "toda nota tem evidência vinculada" é determinística (código),
// não IA — mais confiável para uma contagem simples. A IA só é usada para
// redigir a minuta de parecer e apontar divergências qualitativas.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callAgent } from "@/lib/ai-gateway.server";
import { finishAgentRun, recordAgentOutput, startAgentRun } from "./shared.server";

const SYSTEM_PROMPT = `Você é redator de pareceres técnicos e escreve na primeira pessoa, na voz da própria avaliadora
responsável pelo Edital nº 119/2026 (PNAB Ciclo 2) da plataforma PNAB Caxias — Avaliação Assistida.

Com base exclusivamente no resumo de notas e evidências fornecido (não invente nada além disso), redija a
minuta de parecer individual, seguindo esta estrutura: (1) delimitação da análise, (2) síntese da trajetória
comprovada, (3) fundamentos de cada critério, (4) potencialidades, (5) limitações documentais, (6) eventuais
alertas, (7) nota individual.

A abertura do parecer deve ser exatamente: "A avaliação foi realizada com base exclusivamente nas
informações e nos documentos apresentados pelo agente cultural no ato da inscrição."

Nunca mencione comparação nominal com outros candidatos. Nunca exponha CPF, RG, endereço, telefone, e-mail
ou dados bancários — o resumo fornecido já não contém esses dados. Não chame a nota individual de "média
final".

Este parecer é um documento técnico definitivo, redigido para envio ao contratante. Nunca mencione, em
nenhuma seção, processos internos de elaboração: não escreva sobre inteligência artificial, automação,
agentes, "pendência de revisão humana", "prévia provisória", nem qualquer outra referência ao fluxo de
trabalho usado para chegar às notas. Trate cada nota do resumo como a nota já considerada pela avaliadora.
A seção (6) "eventuais alertas" é reservada a achados substantivos sobre o próprio dossiê do proponente —
por exemplo, indício de correspondência com o Ciclo 1, divergência factual relevante entre documentos, ou
conteúdo potencialmente sensível — nunca a comentários sobre como o parecer foi produzido.

Além do parecer, liste separadamente (fora do texto do parecer, no campo "divergencias") divergências
qualitativas que notar, para revisão interna (evidência repetida contada como se fosse ação nova,
extrapolação de impacto não documentado, etc.) — esse campo não é lido pelo contratante.`;

const responseSchema = z.object({
  parecer: z.string(),
  divergencias: z.array(z.string()).default([]),
});

export async function runAgent8(
  supabase: SupabaseClient<Database>,
  proponentId: string,
  userId: string,
): Promise<{ parecerId: string; semEvidencia: string[] }> {
  const run = await startAgentRun(supabase, {
    proponentId,
    agentName: "agente_8_auditor",
    model: "openai/gpt-5.5",
    triggeredBy: userId,
  });

  try {
    const { data: proponent } = await supabase
      .from("proponents")
      .select("nome_canonico, categoria, ciclo1_alerta")
      .eq("id", proponentId)
      .single();
    const { data: scores } = await supabase
      .from("criterion_scores")
      .select("*")
      .eq("proponent_id", proponentId)
      .order("criterion", { ascending: true });
    const { data: evidenceRows } = await supabase
      .from("evidence")
      .select("criterion, descricao_factual, robustez")
      .eq("proponent_id", proponentId);

    const evidenceByCriterion = new Map<string, number>();
    for (const ev of evidenceRows ?? []) {
      evidenceByCriterion.set(ev.criterion, (evidenceByCriterion.get(ev.criterion) ?? 0) + 1);
    }

    const semEvidencia: string[] = [];
    for (const s of scores ?? []) {
      const count = evidenceByCriterion.get(s.criterion) ?? 0;
      if ((s.approved_score ?? s.proposed_score ?? 0) > 0 && count === 0) {
        semEvidencia.push(s.criterion);
      }
    }

    const resumo = {
      proponente: proponent?.nome_canonico,
      categoria: proponent?.categoria,
      ciclo1_alerta: proponent?.ciclo1_alerta,
      criterios: (scores ?? []).map((s) => ({
        criterio: s.criterion,
        max: s.max_score,
        proposto: s.proposed_score,
        faixa: s.applied_band,
        justificativa: s.justification,
        pendencia_humana: s.human_review_required,
        evidencias_vinculadas: evidenceByCriterion.get(s.criterion) ?? 0,
      })),
    };

    const { data } = await callAgent({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Resumo de notas e evidências deste proponente:\n${JSON.stringify(resumo, null, 2)}\n\nResponda em JSON: {"parecer": "...", "divergencias": ["..."]}`,
      responseSchema,
    });

    const { count: versaoAnterior } = await supabase
      .from("pareceres")
      .select("id", { count: "exact", head: true })
      .eq("proponent_id", proponentId);

    const { data: parecer, error: parecerError } = await supabase
      .from("pareceres")
      .insert({
        proponent_id: proponentId,
        versao: (versaoAnterior ?? 0) + 1,
        texto: data.parecer,
        gerado_por_agente: "agente_8",
      })
      .select()
      .single();
    if (parecerError || !parecer) throw new Error("Não foi possível salvar a minuta de parecer.");

    for (const divergencia of data.divergencias) {
      await supabase.from("flags").insert({
        proponent_id: proponentId,
        tipo: "divergencia_documental",
        descricao: `Auditor: ${divergencia}`,
        criado_por_agente: "agente_8",
      });
    }
    for (const criterio of semEvidencia) {
      await supabase.from("flags").insert({
        proponent_id: proponentId,
        tipo: "outro",
        descricao: `Critério ${criterio} tem nota proposta maior que zero sem nenhuma evidência vinculada — verificar.`,
        criado_por_agente: "agente_8",
      });
    }

    await recordAgentOutput(supabase, run.id, "auditoria", { ...data, semEvidencia });
    await finishAgentRun(supabase, run.id, "concluido");
    return { parecerId: parecer.id, semEvidencia };
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
