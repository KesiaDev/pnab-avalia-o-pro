import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  startGoogleOAuth,
  saveDriveSource,
  runBaselineFn,
  runSyncFn,
  disconnectGoogleFn,
} from "@/lib/drive-actions";

export type DriveConnection = Tables<"drive_connections">;
export type DriveSource = Tables<"drive_sources">;
export type SyncRun = Tables<"sync_runs">;
export type SyncChange = Tables<"sync_changes">;

export function useActiveDriveConnection() {
  return useQuery({
    queryKey: ["drive_connections", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drive_connections")
        .select("*")
        .is("revoked_at", null)
        .order("connected_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useDriveSource(connectionId: string | undefined) {
  return useQuery({
    queryKey: ["drive_sources", connectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drive_sources")
        .select("*")
        .eq("connection_id", connectionId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!connectionId,
  });
}

export function useLatestSyncRun(driveSourceId: string | undefined) {
  return useQuery({
    queryKey: ["sync_runs", "latest", driveSourceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_runs")
        .select("*")
        .eq("drive_source_id", driveSourceId!)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!driveSourceId,
  });
}

export function useSyncChanges(syncRunId: string | undefined) {
  return useQuery({
    queryKey: ["sync_changes", syncRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_changes")
        .select("*, proponents(nome_canonico), files(nome)")
        .eq("sync_run_id", syncRunId!)
        .order("detectado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!syncRunId,
  });
}

export function useRecentSyncChanges() {
  return useQuery({
    queryKey: ["sync_changes", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_changes")
        .select("*, proponents(nome_canonico), files(nome)")
        .order("detectado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export function useStartGoogleOAuth() {
  return useMutation({
    mutationFn: async () => {
      const { url } = await startGoogleOAuth();
      window.location.href = url;
    },
  });
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (connectionId: string) => disconnectGoogleFn({ data: { connectionId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drive_connections"] }),
  });
}

export function useSaveDriveSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { connectionId: string; folderUrlOrId: string }) =>
      saveDriveSource({ data: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["drive_sources"] }),
  });
}

export function useRunBaseline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driveSourceId: string) => runBaselineFn({ data: { driveSourceId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync_runs"] });
      queryClient.invalidateQueries({ queryKey: ["proponents"] });
      queryClient.invalidateQueries({ queryKey: ["sync_changes"] });
    },
  });
}

export function useRunSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driveSourceId: string) => runSyncFn({ data: { driveSourceId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync_runs"] });
      queryClient.invalidateQueries({ queryKey: ["proponents"] });
      queryClient.invalidateQueries({ queryKey: ["sync_changes"] });
    },
  });
}
