// Placeholder types — run `supabase gen types typescript` to regenerate with full schema.
// Using open record types so the client compiles without `as any` casts on every query.
// Queries still receive `unknown` rows; callers cast results to their local interfaces.

type AnyTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: {
    foreignKeyName: string;
    columns: string[];
    isOneToOne?: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }[];
};

type AnyView = {
  Row: Record<string, unknown>;
  Relationships: {
    foreignKeyName: string;
    columns: string[];
    isOneToOne?: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }[];
};

type AnyFunction = {
  Args: Record<string, unknown>;
  Returns: unknown;
};

export type Database = {
  public: {
    Tables: Record<string, AnyTable>;
    Views: Record<string, AnyView>;
    Functions: Record<string, AnyFunction>;
    Enums: Record<string, string[]>;
  };
};
