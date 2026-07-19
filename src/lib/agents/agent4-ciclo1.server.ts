// Server-only (sufixo .server.ts) — ver aviso em google-oauth.server.ts.
// Agente 4 — Verificador de Impedimentos (Seção 17, Seção 15).
// Comparação determinística contra cycle1_awardees (nunca usa IA para isso:
// é uma checagem de correspondência de texto, mais confiável e auditável em
// código do que via LLM). A tabela cycle1_awardees fica vazia até a
// administradora importar a relação real do Edital nº 231/2024 — até lá,
// isso sempre resulta "sem correspondência".
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { finishAgentRun, recordAgentOutput, startAgentRun } from "./shared.server";

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

export async function runAgent4(
  supabase: SupabaseClient<Database>,
  proponentId: string,
  userId: string,
): Promise<{ status: "sem_correspondencia" | "exata" | "provavel" }> {
  const run = await startAgentRun(supabase, {
    proponentId,
    agentName: "agente_4_ciclo1",
    model: "n/a (determinístico)",
    triggeredBy: userId,
  });

  try {
    const { data: proponent } = await supabase
      .from("proponents")
      .select("nome_canonico")
      .eq("id", proponentId)
      .single();
    const { data: aliases } = await supabase
      .from("proponent_aliases")
      .select("alias")
      .eq("proponent_id", proponentId);
    const { data: awardees } = await supabase
      .from("cycle1_awardees")
      .select("nome")
      .eq("origem_edital", "231/2024");

    const candidateNames = [proponent?.nome_canonico, ...(aliases ?? []).map((a) => a.alias)]
      .filter((n): n is string => !!n)
      .map(normalize);

    let result: "sem_correspondencia" | "exata" | "provavel" = "sem_correspondencia";
    let matchedAwardee: string | null = null;

    for (const awardee of awardees ?? []) {
      const normalizedAwardee = normalize(awardee.nome);
      if (candidateNames.includes(normalizedAwardee)) {
        result = "exata";
        matchedAwardee = awardee.nome;
        break;
      }
      const provavel = candidateNames.some(
        (candidate) =>
          candidate.length > 4 &&
          normalizedAwardee.length > 4 &&
          (candidate.includes(normalizedAwardee) || normalizedAwardee.includes(candidate)),
      );
      if (provavel && !matchedAwardee) {
        result = "provavel";
        matchedAwardee = awardee.nome;
      }
    }

    if (result === "exata") {
      await supabase.from("proponents").update({ ciclo1_alerta: "exata" }).eq("id", proponentId);
      await supabase.from("flags").insert({
        proponent_id: proponentId,
        tipo: "ciclo1_exata",
        descricao: `Correspondência exata e inequívoca com "${matchedAwardee}" na relação de contemplados do Edital nº 231/2024. Pontuação interrompida — encaminhar decisão à Secretaria Municipal da Cultura.`,
        criado_por_agente: "agente_4",
      });
    } else if (result === "provavel") {
      await supabase.from("proponents").update({ ciclo1_alerta: "provavel" }).eq("id", proponentId);
      await supabase.from("flags").insert({
        proponent_id: proponentId,
        tipo: "ciclo1_provavel",
        descricao: `Foi identificada divergência documental que requer verificação pela Secretaria Municipal da Cultura (semelhança com "${matchedAwardee}" no Edital nº 231/2024).`,
        criado_por_agente: "agente_4",
      });
    }

    await recordAgentOutput(supabase, run.id, "ciclo1", { result, matchedAwardee });
    await finishAgentRun(supabase, run.id, "concluido");
    return { status: result };
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
