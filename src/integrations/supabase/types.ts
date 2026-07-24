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
      categories: {
        Row: {
          championship_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          championship_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          championship_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      championships: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          red_card_suspension_matches: number
          updated_at: string
          year: number
          yellow_cards_for_suspension: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          red_card_suspension_matches?: number
          updated_at?: string
          year: number
          yellow_cards_for_suspension?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          red_card_suspension_matches?: number
          updated_at?: string
          year?: number
          yellow_cards_for_suspension?: number
        }
        Relationships: []
      }
      match_events: {
        Row: {
          created_at: string
          id: string
          match_id: string
          minute: number | null
          notes: string | null
          player_id: string | null
          team_id: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          minute?: number | null
          notes?: string | null
          player_id?: string | null
          team_id: string
          type: Database["public"]["Enums"]["event_type"]
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          minute?: number | null
          notes?: string | null
          player_id?: string | null
          team_id?: string
          type?: Database["public"]["Enums"]["event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          championship_id: string
          created_at: string
          duration_minutes: number | null
          group_name: string | null
          home_score: number | null
          home_team_id: string | null
          id: string
          match_date: string | null
          matchday: number | null
          mvp_player_id: string | null
          notes: string | null
          phase: Database["public"]["Enums"]["tournament_phase"]
          referee_assistant: string | null
          referee_main: string | null
          referee_user_id: string | null
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          championship_id: string
          created_at?: string
          duration_minutes?: number | null
          group_name?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          match_date?: string | null
          matchday?: number | null
          mvp_player_id?: string | null
          notes?: string | null
          phase?: Database["public"]["Enums"]["tournament_phase"]
          referee_assistant?: string | null
          referee_main?: string | null
          referee_user_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          championship_id?: string
          created_at?: string
          duration_minutes?: number | null
          group_name?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          match_date?: string | null
          matchday?: number | null
          mvp_player_id?: string | null
          notes?: string | null
          phase?: Database["public"]["Enums"]["tournament_phase"]
          referee_assistant?: string | null
          referee_main?: string | null
          referee_user_id?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_mvp_player_id_fkey"
            columns: ["mvp_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          body: string | null
          championship_id: string | null
          created_at: string
          id: string
          published: boolean
          title: string
        }
        Insert: {
          body?: string | null
          championship_id?: string | null
          created_at?: string
          id?: string
          published?: boolean
          title: string
        }
        Update: {
          body?: string | null
          championship_id?: string | null
          created_at?: string
          id?: string
          published?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          enabled: boolean
          full_name: string
          id: string
          is_captain: boolean
          is_vice_captain: boolean
          jersey_number: number | null
          national_id: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          position: Database["public"]["Enums"]["player_position"]
          status: Database["public"]["Enums"]["player_status"]
          team_id: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          enabled?: boolean
          full_name: string
          id?: string
          is_captain?: boolean
          is_vice_captain?: boolean
          jersey_number?: number | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: Database["public"]["Enums"]["player_position"]
          status?: Database["public"]["Enums"]["player_status"]
          team_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          enabled?: boolean
          full_name?: string
          id?: string
          is_captain?: boolean
          is_vice_captain?: boolean
          jersey_number?: number | null
          national_id?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: Database["public"]["Enums"]["player_position"]
          status?: Database["public"]["Enums"]["player_status"]
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suspensions: {
        Row: {
          championship_id: string
          created_at: string
          id: string
          matches_remaining: number
          origin_match_id: string | null
          player_id: string
          reason: string
        }
        Insert: {
          championship_id: string
          created_at?: string
          id?: string
          matches_remaining?: number
          origin_match_id?: string | null
          player_id: string
          reason: string
        }
        Update: {
          championship_id?: string
          created_at?: string
          id?: string
          matches_remaining?: number
          origin_match_id?: string | null
          player_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "suspensions_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspensions_origin_match_id_fkey"
            columns: ["origin_match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspensions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          active: boolean
          category_id: string | null
          championship_id: string
          created_at: string
          delegate_name: string | null
          delegate_photo_url: string | null
          delegate_registered_at: string | null
          delegate_role: string | null
          delegate_user_id: string | null
          email: string | null
          founded_year: number | null
          group_name: string | null
          id: string
          logo_url: string | null
          name: string
          participation_year: number | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          short_name: string | null
          sigla: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          championship_id: string
          created_at?: string
          delegate_name?: string | null
          delegate_photo_url?: string | null
          delegate_registered_at?: string | null
          delegate_role?: string | null
          delegate_user_id?: string | null
          email?: string | null
          founded_year?: number | null
          group_name?: string | null
          id?: string
          logo_url?: string | null
          name: string
          participation_year?: number | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          short_name?: string | null
          sigla?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          championship_id?: string
          created_at?: string
          delegate_name?: string | null
          delegate_photo_url?: string | null
          delegate_registered_at?: string | null
          delegate_role?: string | null
          delegate_user_id?: string | null
          email?: string | null
          founded_year?: number | null
          group_name?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          participation_year?: number | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          short_name?: string | null
          sigla?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_championship_id_fkey"
            columns: ["championship_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      current_user_active: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_match_referee: { Args: { _match_id: string }; Returns: boolean }
      is_team_delegate: { Args: { _team_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "delegado" | "arbitro"
      event_type: "gol" | "autogol" | "amarilla" | "roja" | "asistencia" | "mvp"
      match_status:
        | "pendiente"
        | "en_juego"
        | "finalizado"
        | "suspendido"
        | "reprogramado"
      player_position: "arquero" | "defensa" | "ala" | "pivot" | "universal"
      player_status: "activo" | "suspendido" | "lesionado" | "inhabilitado"
      tournament_phase:
        | "grupos"
        | "liguilla_a"
        | "liguilla_b"
        | "semifinal"
        | "tercer_lugar"
        | "final"
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
      app_role: ["admin", "delegado", "arbitro"],
      event_type: ["gol", "autogol", "amarilla", "roja", "asistencia", "mvp"],
      match_status: [
        "pendiente",
        "en_juego",
        "finalizado",
        "suspendido",
        "reprogramado",
      ],
      player_position: ["arquero", "defensa", "ala", "pivot", "universal"],
      player_status: ["activo", "suspendido", "lesionado", "inhabilitado"],
      tournament_phase: [
        "grupos",
        "liguilla_a",
        "liguilla_b",
        "semifinal",
        "tercer_lugar",
        "final",
      ],
    },
  },
} as const
