import { describe, it, expect } from 'vitest';
import { Bkl, numeroBklTexto, type BklDatos } from '../../src/dominio/bkl';
import { PARAMETROS_DEF as P } from '../../src/dominio/parametros';
import { ReglaNegocioError } from '../../src/dominio/errores';
import type { RepuestoDatos } from '../../src/dominio/repuesto';

const HOY = '2026-11-12';
const rep = (o: Partial<RepuestoDatos> = {}): RepuestoDatos => ({ tareaOrden: 1, codigoGp: '1', numeroParte: 'P', descripcion: 'X', cantidad: 2, almacen: 'NIMAC', ubicacion: '', precioUsd: 10, stock: 'disponible', ...o });
const mk = (o: Partial<BklDatos> = {}) => new Bkl({ ...Bkl.nuevo({ equipoId: 'e1', actividad: 'Cambio', prioridad: 'A' }, P, '2026-10-23').datos(), ...o });

describe('Bkl', () => {
  it('nuevo aplica valores por defecto', () => {
    const b = Bkl.nuevo({ equipoId: 'e1', actividad: 'Cambio de mandos', prioridad: 'B' }, P, HOY);
    expect(b.d.fechaIngreso).toBe(HOY);
    expect(b.d.inicioProgramado).toBe('2026-11-18');
    expect(b.d.inicioOriginal).toBe('2026-11-18');
    expect(b.d.diasEstimados).toBe(1);
    expect(b.hh(P)).toBe(8);
    expect(b.estado()).toBe('PROGRAMADO');
    expect(b.estadoRepuestos()).toBe('SIN REPUESTOS');
  });
  it('número y HH', () => {
    expect(numeroBklTexto(1)).toBe('BKL-001');
    expect(numeroBklTexto(1234)).toBe('BKL-1234');
    expect(mk({ hhEstimadas: 12 }).hh(P)).toBe(12);
    expect(mk({ diasEstimados: 3, hhEstimadas: null }).hh(P)).toBe(24);
  });
  it('fin programado = inicio + max(1,días) − 1', () => {
    expect(mk({ inicioProgramado: '2026-11-18', diasEstimados: 3 }).finProgramado()).toBe('2026-11-20');
    expect(mk({ inicioProgramado: '2026-11-18', diasEstimados: 0 }).finProgramado()).toBe('2026-11-18');
    expect(mk({ inicioProgramado: null }).finProgramado()).toBeNull();
  });
  it('costo y estado de repuestos', () => {
    const b = mk({ repuestos: [rep(), rep({ stock: 'pedir' }), rep({ stock: 'pedir', sc: { numero: 3, estado: 'aprobada' } })] });
    expect(b.costoUsd()).toBe(60);
    expect(b.porPedir()).toBe(1);
    expect(b.enSc()).toBe(1);
    expect(b.estadoRepuestos()).toBe('FALTA PEDIR 1');
    expect(mk({ repuestos: [rep({ stock: 'pedir', sc: { numero: 3, estado: 'aprobada' } })] }).estadoRepuestos()).toBe('EN ESPERA: 1 EN SC');
    expect(mk({ repuestos: [rep(), rep({ stock: 'pedir', sc: { numero: 3, estado: 'recibida' } })] }).estadoRepuestos()).toBe('COMPLETOS');
  });
  it('estado del BKL en orden de la regla 8', () => {
    expect(mk({ estadoManual: 'cancelado', finReal: HOY }).estado()).toBe('CANCELADO');
    expect(mk({ estadoManual: 'cerrado', finReal: HOY, ejecutadoPor: 'x', hhReales: 4 }).estado()).toBe('CERRADO');
    expect(mk({ inicioReal: HOY, finReal: HOY }).estado()).toBe('EJECUTADO');
    expect(mk({ inicioReal: HOY, repuestos: [rep({ stock: 'pedir' })] }).estado()).toBe('EN EJECUCIÓN');
    expect(mk({ repuestos: [rep({ stock: 'pedir', sc: { numero: 1, estado: 'cancelada' } })] }).estado()).toBe('PENDIENTE REPUESTOS');
    expect(mk({ estadoManual: 'pendiente_repuestos' }).estado()).toBe('PENDIENTE REPUESTOS');
    expect(mk().estado()).toBe('PROGRAMADO');
    expect(mk({ inicioProgramado: null }).estado()).toBe('LISTO PARA PROGRAMAR');
  });
  it('situación frente a hoy', () => {
    // inicio original 2026-10-29, 1 día
    expect(mk({ estadoManual: 'cancelado' }).situacion(HOY)).toBe('CANCELADO');
    expect(mk({ inicioReal: '2026-10-29', finReal: '2026-10-29' }).situacion(HOY)).toBe('EJECUTADO');
    const reprog = mk({ inicioProgramado: '2026-11-05', inicioReal: '2026-11-05', finReal: '2026-11-05' });
    expect(reprog.situacion(HOY)).toBe('EJECUTADO CON RETRASO');
    expect(mk().situacion(HOY)).toBe('RETRASADO');
    expect(mk({ repuestos: [rep({ stock: 'pedir' })] }).situacion(HOY)).toBe('RETRASADO – REPUESTOS');
    expect(mk({ inicioProgramado: '2026-11-20', inicioReal: HOY }).situacion(HOY)).toBe('EN EJECUCIÓN');
    expect(mk({ inicioProgramado: '2026-11-20', repuestos: [rep({ stock: 'pedir' })] }).situacion(HOY)).toBe('ESPERA REPUESTOS');
    expect(mk({ inicioProgramado: '2026-11-20' }).situacion(HOY)).toBe('PENDIENTE');
  });
  it('puntaje solo para abiertos', () => {
    expect(mk().puntaje(HOY)).toBe(70); // A 50 + 20/2 + 10
    expect(mk({ prioridad: 'C', repuestos: [rep({ stock: 'pedir' })] }).puntaje(HOY)).toBe(10); // 10 + 10 − 10
    expect(mk({ fechaIngreso: '2026-01-01' }).puntaje(HOY)).toBe(90); // tope 60 días
    expect(mk({ inicioReal: HOY, finReal: HOY }).puntaje(HOY)).toBeNull();
  });
  it('cerrar exige datos y orden de fechas', () => {
    expect(() => mk().cerrar({ finReal: HOY, ejecutadoPor: 'Jean', hhReales: null })).toThrow(ReglaNegocioError);
    expect(() => mk({ inicioReal: '2026-11-12' }).cerrar({ finReal: '2026-11-10', ejecutadoPor: 'Jean', hhReales: 4 })).toThrow(/fin real/i);
    const b = mk({ inicioReal: '2026-11-10' });
    b.cerrar({ finReal: HOY, ejecutadoPor: 'Jean', hhReales: 6 });
    expect(b.estado()).toBe('CERRADO');
    expect(() => b.cancelar()).toThrow(ReglaNegocioError);
  });
  it('reprogramar conserva inicio original', () => {
    const b = mk();
    b.reprogramar('2026-11-25');
    expect(b.d.inicioProgramado).toBe('2026-11-25');
    expect(b.d.inicioOriginal).toBe('2026-10-29');
    expect(b.d.reprogramaciones).toBe(1);
    expect(b.semanaPlan()).toEqual({ anio: 2026, semana: 48 });
  });
  it('validar', () => {
    const tareas = Array.from({ length: 21 }, (_, i) => ({ orden: i + 1, descripcion: 't', hecha: false }));
    expect(() => mk({ tareas }).validar()).toThrow(/20 tareas/);
    expect(() => mk({ actividad: ' ' }).validar()).toThrow(/actividad/i);
    expect(() => mk({ repuestos: [rep({ tareaOrden: 3 })], tareas: [{ orden: 1, descripcion: 't', hecha: false }] }).validar()).toThrow(/tarea 3/);
    expect(() => mk().validar()).not.toThrow();
  });
});
