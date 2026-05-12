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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          id: string
          booking_id: string
          lead_name: string
          lead_email: string
          lead_company: string | null
          lead_notes: string | null
          form_data: Json
          appointment_date: string
          start_time: string
          end_time: string
          timezone: string
          duration_minutes: number
          status: string
          gcal_event_id: string | null
          gcal_html_link: string | null
          gcal_sync_status: string
          gcal_sync_attempts: number
          gcal_last_error: string | null
          gcal_synced_at: string | null
          confirmation_sent_at: string | null
          reminder_sent_at: string | null
          whatsapp_sent_at: string | null
          source: string | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
          updated_at: string
          assigned_commercial_id: string | null
          assigned_commercial_name: string | null
          crm_venta_realizada: boolean
          crm_tipo_marketing: string | null
          crm_tipo_cliente: string | null
          crm_monto_venta: number | null
          crm_estado_cliente: string | null
          crm_observaciones: string | null
          crm_canal_origen: string | null
          archived: boolean
        }
        Insert: {
          id?: string
          booking_id: string
          lead_name: string
          lead_email: string
          lead_company?: string | null
          lead_notes?: string | null
          form_data?: Json
          appointment_date: string
          start_time: string
          end_time: string
          timezone?: string
          duration_minutes?: number
          status?: string
          gcal_event_id?: string | null
          gcal_html_link?: string | null
          gcal_sync_status?: string
          gcal_sync_attempts?: number
          gcal_last_error?: string | null
          gcal_synced_at?: string | null
          confirmation_sent_at?: string | null
          reminder_sent_at?: string | null
          whatsapp_sent_at?: string | null
          source?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
          assigned_commercial_id?: string | null
          assigned_commercial_name?: string | null
          crm_venta_realizada?: boolean
          crm_tipo_marketing?: string | null
          crm_tipo_cliente?: string | null
          crm_monto_venta?: number | null
          crm_estado_cliente?: string | null
          crm_observaciones?: string | null
          crm_canal_origen?: string | null
          archived?: boolean
        }
        Update: {
          id?: string
          booking_id?: string
          lead_name?: string
          lead_email?: string
          lead_company?: string | null
          lead_notes?: string | null
          form_data?: Json
          appointment_date?: string
          start_time?: string
          end_time?: string
          timezone?: string
          duration_minutes?: number
          status?: string
          gcal_event_id?: string | null
          gcal_html_link?: string | null
          gcal_sync_status?: string
          gcal_sync_attempts?: number
          gcal_last_error?: string | null
          gcal_synced_at?: string | null
          confirmation_sent_at?: string | null
          reminder_sent_at?: string | null
          whatsapp_sent_at?: string | null
          source?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          updated_at?: string
          assigned_commercial_id?: string | null
          assigned_commercial_name?: string | null
          crm_venta_realizada?: boolean
          crm_tipo_marketing?: string | null
          crm_tipo_cliente?: string | null
          crm_monto_venta?: number | null
          crm_estado_cliente?: string | null
          crm_observaciones?: string | null
          crm_canal_origen?: string | null
          archived?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "appointments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "booking_configs"
            referencedColumns: ["booking_id"]
          }
        ]
      }
      booking_configs: {
        Row: {
          active: boolean
          area: string
          assignment_type: string
          booking_id: string
          commercial_group_id: string | null
          country: string
          created_at: string
          duration: number
          expectations: Json
          form_fields: Json
          gcal_calendar_id: string
          id: string
          n8n_create_booking_url: string
          n8n_get_availability_url: string
          name: string
          not_for: Json
          policy_text: string
          require_policy_acceptance: boolean
          subtitle: string
          target_audience: Json
          title: string
          topics: Json
          tracking_pixels: Json | null
          updated_at: string
          use_supabase_backend: boolean
        }
        Insert: {
          active?: boolean
          area?: string
          assignment_type?: string
          booking_id: string
          commercial_group_id?: string | null
          country?: string
          created_at?: string
          duration?: number
          expectations?: Json
          form_fields?: Json
          gcal_calendar_id?: string
          id?: string
          n8n_create_booking_url?: string
          n8n_get_availability_url?: string
          name: string
          not_for?: Json
          policy_text?: string
          require_policy_acceptance?: boolean
          subtitle?: string
          target_audience?: Json
          title: string
          topics?: Json
          tracking_pixels?: Json | null
          updated_at?: string
          use_supabase_backend?: boolean
        }
        Update: {
          active?: boolean
          area?: string
          assignment_type?: string
          booking_id?: string
          commercial_group_id?: string | null
          country?: string
          created_at?: string
          duration?: number
          expectations?: Json
          form_fields?: Json
          gcal_calendar_id?: string
          id?: string
          n8n_create_booking_url?: string
          n8n_get_availability_url?: string
          name?: string
          not_for?: Json
          policy_text?: string
          require_policy_acceptance?: boolean
          subtitle?: string
          target_audience?: Json
          title?: string
          topics?: Json
          tracking_pixels?: Json | null
          updated_at?: string
          use_supabase_backend?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
