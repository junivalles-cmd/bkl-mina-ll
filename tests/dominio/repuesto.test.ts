import { describe, it, expect } from 'vitest';
import { Repuesto, numeroScTexto, type RepuestoDatos } from '../../src/dominio/repuesto';

const base: RepuestoDatos = { tareaOrden: 1, codigoGp: '81380', numeroParte: '4364440', descripcion: 'TAPON', cantidad: 2, almacen: 'NIMAC', ubicacion: 'C1', precioUsd: 18.05, stock: 'disponible' };

describe('Repuesto', () => {
  it('total y disponible', () => {
    const r = new Repuesto(base);
    expect(r.total()).toBeCloseTo(36.1, 6);
    expect(r.estadoTexto()).toBe('DISPONIBLE');
    expect(r.porPedir()).toBe(false);
  });
  it('estados con SC', () => {
    expect(numeroScTexto(7)).toBe('SCB-0007');
    expect(new Repuesto({ ...base, stock: 'pedir' }).estadoTexto()).toBe('POR PEDIR');
    const ap = new Repuesto({ ...base, stock: 'pedir', sc: { numero: 7, estado: 'aprobada' } });
    expect(ap.estadoTexto()).toBe('SCB-0007 · APROBADA');
    expect(ap.enSc()).toBe(true);
    expect(new Repuesto({ ...base, stock: 'pedir', sc: { numero: 7, estado: 'oc_emitida' } }).estadoTexto()).toBe('SCB-0007 · OC EMITIDA');
    const rec = new Repuesto({ ...base, stock: 'pedir', sc: { numero: 7, estado: 'recibida' } });
    expect(rec.estadoTexto()).toBe('RECIBIDO (SCB-0007)');
    expect(rec.enSc()).toBe(false);
    expect(rec.porPedir()).toBe(false);
    const can = new Repuesto({ ...base, stock: 'pedir', sc: { numero: 7, estado: 'cancelada' } });
    expect(can.estadoTexto()).toBe('POR PEDIR');
    expect(can.porPedir()).toBe(true);
  });
});
