import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

/** Postgres en memoria con lo mínimo de Supabase (auth.users, auth.uid(), roles) + las migraciones. */
export async function baseDePrueba(hoy = '2026-11-12'): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create role anon; create role authenticated;
  `);
  for (const f of readdirSync('supabase/migrations').filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'));
  }
  await db.exec(`set app.hoy = '${hoy}'`);
  return db;
}

export const SELECT_JSON = `
  select to_jsonb(b) || jsonb_build_object(
    'bkl_tarea', coalesce((select jsonb_agg(t) from bkl_tarea t where t.bkl_id = b.id), '[]'::jsonb),
    'bkl_repuesto', coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('solicitud_compra',
        (select jsonb_build_object('numero', s.numero, 'estado', s.estado) from solicitud_compra s where s.id = r.solicitud_id)))
      from bkl_repuesto r where r.bkl_id = b.id), '[]'::jsonb)) as fila
  from bkl b`;
