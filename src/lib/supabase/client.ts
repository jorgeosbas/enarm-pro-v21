import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Cliente de Supabase para Client Components.
 * Usa la anon key — segura de exponer, protegida por las políticas RLS
 * definidas en supabase/migrations/0001_init.sql.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
