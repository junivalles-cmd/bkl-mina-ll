import { ReglaNegocioError } from './errores';
import { difDias, semanaIso, sumarDias, type Fecha } from './fechas';
import type { Parametros } from './parametros';
import { Repuesto, type RepuestoDatos } from './repuesto';

export type Prioridad = 'A' | 'B' | 'C';
export type EstadoManual = null | 'pendiente_repuestos' | 'cerrado' | 'cancelado';
export type EstadoBkl = 'CERRADO' | 'CANCELADO' | 'EJECUTADO' | 'EN EJECUCIÓN' | 'PENDIENTE REPUESTOS' | 'PROGRAMADO' | 'LISTO PARA PROGRAMAR';
export type Situacion = 'CANCELADO' | 'EJECUTADO' | 'EJECUTADO CON RETRASO' | 'RETRASADO' | 'RETRASADO – REPUESTOS' | 'EN EJECUCIÓN' | 'ESPERA REPUESTOS' | 'PENDIENTE';

export type OrigenBkl = 'inspeccion' | 'reporte_falla' | 'checklist' | 'pm' | 'predictivo' | 'operador' | 'otro';

/** De dónde salió el BKL. */
export const ORIGENES: { valor: OrigenBkl; etiqueta: string }[] = [
  { valor: 'inspeccion', etiqueta: 'Inspección' },
  { valor: 'reporte_falla', etiqueta: 'Reporte de falla' },
  { valor: 'checklist', etiqueta: 'Check list' },
  { valor: 'pm', etiqueta: 'PM / servicio' },
  { valor: 'predictivo', etiqueta: 'Predictivo (aceite, filtros, tapones)' },
  { valor: 'operador', etiqueta: 'Reporte de operador' },
  { valor: 'otro', etiqueta: 'Otro' },
];

export const textoOrigen = (o: OrigenBkl | null | undefined) => ORIGENES.find((x) => x.valor === o)?.etiqueta ?? '';

export const MAX_TAREAS = 20;
export const PUNTOS_PRIORIDAD: Record<Prioridad, number> = { A: 50, B: 30, C: 10 };

export interface Tarea {
  orden: number;
  descripcion: string;
  hecha: boolean;
  observacion?: string | null;
}

export interface BklDatos {
  id?: string;
  numero?: number;
  equipoId: string;
  actividad: string;
  sistema: string;
  prioridad: Prioridad;
  /** De dónde salió: inspección, reporte de falla, check list… */
  origen: OrigenBkl | null;
  /** No. de inspección, informe de falla, check list u OT de origen. */
  origenRef: string | null;
  responsableId: string | null;
  plannerId: string | null;
  hhEstimadas: number | null;
  diasEstimados: number;
  /** Nombres de los técnicos asignados (texto libre, como en el V17). */
  tecnicos: string | null;
  fechaIngreso: Fecha;
  inicioProgramado: Fecha | null;
  inicioOriginal: Fecha | null;
  inicioReal: Fecha | null;
  finReal: Fecha | null;
  hhReales: number | null;
  ejecutadoPor: string | null;
  horometro: number | null;
  noOt: string | null;
  observaciones: string | null;
  estadoManual: EstadoManual;
  tareas: Tarea[];
  repuestos: RepuestoDatos[];
  reprogramaciones?: number;
}

export function numeroBklTexto(n: number | undefined): string {
  return n === undefined ? 'BKL nuevo' : 'BKL-' + String(n).padStart(3, '0');
}

export interface DatosCierre {
  finReal: Fecha | null;
  ejecutadoPor: string | null;
  hhReales: number | null;
  inicioReal?: Fecha | null;
}

export class Bkl {
  readonly d: BklDatos;

  constructor(d: BklDatos) {
    this.d = { ...d, tareas: d.tareas.map((t) => ({ ...t })), repuestos: d.repuestos.map((r) => ({ ...r })) };
  }

  static nuevo(e: Partial<BklDatos> & Pick<BklDatos, 'equipoId' | 'actividad' | 'prioridad'>, p: Parametros, hoy: Fecha): Bkl {
    const fechaIngreso = e.fechaIngreso ?? hoy;
    const inicio = e.inicioProgramado === undefined ? sumarDias(fechaIngreso, p.diasParaIniciar) : e.inicioProgramado;
    return new Bkl({
      sistema: '', origen: null, origenRef: null, responsableId: null, plannerId: null, hhEstimadas: null, tecnicos: null,
      inicioReal: null, finReal: null, hhReales: null, ejecutadoPor: null, horometro: null, noOt: null,
      observaciones: null, estadoManual: null, tareas: [], repuestos: [], reprogramaciones: 0,
      ...e,
      diasEstimados: e.diasEstimados ?? p.diasEstimadosDef,
      fechaIngreso,
      inicioProgramado: inicio,
      inicioOriginal: e.inicioOriginal ?? inicio,
    });
  }

  datos(): BklDatos {
    return new Bkl(this.d).d;
  }

  numeroTexto(): string {
    return numeroBklTexto(this.d.numero);
  }

  repuestos(): Repuesto[] {
    return this.d.repuestos.map((r) => new Repuesto(r));
  }

  hh(p: Parametros): number {
    return this.d.hhEstimadas ?? Math.max(1, this.d.diasEstimados) * p.hhPorDia;
  }

  private dias(): number {
    return Math.max(1, this.d.diasEstimados || 0);
  }

  finProgramado(): Fecha | null {
    return this.d.inicioProgramado ? sumarDias(this.d.inicioProgramado, Math.floor(this.dias() - 1)) : null;
  }

  costoUsd(): number {
    return Math.round(this.repuestos().reduce((s, r) => s + r.total(), 0) * 100) / 100;
  }

  porPedir(): number {
    return this.repuestos().filter((r) => r.porPedir()).length;
  }

  enSc(): number {
    return this.repuestos().filter((r) => r.enSc()).length;
  }

  estadoRepuestos(): string {
    const pp = this.porPedir();
    if (pp > 0) return `FALTA PEDIR ${pp}`;
    const sc = this.enSc();
    if (sc > 0) return `EN ESPERA: ${sc} EN SC`;
    return this.d.repuestos.length === 0 ? 'SIN REPUESTOS' : 'COMPLETOS';
  }

  repuestosCompletos(): boolean {
    return this.porPedir() === 0 && this.enSc() === 0;
  }

  estado(): EstadoBkl {
    const d = this.d;
    if (d.estadoManual === 'cancelado') return 'CANCELADO';
    if (d.estadoManual === 'cerrado') return 'CERRADO';
    if (d.finReal) return 'EJECUTADO';
    if (d.inicioReal) return 'EN EJECUCIÓN';
    if (!this.repuestosCompletos() || d.estadoManual === 'pendiente_repuestos') return 'PENDIENTE REPUESTOS';
    if (d.inicioProgramado) return 'PROGRAMADO';
    return 'LISTO PARA PROGRAMAR';
  }

  abierto(): boolean {
    const e = this.estado();
    return e !== 'EJECUTADO' && e !== 'CERRADO' && e !== 'CANCELADO';
  }

  situacion(hoy: Fecha): Situacion {
    const e = this.estado();
    if (e === 'CANCELADO') return 'CANCELADO';
    if (this.d.finReal) {
      const base = this.d.inicioOriginal ?? this.d.inicioProgramado;
      if (base && this.d.finReal > sumarDias(base, Math.floor(this.dias() - 1))) return 'EJECUTADO CON RETRASO';
      return 'EJECUTADO';
    }
    const fin = this.finProgramado();
    if (fin && fin < hoy) return e === 'PENDIENTE REPUESTOS' ? 'RETRASADO – REPUESTOS' : 'RETRASADO';
    if (e === 'EN EJECUCIÓN') return 'EN EJECUCIÓN';
    if (e === 'PENDIENTE REPUESTOS') return 'ESPERA REPUESTOS';
    return 'PENDIENTE';
  }

  diasAbierto(hoy: Fecha): number {
    return difDias(this.d.finReal ?? hoy, this.d.fechaIngreso);
  }

  puntaje(hoy: Fecha): number | null {
    if (!this.abierto()) return null;
    const antig = Math.min(60, Math.max(0, difDias(hoy, this.d.fechaIngreso))) / 2;
    return PUNTOS_PRIORIDAD[this.d.prioridad] + antig + (this.estado() === 'PENDIENTE REPUESTOS' ? -10 : 10);
  }

  semanaPlan(): { anio: number; semana: number } | null {
    return this.d.inicioProgramado ? semanaIso(this.d.inicioProgramado) : null;
  }

  validar(): void {
    const d = this.d;
    if (!d.equipoId) throw new ReglaNegocioError('Falta el equipo.');
    if (!d.actividad.trim()) throw new ReglaNegocioError('Falta la actividad.');
    if (!['A', 'B', 'C'].includes(d.prioridad)) throw new ReglaNegocioError('Prioridad debe ser A, B o C.');
    if (d.origen && !ORIGENES.some((o) => o.valor === d.origen)) throw new ReglaNegocioError('Origen no válido.');
    if (d.tareas.length > MAX_TAREAS) throw new ReglaNegocioError(`Máximo ${MAX_TAREAS} tareas por BKL.`);
    if (d.diasEstimados < 0 || (d.hhEstimadas !== null && d.hhEstimadas < 0)) throw new ReglaNegocioError('Días y HH no pueden ser negativos.');
    const ordenes = new Set(d.tareas.map((t) => t.orden));
    for (const r of d.repuestos) {
      if (r.cantidad <= 0) throw new ReglaNegocioError(`Cantidad inválida en ${r.numeroParte || r.descripcion}.`);
      if (r.tareaOrden !== null && !ordenes.has(r.tareaOrden)) throw new ReglaNegocioError(`El repuesto ${r.numeroParte || r.descripcion} apunta a la tarea ${r.tareaOrden}, que no existe.`);
    }
    if (d.inicioReal && d.finReal && d.finReal < d.inicioReal) throw new ReglaNegocioError('El fin real no puede ser antes del inicio real.');
    if (d.estadoManual === 'cerrado' && (!d.finReal || !d.ejecutadoPor || d.hhReales === null)) {
      throw new ReglaNegocioError('Para cerrar se necesita fin real, ejecutado por y HH reales.');
    }
  }

  private exigirAbierto(accion: string) {
    const e = this.estado();
    if (e === 'CERRADO' || e === 'CANCELADO') throw new ReglaNegocioError(`No se puede ${accion} un BKL ${e.toLowerCase()}.`);
  }

  reprogramar(f: Fecha): void {
    this.exigirAbierto('reprogramar');
    if (this.d.finReal) throw new ReglaNegocioError('No se puede reprogramar un BKL ya ejecutado.');
    if (f < this.d.fechaIngreso) throw new ReglaNegocioError('El inicio no puede ser antes de la fecha de ingreso.');
    if (this.d.inicioProgramado === f) return;
    if (!this.d.inicioOriginal) this.d.inicioOriginal = f;
    this.d.inicioProgramado = f;
    this.d.reprogramaciones = (this.d.reprogramaciones ?? 0) + 1;
  }

  cerrar(c: DatosCierre): void {
    this.exigirAbierto('cerrar');
    if (!c.finReal || !c.ejecutadoPor?.trim() || c.hhReales === null || c.hhReales === undefined || c.hhReales < 0) {
      throw new ReglaNegocioError('Para cerrar se necesita fin real, ejecutado por y HH reales.');
    }
    const inicio = c.inicioReal ?? this.d.inicioReal ?? c.finReal;
    if (c.finReal < inicio) throw new ReglaNegocioError('El fin real no puede ser antes del inicio real.');
    Object.assign(this.d, { inicioReal: inicio, finReal: c.finReal, ejecutadoPor: c.ejecutadoPor.trim(), hhReales: c.hhReales, estadoManual: 'cerrado' });
  }

  cancelar(): void {
    this.exigirAbierto('cancelar');
    this.d.estadoManual = 'cancelado';
  }
}
