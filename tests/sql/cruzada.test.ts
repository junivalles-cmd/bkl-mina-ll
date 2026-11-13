import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { baseDePrueba, SELECT_JSON } from './pglite';
import { Bkl, type BklDatos } from '../../src/dominio/bkl';
import { PARAMETROS_DEF as P } from '../../src/dominio/parametros';
import { bklAFila, filaABkl } from '../../src/datos/mapeo';

const HOY = '2026-11-12';
let db: PGlite;
let eq: string;
const sc: Record<string, string> = {};

const rep = (o: Record<string, unknown> = {}) => ({ tareaOrden: null, codigoGp: '1', numeroParte: 'P', descripcion: 'X', cantidad: 2, almacen: 'NIMAC', ubicacion: '', precioUsd: 10.5, stock: 'disponible', ...o });

function casos(): Partial<BklDatos>[] {
  return [
    {},
    { inicioProgramado: null, prioridad: 'C' },
    { repuestos: [rep(), rep({ stock: 'pedir' })] as never },
    { repuestos: [rep({ stock: 'pedir', solicitudId: sc.aprobada })] as never },
    { repuestos: [rep({ stock: 'pedir', solicitudId: sc.cancelada })] as never, inicioProgramado: '2026-11-25' },
    { repuestos: [rep({ stock: 'pedir', solicitudId: sc.recibida, cantidad: 3, precioUsd: 2445.27 })] as never },
    { inicioReal: '2026-11-05', finReal: '2026-11-07', diasEstimados: 2.5 },
    { inicioReal: '2026-11-12', hhEstimadas: 13.5 },
    { estadoManual: 'cancelado' },
    { estadoManual: 'cerrado', inicioReal: '2026-11-01', finReal: '2026-11-02', ejecutadoPor: 'Gelber', hhReales: 6 },
    { estadoManual: 'pendiente_repuestos', prioridad: 'B', fechaIngreso: '2026-06-01', inicioProgramado: '2026-12-29', inicioOriginal: '2026-12-29' },
    { inicioProgramado: '2027-01-01', inicioOriginal: '2027-01-01', diasEstimados: 0 },
  ];
}

beforeAll(async () => {
  db = await baseDePrueba(HOY);
  eq = (await db.query<{ id: string }>(`insert into equipo (codigo) values ('45-86') returning id`)).rows[0].id;
  for (const e of ['aprobada', 'cancelada', 'recibida']) {
    sc[e] = (await db.query<{ id: string }>(`insert into solicitud_compra (equipo_id, estado) values ($1, $2) returning id`, [eq, e])).rows[0].id;
  }
  for (const c of casos()) {
    const b = new Bkl({ ...Bkl.nuevo({ equipoId: eq, actividad: 'Prueba', prioridad: 'A' }, P, '2026-10-23').datos(), ...c });
    await db.query('select guardar_bkl($1)', [bklAFila(b)]);
  }
});

describe('vista v_bkl = clase Bkl', () => {
  it('mismos resultados para cada caso', async () => {
    const filas = (await db.query<{ fila: Record<string, unknown> }>(SELECT_JSON + ' order by numero')).rows.map((r) => r.fila);
    const vista = (await db.query<Record<string, unknown>>(`select numero, numero_texto, estado, estado_repuestos, situacion, fin_programado::text,
       hh::float8 as hh, costo_usd::float8 as costo_usd, puntaje::float8 as puntaje, dias_abierto, anio, semana, por_pedir, en_sc from v_bkl order by numero`)).rows;
    expect(filas).toHaveLength(casos().length);
    filas.forEach((f, i) => {
      const b = filaABkl(f);
      const v = vista[i];
      const sp = b.semanaPlan();
      expect({
        numero_texto: b.numeroTexto(), estado: b.estado(), estado_repuestos: b.estadoRepuestos(), situacion: b.situacion(HOY),
        fin_programado: b.finProgramado(), hh: b.hh(P), costo_usd: b.costoUsd(), puntaje: b.puntaje(HOY),
        dias_abierto: b.diasAbierto(HOY), anio: sp?.anio ?? null, semana: sp?.semana ?? null, por_pedir: b.porPedir(), en_sc: b.enSc(),
      }, `caso ${i}`).toEqual({
        numero_texto: v.numero_texto, estado: v.estado, estado_repuestos: v.estado_repuestos, situacion: v.situacion,
        fin_programado: v.fin_programado, hh: v.hh, costo_usd: v.costo_usd, puntaje: v.puntaje,
        dias_abierto: v.dias_abierto, anio: v.anio, semana: v.semana, por_pedir: v.por_pedir, en_sc: v.en_sc,
      });
    });
    // cobertura: todos los estados aparecen
    expect(new Set(vista.map((v) => v.estado))).toEqual(new Set(['PROGRAMADO', 'LISTO PARA PROGRAMAR', 'PENDIENTE REPUESTOS', 'EJECUTADO', 'EN EJECUCIÓN', 'CANCELADO', 'CERRADO']));
  });
  it('ida y vuelta: guardar y leer conserva los datos', async () => {
    const f = (await db.query<{ fila: Record<string, unknown> }>(SELECT_JSON + ' where numero = 3')).rows[0].fila;
    const b = filaABkl(f);
    expect(b.d.repuestos.map((r) => r.stock)).toEqual(['disponible', 'pedir']);
    expect(b.d.repuestos[0].precioUsd).toBe(10.5);
    expect(b.d.inicioOriginal).toBe('2026-10-29');
  });
});
