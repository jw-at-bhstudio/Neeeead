export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CreatureStatus = "private_draft" | "public_pool" | "archived";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creatures: {
        Row: {
          id: string;
          creator_id: string;
          owner_id: string;
          title: string;
          status: CreatureStatus;
          seed: number;
          params: Json;
          shape: Json;
          eyes: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          owner_id: string;
          title?: string;
          status?: CreatureStatus;
          seed: number;
          params?: Json;
          shape?: Json;
          eyes?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          owner_id?: string;
          title?: string;
          status?: CreatureStatus;
          seed?: number;
          params?: Json;
          shape?: Json;
          eyes?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      creature_status: CreatureStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
