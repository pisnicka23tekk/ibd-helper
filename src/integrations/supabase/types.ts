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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      daily_logs: {
        Row: {
          activity_minutes: number | null
          alcohol: boolean
          appetite: number | null
          bloating: number | null
          blood: boolean
          created_at: string
          fatigue: number | null
          foods: string | null
          hydration_liters: number | null
          id: string
          log_date: string
          medications: string | null
          mood: number | null
          mucus: boolean
          nausea: number | null
          notes: string | null
          pain_level: number | null
          pain_location: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          smoking: boolean
          stool_consistency: number | null
          stool_count: number | null
          stress: number | null
          temperature_c: number | null
          updated_at: string
          urgency: boolean
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_minutes?: number | null
          alcohol?: boolean
          appetite?: number | null
          bloating?: number | null
          blood?: boolean
          created_at?: string
          fatigue?: number | null
          foods?: string | null
          hydration_liters?: number | null
          id?: string
          log_date?: string
          medications?: string | null
          mood?: number | null
          mucus?: boolean
          nausea?: number | null
          notes?: string | null
          pain_level?: number | null
          pain_location?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          smoking?: boolean
          stool_consistency?: number | null
          stool_count?: number | null
          stress?: number | null
          temperature_c?: number | null
          updated_at?: string
          urgency?: boolean
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          activity_minutes?: number | null
          alcohol?: boolean
          appetite?: number | null
          bloating?: number | null
          blood?: boolean
          created_at?: string
          fatigue?: number | null
          foods?: string | null
          hydration_liters?: number | null
          id?: string
          log_date?: string
          medications?: string | null
          mood?: number | null
          mucus?: boolean
          nausea?: number | null
          notes?: string | null
          pain_level?: number | null
          pain_location?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          smoking?: boolean
          stool_consistency?: number | null
          stool_count?: number | null
          stress?: number | null
          temperature_c?: number | null
          updated_at?: string
          urgency?: boolean
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      health_profile: {
        Row: {
          allergies: string | null
          created_at: string
          current_treatment: string | null
          diagnosis: string | null
          diagnosis_year: number | null
          disease_location: string | null
          notes: string | null
          other_conditions: string | null
          past_treatment: string | null
          smoking: string | null
          supplements: string | null
          surgeries: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string | null
          created_at?: string
          current_treatment?: string | null
          diagnosis?: string | null
          diagnosis_year?: number | null
          disease_location?: string | null
          notes?: string | null
          other_conditions?: string | null
          past_treatment?: string | null
          smoking?: string | null
          supplements?: string | null
          surgeries?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string | null
          created_at?: string
          current_treatment?: string | null
          diagnosis?: string | null
          diagnosis_year?: number | null
          disease_location?: string | null
          notes?: string | null
          other_conditions?: string | null
          past_treatment?: string | null
          smoking?: string | null
          supplements?: string | null
          surgeries?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lab_results: {
        Row: {
          created_at: string
          id: string
          marker: string
          note: string | null
          taken_on: string
          unit: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          marker: string
          note?: string | null
          taken_on?: string
          unit?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          marker?: string
          note?: string | null
          taken_on?: string
          unit?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          client_message_id: string | null
          content: string
          created_at: string
          id: string
          parts: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          client_message_id?: string | null
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          client_message_id?: string | null
          content?: string
          created_at?: string
          id?: string
          parts?: Json | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
