import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase-Client aus den VITE_-Variablen. Fehlen sie, läuft die App trotzdem:
// `backendConfigured` ist dann false und die Screens zeigen einen ruhigen Hinweis.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const SUPABASE_URL = url.replace(/\/$/, '');
export const SUPABASE_ANON_KEY = anonKey;
export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const BACKEND_HINT = 'Backend nicht verbunden.';
export const BACKEND_HINT_SUB = 'Schlüssel in web/.env eintragen und neu laden.';

/** Fehler mit anzeigbarem deutschem Text. */
export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Magic Link landet auf /auth/callback; supabase-js liest die Tokens aus der URL.
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/** Client holen oder mit dem Hinweis abbrechen. */
export function requireClient(): SupabaseClient {
  if (!supabase) throw new ApiError(BACKEND_HINT);
  return supabase;
}
