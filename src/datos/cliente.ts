import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cliente) {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_KEY as string;
    if (!url || !key) throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_KEY');
    cliente = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return cliente;
}

export const DOMINIO_USUARIO = 'bkl-mina-ll.app';

/** "jsoza" → "jsoza@bkl-mina-ll.app"; un correo se deja igual. */
export function correoDeUsuario(usuario: string): string {
  const u = usuario.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${DOMINIO_USUARIO}`;
}
