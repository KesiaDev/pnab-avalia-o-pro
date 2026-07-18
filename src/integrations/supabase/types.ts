export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          reason: string | null
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      criterion_scores: {
        Row: {
          applied_band: string | null
          approved_score: number | null
          criterion: string
          human_review_required: boolean
          id: string
          justification: string | null
          max_score: number
          proponent_id: string
          proposed_score: number | null
          updated_at: string
        }
        Insert: {
          applied_band?: string | null
          approved_score?: number | null
          criterion: string
          human_review_required?: boolean
          id?: string
          justification?: string | null
          max_score: number
          proponent_id: string
          proposed_score?: number | null
          updated_at?: string
        }
        Update: {
          applied_band?: string | null
          approved_score?: number | null
          criterion?: string
          human_review_required?: boolean
          id?: string
          justification?: string | null
          max_score?: number
          proponent_id?: string
          proposed_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "criterion_scores_proponent_id_fkey"
            columns: ["proponent_id"]
            isOneToOne: false
            referencedRelation: "proponents"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_connections: {
        Row: {
          connected_at: string
          connected_by: string | null
          google_email: string | null
          id: string
          refresh_token_encrypted: string
          revoked_at: string | null
          scope: string
        }
        Insert: {
          connected_at?: string
          connected_by?: string | null
          google_email?: string | null
          id?: string
          refresh_token_encrypted: string
          revoked_at?: string | null
          scope?: string
        }
        Update: {
          connected_at?: string
          connected_by?: string | null
          google_email?: string | null
          id?: string
          refresh_token_encrypted?: string
          revoked_at?: string | null
          scope?: string
        }
        Relationships: []
      }
      drive_sources: {
        Row: {
          connection_id: string
          created_at: string
          drive_folder_id: string
          folder_name: string | null
          id: string
          periodic_sync_enabled: boolean
        }
        Insert: {
          connection_id: string
          created_at?: string
          drive_folder_id: string
          folder_name?: string | null
          id?: string
          periodic_sync_enabled?: boolean
        }
        Update: {
          connection_id?: string
          created_at?: string
          drive_folder_id?: string
          folder_name?: string | null
          id?: string
          periodic_sync_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "drive_sources_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "drive_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          bonus_subtotal: number
          export_ready: boolean
          id: string
          individual_total: number
          mandatory_subtotal: number
          proponent_id: string
          status: string
          updated_at: string
          zero_in_mandatory_criterion: boolean
        }
        Insert: {
          bonus_subtotal?: number
          export_ready?: boolean
          id?: string
          individual_total?: number
          mandatory_subtotal?: number
          proponent_id: string
          status?: string
          updated_at?: string
          zero_in_mandatory_criterion?: boolean
        }
        Update: {
          bonus_subtotal?: number
          export_ready?: boolean
          id?: string
          individual_total?: number
          mandatory_subtotal?: number
          proponent_id?: string
          status?: string
          updated_at?: string
          zero_in_mandatory_criterion?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_proponent_id_fkey"
            columns: ["proponent_id"]
            isOneToOne: true
            referencedRelation: "proponents"
            referencedColumns: ["id"]
          },
        ]
      }
      file_versions: {
        Row: {
          created_at: string
          file_id: string
          id: string
          minimizado: boolean
          sha256: string | null
          storage_path: string
          tamanho_kb: number | null
          versao: number
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          minimizado?: boolean
          sha256?: string | null
          storage_path: string
          tamanho_kb?: number | null
          versao?: number
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          minimizado?: boolean
          sha256?: string | null
          storage_path?: string
          tamanho_kb?: number | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "file_versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          caminho_relativo: string | null
          created_at: string
          created_by: string | null
          drive_checksum: string | null
          drive_file_id: string | null
          drive_modified_time: string | null
          drive_seen_at: string | null
          id: string
          mime_type: string | null
          nome: string
          proponent_id: string
          storage_path: string
          tipo_documental: Database["public"]["Enums"]["document_type"]
        }
        Insert: {
          caminho_relativo?: string | null
          created_at?: string
          created_by?: string | null
          drive_checksum?: string | null
          drive_file_id?: string | null
          drive_modified_time?: string | null
          drive_seen_at?: string | null
          id?: string
          mime_type?: string | null
          nome: string
          proponent_id: string
          storage_path: string
          tipo_documental?: Database["public"]["Enums"]["document_type"]
        }
        Update: {
          caminho_relativo?: string | null
          created_at?: string
          created_by?: string | null
          drive_checksum?: string | null
          drive_file_id?: string | null
          drive_modified_time?: string | null
          drive_seen_at?: string | null
          id?: string
          mime_type?: string | null
          nome?: string
          proponent_id?: string
          storage_path?: string
          tipo_documental?: Database["public"]["Enums"]["document_type"]
        }
        Relationships: [
          {
            foreignKeyName: "files_proponent_id_fkey"
            columns: ["proponent_id"]
            isOneToOne: false
            referencedRelation: "proponents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      proponent_aliases: {
        Row: {
          alias: string
          created_at: string
          id: string
          origem: string
          proponent_id: string
        }
        Insert: {
          alias: string
          created_at?: string
          id?: string
          origem: string
          proponent_id: string
        }
        Update: {
          alias?: string
          created_at?: string
          id?: string
          origem?: string
          proponent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proponent_aliases_proponent_id_fkey"
            columns: ["proponent_id"]
            isOneToOne: false
            referencedRelation: "proponents"
            referencedColumns: ["id"]
          },
        ]
      }
      proponents: {
        Row: {
          atualizado_em: string
          categoria: string | null
          ciclo1_alerta: string | null
          created_at: string
          created_by: string | null
          id: string
          nome_canonico: string
          status: Database["public"]["Enums"]["proponent_status"]
        }
        Insert: {
          atualizado_em?: string
          categoria?: string | null
          ciclo1_alerta?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome_canonico: string
          status?: Database["public"]["Enums"]["proponent_status"]
        }
        Update: {
          atualizado_em?: string
          categoria?: string | null
          ciclo1_alerta?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome_canonico?: string
          status?: Database["public"]["Enums"]["proponent_status"]
        }
        Relationships: []
      }
      reference_document_versions: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          hash: string
          id: string
          reference_document_id: string
          status: Database["public"]["Enums"]["normative_status"]
          storage_path: string | null
          versao: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          hash: string
          id?: string
          reference_document_id: string
          status?: Database["public"]["Enums"]["normative_status"]
          storage_path?: string | null
          versao: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          hash?: string
          id?: string
          reference_document_id?: string
          status?: Database["public"]["Enums"]["normative_status"]
          storage_path?: string | null
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_document_versions_reference_document_id_fkey"
            columns: ["reference_document_id"]
            isOneToOne: false
            referencedRelation: "reference_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_documents: {
        Row: {
          created_at: string
          id: string
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      source_folders: {
        Row: {
          caminho: string | null
          created_at: string
          drive_folder_id: string
          drive_source_id: string
          id: string
          nome_pasta: string
          proponent_id: string | null
        }
        Insert: {
          caminho?: string | null
          created_at?: string
          drive_folder_id: string
          drive_source_id: string
          id?: string
          nome_pasta: string
          proponent_id?: string | null
        }
        Update: {
          caminho?: string | null
          created_at?: string
          drive_folder_id?: string
          drive_source_id?: string
          id?: string
          nome_pasta?: string
          proponent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_folders_drive_source_id_fkey"
            columns: ["drive_source_id"]
            isOneToOne: false
            referencedRelation: "drive_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_folders_proponent_id_fkey"
            columns: ["proponent_id"]
            isOneToOne: false
            referencedRelation: "proponents"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_changes: {
        Row: {
          acao_necessaria: string | null
          antes: string | null
          change_type: string
          depois: string | null
          detectado_em: string
          file_id: string | null
          id: string
          proponent_id: string | null
          sync_run_id: string
        }
        Insert: {
          acao_necessaria?: string | null
          antes?: string | null
          change_type: string
          depois?: string | null
          detectado_em?: string
          file_id?: string | null
          id?: string
          proponent_id?: string | null
          sync_run_id: string
        }
        Update: {
          acao_necessaria?: string | null
          antes?: string | null
          change_type?: string
          depois?: string | null
          detectado_em?: string
          file_id?: string | null
          id?: string
          proponent_id?: string | null
          sync_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_changes_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_changes_proponent_id_fkey"
            columns: ["proponent_id"]
            isOneToOne: false
            referencedRelation: "proponents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_changes_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          drive_source_id: string
          error_message: string | null
          finished_at: string | null
          id: string
          kind: string
          started_at: string
          stats: Json | null
          status: string
          triggered_by: string | null
        }
        Insert: {
          drive_source_id: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          started_at?: string
          stats?: Json | null
          status?: string
          triggered_by?: string | null
        }
        Update: {
          drive_source_id?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          started_at?: string
          stats?: Json | null
          status?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_drive_source_id_fkey"
            columns: ["drive_source_id"]
            isOneToOne: false
            referencedRelation: "drive_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "administradora"
        | "agente_merito"
        | "agente_administrativo"
        | "auditor"
      document_type:
        | "formulario"
        | "identidade"
        | "portfolio"
        | "comprobatorio"
        | "grp"
        | "zimbra"
        | "outro"
      normative_status: "vigente" | "arquivado"
      proponent_status:
        | "nao_importado"
        | "importado"
        | "inventariado"
        | "em_analise"
        | "avaliacao_proposta"
        | "auditoria_concluida"
        | "pendencia_humana"
        | "aprovado_pela_avaliadora"
        | "bloqueado"
        | "reaberto"
        | "finalizado"
        | "pendencia_administrativa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "administradora",
        "agente_merito",
        "agente_administrativo",
        "auditor",
      ],
      document_type: [
        "formulario",
        "identidade",
        "portfolio",
        "comprobatorio",
        "grp",
        "zimbra",
        "outro",
      ],
      normative_status: ["vigente", "arquivado"],
      proponent_status: [
        "nao_importado",
        "importado",
        "inventariado",
        "em_analise",
        "avaliacao_proposta",
        "auditoria_concluida",
        "pendencia_humana",
        "aprovado_pela_avaliadora",
        "bloqueado",
        "reaberto",
        "finalizado",
        "pendencia_administrativa",
      ],
    },
  },
} as const
