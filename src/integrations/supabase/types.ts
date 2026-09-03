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
          color: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          role: Database["public"]["Enums"]["category_role"]
          sort_order: number
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string
          description?: string | null
          icon: string
          id?: string
          name: string
          role: Database["public"]["Enums"]["category_role"]
          sort_order?: number
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["category_role"]
          sort_order?: number
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount_minor: number
          anomaly_dismissed: boolean
          category_id: string
          created_at: string
          currency: string
          date: string
          full_tank: boolean | null
          id: string
          legacy_category:
            | Database["public"]["Enums"]["expense_category"]
            | null
          note: string | null
          odometer_km: number
          quantity: number | null
          receipt_path: string | null
          tags: string[]
          updated_at: string
          user_id: string
          vat_rate: number | null
          vehicle_id: string
        }
        Insert: {
          amount_minor: number
          anomaly_dismissed?: boolean
          category_id: string
          created_at?: string
          currency?: string
          date: string
          full_tank?: boolean | null
          id?: string
          legacy_category?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          note?: string | null
          odometer_km: number
          quantity?: number | null
          receipt_path?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
          vat_rate?: number | null
          vehicle_id: string
        }
        Update: {
          amount_minor?: number
          anomaly_dismissed?: boolean
          category_id?: string
          created_at?: string
          currency?: string
          date?: string
          full_tank?: boolean | null
          id?: string
          legacy_category?:
            | Database["public"]["Enums"]["expense_category"]
            | null
          note?: string | null
          odometer_km?: number
          quantity?: number | null
          receipt_path?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
          vat_rate?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      past_repairs: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          exact_date: string | null
          id: string
          label: string
          month: number | null
          precision: Database["public"]["Enums"]["date_precision"]
          representative_date: string
          season: Database["public"]["Enums"]["season"] | null
          user_id: string
          vat_rate: number | null
          vehicle_id: string
          year: number
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          exact_date?: string | null
          id?: string
          label: string
          month?: number | null
          precision: Database["public"]["Enums"]["date_precision"]
          representative_date: string
          season?: Database["public"]["Enums"]["season"] | null
          user_id: string
          vat_rate?: number | null
          vehicle_id: string
          year: number
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          exact_date?: string | null
          id?: string
          label?: string
          month?: number | null
          precision?: Database["public"]["Enums"]["date_precision"]
          representative_date?: string
          season?: Database["public"]["Enums"]["season"] | null
          user_id?: string
          vat_rate?: number | null
          vehicle_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "past_repairs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          consumption_style: Database["public"]["Enums"]["consumption_style"]
          created_at: string
          currency: string
          default_cost_per_km_mode: string
          distance_unit: Database["public"]["Enums"]["distance_unit"]
          locale: string
          show_prices_ex_vat: boolean
          updated_at: string
          user_id: string
          volume_unit: Database["public"]["Enums"]["volume_unit"]
        }
        Insert: {
          consumption_style?: Database["public"]["Enums"]["consumption_style"]
          created_at?: string
          currency?: string
          default_cost_per_km_mode?: string
          distance_unit?: Database["public"]["Enums"]["distance_unit"]
          locale?: string
          show_prices_ex_vat?: boolean
          updated_at?: string
          user_id: string
          volume_unit?: Database["public"]["Enums"]["volume_unit"]
        }
        Update: {
          consumption_style?: Database["public"]["Enums"]["consumption_style"]
          created_at?: string
          currency?: string
          default_cost_per_km_mode?: string
          distance_unit?: Database["public"]["Enums"]["distance_unit"]
          locale?: string
          show_prices_ex_vat?: boolean
          updated_at?: string
          user_id?: string
          volume_unit?: Database["public"]["Enums"]["volume_unit"]
        }
        Relationships: []
      }
      recurring_costs: {
        Row: {
          amount_minor_per_year: number
          created_at: string
          currency: string
          id: string
          label: string | null
          type: Database["public"]["Enums"]["recurring_type"]
          user_id: string
          vat_rate: number | null
          vehicle_id: string
        }
        Insert: {
          amount_minor_per_year: number
          created_at?: string
          currency?: string
          id?: string
          label?: string | null
          type: Database["public"]["Enums"]["recurring_type"]
          user_id: string
          vat_rate?: number | null
          vehicle_id: string
        }
        Update: {
          amount_minor_per_year?: number
          created_at?: string
          currency?: string
          id?: string
          label?: string | null
          type?: Database["public"]["Enums"]["recurring_type"]
          user_id?: string
          vat_rate?: number | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_costs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          created_at: string
          due_date: string | null
          due_odometer_km: number | null
          id: string
          note: string | null
          type: Database["public"]["Enums"]["reminder_type"]
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          due_odometer_km?: number | null
          id?: string
          note?: string | null
          type: Database["public"]["Enums"]["reminder_type"]
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          due_odometer_km?: number | null
          id?: string
          note?: string | null
          type?: Database["public"]["Enums"]["reminder_type"]
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          currency: string
          current_odometer_km: number
          estimated_resale_value_minor: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          name: string
          photo_path: string | null
          plate: string | null
          purchase_date: string
          purchase_odometer_km: number
          purchase_price_minor: number
          purchase_vat_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          current_odometer_km?: number
          estimated_resale_value_minor?: number | null
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id?: string
          name: string
          photo_path?: string | null
          plate?: string | null
          purchase_date: string
          purchase_odometer_km?: number
          purchase_price_minor?: number
          purchase_vat_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          current_odometer_km?: number
          estimated_resale_value_minor?: number | null
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          name?: string
          photo_path?: string | null
          plate?: string | null
          purchase_date?: string
          purchase_odometer_km?: number
          purchase_price_minor?: number
          purchase_vat_rate?: number | null
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
      delete_own_account_data: { Args: never; Returns: undefined }
      seed_default_categories: {
        Args: { _user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      category_role: "fuel" | "routine" | "repair" | "admin" | "other"
      consumption_style: "l_per_100km" | "km_per_l" | "mpg"
      date_precision: "exact" | "month" | "season" | "year"
      distance_unit: "km" | "mi"
      expense_category: "fuel" | "service" | "admin" | "other"
      fuel_type: "diesel" | "petrol" | "lpg" | "hybrid" | "electric"
      recurring_type:
        | "insurance"
        | "road_tax"
        | "inspection"
        | "parking"
        | "other"
      reminder_type:
        | "service"
        | "insurance"
        | "inspection"
        | "tyre_change"
        | "other"
      season: "spring" | "summer" | "autumn" | "winter"
      volume_unit: "l" | "gal"
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
    Enums: {
      category_role: ["fuel", "routine", "repair", "admin", "other"],
      consumption_style: ["l_per_100km", "km_per_l", "mpg"],
      date_precision: ["exact", "month", "season", "year"],
      distance_unit: ["km", "mi"],
      expense_category: ["fuel", "service", "admin", "other"],
      fuel_type: ["diesel", "petrol", "lpg", "hybrid", "electric"],
      recurring_type: [
        "insurance",
        "road_tax",
        "inspection",
        "parking",
        "other",
      ],
      reminder_type: [
        "service",
        "insurance",
        "inspection",
        "tyre_change",
        "other",
      ],
      season: ["spring", "summer", "autumn", "winter"],
      volume_unit: ["l", "gal"],
    },
  },
} as const
