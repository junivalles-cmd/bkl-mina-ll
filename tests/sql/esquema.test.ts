import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { baseDePrueba } from './pglite';

let db: PGlite;
let eq: string;
beforeAll(async () => {
  db = await baseDePrueba();
  eq = (await db.query<{ id: string }>(`insert into equipo (codigo, ahorrativo, familia) values ('15-59','R01','Back Hoe') returning id`)).rows[0].id;
});

describe('esquema', () => {
  it('parámetros por defecto', async () => {
    const r = await db.query<{ clave: string; valor: string }>('select clave, valor::text from parametro order by clave');
    expect(Object.fromEntries(r.rows.map((x) => [x.clave, Number(x.valor)]))).toEqual({
      dias_estimados_def: 1, dias_para_iniciar: 6, factor_tiempo_efectivo: 0.5, hh_por_dia: 8, tipo_cambio: 36.62,
    });
  });
  it('código de equipo único', async () => {
    await expect(db.query(`insert into equipo (codigo) values ('15-59')`)).rejects.toThrow();
  });
  it('cerrar exige fin real, ejecutado por y HH reales', async () => {
    await expect(db.query(`insert into bkl (equipo_id, actividad, prioridad, estado_manual, fin_real, ejecutado_por) values ($1,'x','A','cerrado','2026-11-12','Jean')`, [eq])).rejects.toThrow(/bkl_cierre_completo/);
    await expect(db.query(`insert into bkl (equipo_id, actividad, prioridad, inicio_real, fin_real) values ($1,'x','A','2026-11-12','2026-11-10')`, [eq])).rejects.toThrow(/bkl_fechas_reales/);
  });
  it('guardar_bkl crea, numera, guarda hijos y registra historial', async () => {
    const d = { equipo_id: eq, actividad: 'Cambio', prioridad: 'B', inicio_programado: '2026-11-18', fecha_ingreso: '2026-11-12',
      tareas: [{ orden: 1, descripcion: 'Desmontar' }], repuestos: [{ numero_parte: 'P1', descripcion: 'X', cantidad: 2, precio_usd: 10, stock: 'pedir', tarea_orden: 1 }] };
    const n1 = (await db.query<{ n: number }>('select guardar_bkl($1) as n', [d])).rows[0].n;
    const n2 = (await db.query<{ n: number }>('select guardar_bkl($1) as n', [d])).rows[0].n;
    expect(n2).toBe(n1 + 1);
    await expect(db.query('select guardar_bkl($1)', [{ ...d, repuestos: [{ numero_parte: 'P', cantidad: 0 }] }])).rejects.toThrow();
    const v = (await db.query<{ estado: string; costo_usd: string; inicio_original: string }>(`select estado, costo_usd::text, inicio_original::text from v_bkl where numero = $1`, [n1])).rows[0];
    expect(v).toEqual({ estado: 'PENDIENTE REPUESTOS', costo_usd: '20.00', inicio_original: '2026-11-18' });
  });
  it('numero explícito (importación) mueve la secuencia', async () => {
    await db.query('select guardar_bkl($1)', [{ numero: 500, equipo_id: eq, actividad: 'Importado', prioridad: 'C' }]);
    const n = (await db.query<{ n: number }>('select guardar_bkl($1) as n', [{ equipo_id: eq, actividad: 'Nuevo', prioridad: 'C' }])).rows[0].n;
    expect(n).toBe(501);
  });
  it('reprogramar cuenta y deja historial; inicio original no cambia', async () => {
    const id = (await db.query<{ id: string }>(`insert into bkl (equipo_id, actividad, prioridad, inicio_programado, inicio_original) values ($1,'r','A','2026-11-18','2026-11-18') returning id`, [eq])).rows[0].id;
    await db.query(`update bkl set inicio_programado = '2026-11-25' where id = $1`, [id]);
    await db.query(`update bkl set inicio_programado = '2026-12-02' where id = $1`, [id]);
    const r = (await db.query<{ reprogramaciones: number; inicio_original: string }>(`select reprogramaciones, inicio_original::text from bkl where id=$1`, [id])).rows[0];
    expect(r).toEqual({ reprogramaciones: 2, inicio_original: '2026-11-18' });
    const ev = (await db.query<{ tipo: string }>(`select tipo::text from bkl_evento where bkl_id=$1 order by id`, [id])).rows.map((x) => x.tipo);
    expect(ev).toEqual(['creado', 'reprogramado', 'reprogramado']);
  });
  it('semana ISO 53 en la vista', async () => {
    await db.query('select guardar_bkl($1)', [{ numero: 900, equipo_id: eq, actividad: 'fin de año', prioridad: 'C', inicio_programado: '2027-01-01' }]);
    const r = (await db.query<{ anio: number; semana: number }>('select anio, semana from v_bkl where numero = 900')).rows[0];
    expect(r).toEqual({ anio: 2026, semana: 53 });
  });
  it('origen del BKL se guarda y sale en la vista', async () => {
    const n = (await db.query<{ n: number }>('select guardar_bkl($1) as n', [{ equipo_id: eq, actividad: 'Fuga detectada', prioridad: 'A', origen: 'inspeccion', origen_ref: 'INSP-0457' }])).rows[0].n;
    const v = (await db.query<{ origen: string; origen_ref: string }>('select origen::text, origen_ref from v_bkl where numero = $1', [n])).rows[0];
    expect(v).toEqual({ origen: 'inspeccion', origen_ref: 'INSP-0457' });
    await expect(db.query('select guardar_bkl($1)', [{ equipo_id: eq, actividad: 'x', prioridad: 'A', origen: 'marciano' }])).rejects.toThrow();
  });
});
