import type { BklDatos } from '../dominio/bkl';
import { Bkl } from '../dominio/bkl';
import type { EstadoSc, RepuestoDatos } from '../dominio/repuesto';
import type { Equipo, Perfil } from './tipos';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fila = Record<string, any>;

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

/** Fila de Supabase/PostgREST (`bkl` con `bkl_tarea` y `bkl_repuesto(solicitud_compra)` anidados) → Bkl. */
export function filaABkl(f: Fila): Bkl {
  const repuestos: RepuestoDatos[] = [...(f.bkl_repuesto ?? [])]
    .sort((a: Fila, b: Fila) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((r: Fila) => ({
      id: r.id,
      tareaOrden: num(r.tarea_orden),
      codigoGp: r.codigo_gp ?? '',
      numeroParte: r.numero_parte ?? '',
      descripcion: r.descripcion ?? '',
      cantidad: Number(r.cantidad),
      almacen: r.almacen ?? '',
      ubicacion: r.ubicacion ?? '',
      precioUsd: Number(r.precio_usd ?? 0),
      stock: r.stock,
      solicitudId: r.solicitud_id ?? null,
      sc: r.solicitud_compra ? { numero: Number(r.solicitud_compra.numero), estado: r.solicitud_compra.estado as EstadoSc } : null,
      kitListo: !!r.kit_listo,
    }));
  const d: BklDatos = {
    id: f.id,
    numero: Number(f.numero),
    equipoId: f.equipo_id,
    actividad: f.actividad,
    sistema: f.sistema ?? '',
    prioridad: f.prioridad,
    responsableId: f.responsable_id ?? null,
    plannerId: f.planner_id ?? null,
    hhEstimadas: num(f.hh_estimadas),
    diasEstimados: Number(f.dias_estimados ?? 1),
    tecnicos: num(f.tecnicos),
    fechaIngreso: f.fecha_ingreso,
    inicioProgramado: f.inicio_programado ?? null,
    inicioOriginal: f.inicio_original ?? null,
    inicioReal: f.inicio_real ?? null,
    finReal: f.fin_real ?? null,
    hhReales: num(f.hh_reales),
    ejecutadoPor: f.ejecutado_por ?? null,
    horometro: num(f.horometro),
    noOt: f.no_ot ?? null,
    observaciones: f.observaciones ?? null,
    estadoManual: f.estado_manual ?? null,
    reprogramaciones: Number(f.reprogramaciones ?? 0),
    tareas: [...(f.bkl_tarea ?? [])]
      .sort((a: Fila, b: Fila) => a.orden - b.orden)
      .map((t: Fila) => ({ orden: t.orden, descripcion: t.descripcion, hecha: !!t.hecha, observacion: t.observacion ?? null })),
    repuestos,
  };
  return new Bkl(d);
}

/** Bkl → JSON que recibe la función SQL `guardar_bkl`. */
export function bklAFila(b: Bkl): Fila {
  const d = b.d;
  return {
    id: d.id ?? null,
    numero: d.numero ?? null,
    equipo_id: d.equipoId,
    actividad: d.actividad,
    sistema: d.sistema,
    prioridad: d.prioridad,
    responsable_id: d.responsableId,
    planner_id: d.plannerId,
    hh_estimadas: d.hhEstimadas,
    dias_estimados: d.diasEstimados,
    tecnicos: d.tecnicos,
    fecha_ingreso: d.fechaIngreso,
    inicio_programado: d.inicioProgramado,
    inicio_original: d.inicioOriginal,
    inicio_real: d.inicioReal,
    fin_real: d.finReal,
    hh_reales: d.hhReales,
    ejecutado_por: d.ejecutadoPor,
    horometro: d.horometro,
    no_ot: d.noOt,
    observaciones: d.observaciones,
    estado_manual: d.estadoManual,
    tareas: d.tareas.map((t) => ({ orden: t.orden, descripcion: t.descripcion, hecha: t.hecha, observacion: t.observacion ?? null })),
    repuestos: d.repuestos.map((r) => ({
      tarea_orden: r.tareaOrden, codigo_gp: r.codigoGp, numero_parte: r.numeroParte, descripcion: r.descripcion,
      cantidad: r.cantidad, almacen: r.almacen, ubicacion: r.ubicacion, precio_usd: r.precioUsd, stock: r.stock,
      solicitud_id: r.solicitudId ?? null, kit_listo: !!r.kitListo,
    })),
  };
}

export function filaAEquipo(f: Fila): Equipo {
  return {
    id: f.id, codigo: f.codigo, ahorrativo: f.ahorrativo ?? null, familia: f.familia ?? '', marca: f.marca ?? '',
    modelo: f.modelo ?? '', serie: f.serie ?? null, ubicacion: f.ubicacion ?? '', criticidad: f.criticidad ?? null, activo: f.activo !== false,
  };
}

export function filaAPerfil(f: Fila): Perfil {
  return { id: f.id, usuario: f.usuario, nombre: f.nombre, correo: f.correo ?? null, rol: f.rol, hhSemana: Number(f.hh_semana ?? 0), activo: f.activo !== false };
}

/** Select anidado usado por el repositorio Supabase. */
export const SELECT_BKL = '*, bkl_tarea(*), bkl_repuesto(*, solicitud_compra(numero, estado))';
