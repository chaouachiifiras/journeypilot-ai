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
      ai_runs: {
        Row: {
          completion_tokens: number | null
          created_at: string
          duration_ms: number | null
          error: string | null
          feature: string
          id: string
          metadata: Json
          model: string | null
          prompt_tokens: number | null
          status: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          feature: string
          id?: string
          metadata?: Json
          model?: string | null
          prompt_tokens?: number | null
          status?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          feature?: string
          id?: string
          metadata?: Json
          model?: string | null
          prompt_tokens?: number | null
          status?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          message: Json
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: Json
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: Json
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_threads_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_requests: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_itineraries: {
        Row: {
          content: Json
          created_at: string
          currency: string
          draft_id: string | null
          estimated_cost: number | null
          id: string
          model: string | null
          status: string
          summary: string
          title: string
          trip_id: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content?: Json
          created_at?: string
          currency?: string
          draft_id?: string | null
          estimated_cost?: number | null
          id?: string
          model?: string | null
          status?: string
          summary?: string
          title?: string
          trip_id: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          currency?: string
          draft_id?: string | null
          estimated_cost?: number | null
          id?: string
          model?: string | null
          status?: string
          summary?: string
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "generated_itineraries_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "itinerary_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_itineraries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_drafts: {
        Row: {
          created_at: string
          current_step: number
          id: string
          input: Json
          status: string
          title: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          id?: string
          input?: Json
          status?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          id?: string
          input?: Json
          status?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_drafts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          home_currency: string
          id: string
          preferred_language: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_currency?: string
          id: string
          preferred_language?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_currency?: string
          id?: string
          preferred_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_places: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          place_data: Json
          provider: string
          provider_place_id: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          name: string
          place_data?: Json
          provider?: string
          provider_place_id: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          place_data?: Json
          provider?: string
          provider_place_id?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_places_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_activities: {
        Row: {
          activity_data: Json
          category: string | null
          created_at: string
          day: number | null
          duration_minutes: number | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          note: string | null
          provider: string
          provider_place_id: string
          time_slot: string | null
          trip_id: string
          user_id: string
        }
        Insert: {
          activity_data?: Json
          category?: string | null
          created_at?: string
          day?: number | null
          duration_minutes?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          note?: string | null
          provider?: string
          provider_place_id: string
          time_slot?: string | null
          trip_id: string
          user_id: string
        }
        Update: {
          activity_data?: Json
          category?: string | null
          created_at?: string
          day?: number | null
          duration_minutes?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          note?: string | null
          provider?: string
          provider_place_id?: string
          time_slot?: string | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_enrichment: {
        Row: {
          category: string
          created_at: string
          day_number: number | null
          id: string
          place_data: Json | null
          slot: string | null
          source_query: string
          status: string
          trip_id: string
        }
        Insert: {
          category: string
          created_at?: string
          day_number?: number | null
          id?: string
          place_data?: Json | null
          slot?: string | null
          source_query: string
          status?: string
          trip_id: string
        }
        Update: {
          category?: string
          created_at?: string
          day_number?: number | null
          id?: string
          place_data?: Json | null
          slot?: string | null
          source_query?: string
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_enrichment_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_skeleton: {
        Row: {
          best_time_to_visit: string | null
          budget_breakdown: Json
          created_at: string
          days: Json
          id: string
          overview: string
          tagline: string
          title: string
          trip_id: string
        }
        Insert: {
          best_time_to_visit?: string | null
          budget_breakdown?: Json
          created_at?: string
          days?: Json
          id?: string
          overview?: string
          tagline?: string
          title?: string
          trip_id: string
        }
        Update: {
          best_time_to_visit?: string | null
          budget_breakdown?: Json
          created_at?: string
          days?: Json
          id?: string
          overview?: string
          tagline?: string
          title?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_skeleton_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          accessibility_needs: string | null
          activity_intensity: string | null
          budget: number
          children_count: number | null
          city: string
          country: string
          created_at: string
          currency: string
          days: number
          food_preferences: string | null
          has_children: boolean
          id: string
          interests: string[]
          language: string
          plan: Json | null
          status: string
          travel_style: string
          traveling_with: string | null
          user_id: string
          walking_preference: string | null
        }
        Insert: {
          accessibility_needs?: string | null
          activity_intensity?: string | null
          budget: number
          children_count?: number | null
          city: string
          country: string
          created_at?: string
          currency?: string
          days: number
          food_preferences?: string | null
          has_children?: boolean
          id?: string
          interests?: string[]
          language?: string
          plan?: Json | null
          status?: string
          travel_style: string
          traveling_with?: string | null
          user_id: string
          walking_preference?: string | null
        }
        Update: {
          accessibility_needs?: string | null
          activity_intensity?: string | null
          budget?: number
          children_count?: number | null
          city?: string
          country?: string
          created_at?: string
          currency?: string
          days?: number
          food_preferences?: string | null
          has_children?: boolean
          id?: string
          interests?: string[]
          language?: string
          plan?: Json | null
          status?: string
          travel_style?: string
          traveling_with?: string | null
          user_id?: string
          walking_preference?: string | null
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
