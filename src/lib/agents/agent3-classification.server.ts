// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Agente 3 — Identidade, Minimização e Conformidade (Seção 17, Seção 7).
// Classifica cada documento do proponente pelo CONTEÚDO real (não pelo
// nome do arquivo), e coteja o nome encontrado em identidade/GRP/Zimbra
// contra o nome canônico, registrando alias e divergência sem decidir
// sozinho qual nome está certo.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { callAgent } from "@/lib/ai-gateway.server";
import {
  fetchProponentFiles,
  finishAgentRun,
  recordAgentOutput,
  startAgentRun,
  toAgentFiles,
} from "./shared.server";

const SYSTEM_PROMPT = `Você é o Agente de Identidade e Conformidade da plataforma PNAB Caxias — Avaliação Assistida.

Use RG/CNH, GRP, Zimbra e formulário de inscrição apenas para conferir identidade, protocolo e processo
administrativo, e para classificar cada documento pelo seu tipo real (pelo CONTEÚDO, nunca apenas pelo
nome do arquivo). Não use dados pessoais para mérito. Não infira gênero, raça, orientação sexual,
deficiência ou vulnerabilidade a partir de nome, foto ou aparência. Classifique GRP e Protocolo Zimbra
como documentos administrativos não pontuáveis.

Tipos de documento possíveis (Seção 7 do prompt-mestre):
- formulario: formulário de inscrição (dados estruturantes, autodeclarações).
- identidade: RG, CNH ou equivalente.
- portfolio: portfólio ou currículo (trajetória, projetos).
- comprobatorio: cartazes, certificados, matérias, programas, contratos, publicações, fotos contextualizadas.
- grp: registro administrativo municipal da inscrição (processo, CPF/CNPJ, síntese).
- zimbra: confirmação institucional de protocolo por e-mail.
- outro: qualquer coisa que não se encaixe nos anteriores.

Os arquivos são anexados numerados, na ordem "Arquivo 1", "Arquivo 2" etc. — use esse número (campo
"indice") pra identificar cada um na resposta, nunca reescreva o nome do arquivo por conta própria. Sua
resposta em "classificacoes" precisa ter EXATAMENTE um item por número de arquivo recebido, sem pular
nenhum — se não tiver certeza do tipo de algum, classifique como "outro" com confiança baixa, mas sempre
inclua o item.

Se encontrar o nome completo do proponente em algum documento de identidade, GRP ou Zimbra, registre
esse nome e de onde veio — não decida qual nome é o correto, apenas relate o que encontrou em cada fonte.

Determine também o tipo de proponente, usando apenas o que está declarado no formulário de inscrição, no
GRP e no protocolo Zimbra: "pessoa_fisica" quando a inscrição é em nome de pessoa física (CPF, nome civil)
— MEI inscrito na Trajetória Individual é tratado como pessoa física, mesma regra usada nos demais
critérios; "pessoa_juridica_ou_coletivo" quando a inscrição é em nome de pessoa jurídica com CNPJ, razão
social, ou coletivo/grupo cultural sem CNPJ representado por terceiro. Se os documentos não deixarem isso
claro, ou houver indício conflitante entre eles, marque "tipo_proponente_ambiguo": true e não arrisque um
palpite — isso vai para revisão humana.`;

const classificationItemSchema = z.object({
  indice: z.number().int(),
  arquivo: z.string().optional(),
  tipo_documental: z.enum([
    "formulario",
    "identidade",
    "portfolio",
    "comprobatorio",
    "grp",
    "zimbra",
    "outro",
  ]),
  confianca: z.number().min(0).max(1).optional(),
  justificativa: z.string(),
});

const nomeEncontradoSchema = z.object({
  nome: z.string(),
  fonte: z.string(),
});

const responseSchema = z.object({
  classificacoes: z.array(classificationItemSchema),
  nomes_encontrados: z.array(nomeEncontradoSchema).default([]),
  tipo_proponente: z.enum(["pessoa_fisica", "pessoa_juridica_ou_coletivo"]).nullable(),
  tipo_proponente_ambiguo: z.boolean().default(false),
  tipo_proponente_justificativa: z.string().nullable(),
});

export async function runAgent3(
  supabase: SupabaseClient<Database>,
  proponentId: string,
  userId: string,
): Promise<{ classificados: number; aliasesNovos: number }> {
  const run = await startAgentRun(supabase, {
    proponentId,
    agentName: "agente_3_identidade",
    model: "openai/gpt-5.5",
    triggeredBy: userId,
  });

  try {
    const files = await fetchProponentFiles(supabase, proponentId);
    if (files.length === 0) {
      await finishAgentRun(supabase, run.id, "concluido");
      return { classificados: 0, aliasesNovos: 0 };
    }

    const fileList = files.map((f, i) => `Arquivo ${i + 1}: ${f.nome}`).join("\n");

    const { data } = await callAgent({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: `Classifique cada um dos ${files.length} arquivos anexados, nesta ordem:\n${fileList}\n\nResponda em JSON:
{"classificacoes": [{"indice": 1, "tipo_documental": "...", "confianca": 0.0, "justificativa": "..."}],
 "nomes_encontrados": [{"nome": "nome completo encontrado", "fonte": "ex: RG, GRP, Zimbra"}],
 "tipo_proponente": "pessoa_fisica" ou "pessoa_juridica_ou_coletivo" ou null,
 "tipo_proponente_ambiguo": true/false,
 "tipo_proponente_justificativa": "..." ou null}`,
      files: toAgentFiles(files),
      responseSchema,
    });

    let classificados = 0;
    const indicesClassificados = new Set<number>();
    for (const item of data.classificacoes) {
      const file = files[item.indice - 1];
      if (!file) continue;
      indicesClassificados.add(item.indice);
      await supabase.from("document_classifications").insert({
        file_id: file.id,
        file_version_id: file.versionId,
        tipo_documental: item.tipo_documental,
        confianca: item.confianca ?? null,
        justificativa: item.justificativa,
        criado_por_agente: "agente_3",
      });
      await supabase
        .from("files")
        .update({ tipo_documental: item.tipo_documental })
        .eq("id", file.id);
      classificados += 1;
    }

    // Arquivos que o modelo deixou de fora da resposta ficam com a
    // classificação anterior (geralmente "outro", o default da importação) —
    // sinaliza em vez de deixar isso passar em silêncio, já que "outro" some
    // é um valor plausível por si só e mascararia a falha de enumeração.
    const naoClassificados = files.filter((_, i) => !indicesClassificados.has(i + 1));
    if (naoClassificados.length > 0) {
      await supabase.from("flags").insert({
        proponent_id: proponentId,
        tipo: "outro",
        descricao: `Agente 3 não retornou classificação para ${naoClassificados.length} arquivo(s): ${naoClassificados.map((f) => f.nome).join(", ")}. Classificação atual pode estar desatualizada — considerar reexecutar os agentes ou classificar manualmente.`,
        criado_por_agente: "agente_3",
      });
    }

    const { data: proponent } = await supabase
      .from("proponents")
      .select("nome_canonico, tipo_proponente")
      .eq("id", proponentId)
      .single();

    // Só grava se ainda não houver escolha registrada — nunca sobrescreve uma
    // definição manual (ex.: correção da avaliadora num caso de MEI ambíguo).
    if (!proponent?.tipo_proponente) {
      if (data.tipo_proponente && !data.tipo_proponente_ambiguo) {
        await supabase
          .from("proponents")
          .update({ tipo_proponente: data.tipo_proponente })
          .eq("id", proponentId);
      } else {
        await supabase.from("flags").insert({
          proponent_id: proponentId,
          tipo: "outro",
          descricao:
            data.tipo_proponente_justificativa ??
            "Não foi possível determinar com segurança se o proponente é pessoa física ou jurídica/coletivo a partir do formulário, GRP e Zimbra — definir manualmente na aba Dossiê.",
          criado_por_agente: "agente_3",
        });
      }
    }
    const { data: existingAliases } = await supabase
      .from("proponent_aliases")
      .select("alias")
      .eq("proponent_id", proponentId);
    const knownNames = new Set(
      [proponent?.nome_canonico, ...(existingAliases ?? []).map((a) => a.alias)]
        .filter((n): n is string => !!n)
        .map((n) => n.trim().toLowerCase()),
    );

    let aliasesNovos = 0;
    for (const encontrado of data.nomes_encontrados ?? []) {
      const normalized = encontrado.nome.trim().toLowerCase();
      if (!normalized || knownNames.has(normalized)) continue;
      knownNames.add(normalized);
      await supabase.from("proponent_aliases").insert({
        proponent_id: proponentId,
        alias: encontrado.nome,
        origem: encontrado.fonte,
      });
      aliasesNovos += 1;
      if (proponent?.nome_canonico && normalized !== proponent.nome_canonico.trim().toLowerCase()) {
        await supabase.from("flags").insert({
          proponent_id: proponentId,
          tipo: "divergencia_documental",
          descricao: `Nome "${encontrado.nome}" encontrado em ${encontrado.fonte} diverge do nome canônico "${proponent.nome_canonico}". Requer verificação pela Secretaria Municipal da Cultura.`,
          criado_por_agente: "agente_3",
        });
      }
    }

    await recordAgentOutput(supabase, run.id, "classificacao", data);
    await finishAgentRun(supabase, run.id, "concluido");
    return { classificados, aliasesNovos };
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
