import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { runAgentPipeline } from "@/lib/agent-actions";

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

export function useRunAgentPipeline(proponentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => runAgentPipeline({ data: { proponentId } }),
    onSuccess: () => {
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
