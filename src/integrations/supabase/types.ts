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
          created_at: string
          created_by: string | null
          id: string
          mime_type: string | null
          nome: string
          proponent_id: string
          storage_path: string
          tipo_documental: Database["public"]["Enums"]["document_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          mime_type?: string | null
          nome: string
          proponent_id: string
          storage_path: string
          tipo_documental?: Database["public"]["Enums"]["document_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
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
