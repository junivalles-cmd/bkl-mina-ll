import type { SupabaseClient } from '@supabase/supabase-js';
import { Bkl } from '../dominio/bkl';
import { CLAVES_PARAMETRO, PARAMETROS_DEF, type Parametros } from '../dominio/parametros';
import { bklAFila, filaABkl, filaAEquipo, filaAPerfil, SELECT_BKL } from './mapeo';
import type { Equipo, Repos } from './tipos';

function revisar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(traducirError(r.error.message));
  return r.data;
}

export function traducirError(m: string): string {
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permiso para esta acción.';
  if (/bkl_cierre_completo/.test(m)) return 'Para cerrar se necesita fin real, ejecutado por y HH reales.';
  if (/bkl_fechas_reales/.test(m)) return 'El fin real no puede ser antes del inicio real.';
  if (/equipo_codigo_key/.test(m)) return 'Ya existe un equipo con ese código.';
  if (/equipo_ahorrativo_key/.test(m)) return 'Ya existe un equipo con ese ahorrativo.';
  if (/bkl_numero_key/.test(m)) return 'Ya existe un BKL con ese número.';
  return m;
}

const equipoAFila = (e: Omit<Equipo, 'id'> & { id?: string }) => ({
  ...(e.id ? { id: e.id } : {}), codigo: e.codigo, ahorrativo: e.ahorrativo || null, familia: e.familia, marca: e.marca,
  modelo: e.modelo, serie: e.serie, ubicacion: e.ubicacion, criticidad: e.criticidad, activo: e.activo,
});

export function reposSupabase(sb: SupabaseClient): Repos {
  return {
    equipos: {
      async listar() { return revisar(await sb.from('equipo').select('*').order('codigo')).map(filaAEquipo); },
      async guardar(e) { return filaAEquipo(revisar(await sb.from('equipo').upsert(equipoAFila(e), { onConflict: e.id ? 'id' : 'codigo' }).select().single())); },
      async guardarVarios(es) {
        if (!es.length) return 0;
        revisar(await sb.from('equipo').upsert(es.map((e) => { const { id: _id, ...resto } = equipoAFila(e) as Record<string, unknown>; return resto; }), { onConflict: 'codigo' }));
        return es.length;
      },
    },
    perfiles: {
      async listar() { return revisar(await sb.from('perfil').select('*').order('nombre')).map(filaAPerfil); },
      async actual() {
        const { data } = await sb.auth.getUser();
        if (!data.user) return null;
        const r = await sb.from('perfil').select('*').eq('id', data.user.id).maybeSingle();
        return r.data ? filaAPerfil(r.data) : null;
      },
    },
    parametros: {
      async obtener() {
        const filas = revisar(await sb.from('parametro').select('clave, valor')) as { clave: string; valor: number }[];
        const p: Parametros = { ...PARAMETROS_DEF };
        for (const [k, clave] of Object.entries(CLAVES_PARAMETRO)) {
          const f = filas.find((x) => x.clave === clave);
          if (f) p[k as keyof Parametros] = Number(f.valor);
        }
        return p;
      },
      async guardar(p) {
        revisar(await sb.from('parametro').upsert(Object.entries(CLAVES_PARAMETRO).map(([k, clave]) => ({ clave, valor: p[k as keyof Parametros] }))));
      },
    },
    bkls: {
      async listar() { return revisar(await sb.from('bkl').select(SELECT_BKL).order('numero')).map(filaABkl); },
      async obtener(numero) {
        const f = revisar(await sb.from('bkl').select(SELECT_BKL).eq('numero', numero).maybeSingle());
        return f ? filaABkl(f) : null;
      },
      async guardar(b: Bkl) { return Number(revisar(await sb.rpc('guardar_bkl', { d: bklAFila(b) }))); },
      async eventos(numero) {
        const f = revisar(await sb.from('bkl').select('bkl_evento(tipo, detalle, fecha, perfil:usuario_id(nombre))').eq('numero', numero).maybeSingle()) as
          { bkl_evento: { tipo: string; detalle: Record<string, unknown>; fecha: string; perfil: { nombre: string } | null }[] } | null;
        return (f?.bkl_evento ?? []).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((e) => ({ tipo: e.tipo, detalle: e.detalle, fecha: e.fecha, usuario: e.perfil?.nombre ?? null }));
      },
    },
  };
}
