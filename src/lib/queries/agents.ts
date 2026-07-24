import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  finishAgentPipelineFn,
  runAgent3Fn,
  runAgent4Fn,
  runAgent5Fn,
  runAgent6CriterionFn,
  runAgent7Fn,
  startAgentPipelineFn,
} from "@/lib/agent-actions";

export type EvidenceRow = Tables<"evidence">;
export type ParecerRow = Tables<"pareceres">;
export type FlagRow = Tables<"flags">;
export type AgentRunRow = Tables<"agent_runs">;

export function useEvidence(proponentId: string) {
  return useQuery({
    queryKey: ["evidence", proponentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence")
        .select("*")
        .eq("proponent_id", proponentId)
        .order("criterion", { ascending: true });
      if (error) throw error;
      return data as EvidenceRow[];
    },
    enabled: !!proponentId,
  });
}

export function useLatestParecer(proponentId: string) {
  return useQuery({
    queryKey: ["pareceres", proponentId, "latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pareceres")
        .select("*")
        .eq("proponent_id", proponentId)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!proponentId,
  });
}

export function useFlags(proponentId: string) {
  return useQuery({
    queryKey: ["flags", proponentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flags")
        .select("*")
        .eq("proponent_id", proponentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FlagRow[];
    },
    enabled: !!proponentId,
  });
}

export function useAgentRuns(proponentId: string) {
  return useQuery({
    queryKey: ["agent_runs", proponentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .eq("proponent_id", proponentId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return data as AgentRunRow[];
    },
    enabled: !!proponentId,
  });
}

// Executa cada agente numa server function separada, sequencialmente. Cada
// chamada é um Worker novo com heap limpo — resolve o 502 "Worker exceeded
// memory limit" que estourava quando 5 agentes rodavam no mesmo processo,
// cada um carregando todos os PDFs do proponente em base64. Falhas parciais
// são coletadas mas não interrompem os próximos agentes.
export function useRunAgentPipeline(proponentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const errors: string[] = [];
      const runStep = async (label: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
        } catch (err) {
          errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        }
      };

      await startAgentPipelineFn({ data: { proponentId } });
      await runStep("Agente 3 (Identidade)", () => runAgent3Fn({ data: { proponentId } }));
      await runStep("Agente 4 (Ciclo 1)", () => runAgent4Fn({ data: { proponentId } }));
      await runStep("Agente 5 (Trajetória)", () => runAgent5Fn({ data: { proponentId } }));
      for (const criterion of ["B", "C", "D", "E"] as const) {
        await runStep(`Agente 6 (Mérito ${criterion})`, () =>
          runAgent6CriterionFn({ data: { proponentId, criterion } }),
        );
      }
      await runStep("Agente 7 (Bônus)", () => runAgent7Fn({ data: { proponentId } }));
      await finishAgentPipelineFn({ data: { proponentId } });

      if (errors.length > 0) {
        throw new Error(`Concluído com falhas parciais:\n- ${errors.join("\n- ")}`);
      }
      return { ok: true as const };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["criterion_scores", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["proponents", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["proponents"] });
      queryClient.invalidateQueries({ queryKey: ["evidence", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["pareceres", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["flags", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["agent_runs", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["files", proponentId] });
    },
  });
}

