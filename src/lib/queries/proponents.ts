import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type ProponentRow = Tables<"proponents">;
export type EvaluationRow = Tables<"evaluations">;
export type CriterionScoreRow = Tables<"criterion_scores">;
export type FileRow = Tables<"files">;
export type FileVersionRow = Tables<"file_versions">;

export type ProponentWithEvaluation = ProponentRow & {
  evaluations: EvaluationRow | null;
  criterion_scores: Pick<CriterionScoreRow, "human_review_required">[];
};

export function useProponents() {
  return useQuery({
    queryKey: ["proponents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proponents")
        .select("*, evaluations(*), criterion_scores(human_review_required)")
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return data as ProponentWithEvaluation[];
    },
  });
}

export function useProponent(id: string) {
  return useQuery({
    queryKey: ["proponents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proponents")
        .select("*, evaluations(*), proponent_aliases(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateProponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"proponents">) => {
      const { data, error } = await supabase.from("proponents").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proponents"] });
    },
  });
}

export function useDeleteProponent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proponents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proponents"] });
    },
  });
}

export function useCriterionScores(proponentId: string) {
  return useQuery({
    queryKey: ["criterion_scores", proponentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("criterion_scores")
        .select("*")
        .eq("proponent_id", proponentId)
        .order("criterion", { ascending: true });
      if (error) throw error;
      return data as CriterionScoreRow[];
    },
    enabled: !!proponentId,
  });
}

export function useUpdateCriterionScore(proponentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      approved_score: number | null;
      human_review_required: boolean;
      justification?: string;
    }) => {
      const patch: {
        approved_score: number | null;
        human_review_required: boolean;
        justification?: string;
      } = {
        approved_score: params.approved_score,
        human_review_required: params.human_review_required,
      };
      if (params.justification !== undefined) patch.justification = params.justification;
      const { error } = await supabase.from("criterion_scores").update(patch).eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["criterion_scores", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["proponents", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["proponents"] });
    },
  });
}

export function useApproveEvaluation(proponentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error: evalError } = await supabase
        .from("evaluations")
        .update({ status: "aprovado_pela_avaliadora" })
        .eq("proponent_id", proponentId);
      if (evalError) throw evalError;

      const { error: statusError } = await supabase
        .from("proponents")
        .update({ status: "aprovado_pela_avaliadora" })
        .eq("id", proponentId);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proponents", proponentId] });
      queryClient.invalidateQueries({ queryKey: ["proponents"] });
    },
  });
}

export function useFiles(proponentId: string) {
  return useQuery({
    queryKey: ["files", proponentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("*, file_versions(*)")
        .eq("proponent_id", proponentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (FileRow & { file_versions: FileVersionRow[] })[];
    },
    enabled: !!proponentId,
  });
}

export function useUploadFile(proponentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; tipoDocumental: FileRow["tipo_documental"] }) => {
      const path = `${proponentId}/${crypto.randomUUID()}-${input.file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("dossies-privados")
        .upload(path, input.file, { upsert: false });
      if (uploadError) throw uploadError;

      const { data: fileRow, error: fileError } = await supabase
        .from("files")
        .insert({
          proponent_id: proponentId,
          nome: input.file.name,
          mime_type: input.file.type,
          tipo_documental: input.tipoDocumental,
          storage_path: path,
        })
        .select()
        .single();
      if (fileError) throw fileError;

      const { error: versionError } = await supabase.from("file_versions").insert({
        file_id: fileRow.id,
        versao: 1,
        tamanho_kb: Math.max(1, Math.round(input.file.size / 1024)),
        storage_path: path,
      });
      if (versionError) throw versionError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", proponentId] });
    },
  });
}
