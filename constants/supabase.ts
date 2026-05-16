/**
 * Supabase / OnSpace Cloud connection constants.
 *
 * The template's getSupabaseClient() reads EXPO_PUBLIC_SUPABASE_* directly
 * from process.env (injected by Metro from the .env file managed by OnSpace).
 * This file is only used by app-level code that needs the URL/key directly.
 *
 * DO NOT add fallback hard-coded keys here — they can override the correct
 * auto-managed key and cause JWT signature errors.
 */

export const SUPABASE_URL: string =
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string) ?? '';

export const SUPABASE_ANON_KEY: string =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ?? '';
