import { describe, it, expect } from 'vitest';
import { sumarDias, difDias, semanaIso, domingoSemanaIso, lunesSemanaIso, aFecha, esFecha, mesDe } from '../../src/dominio/fechas';

describe('fechas', () => {
  it('suma y resta días', () => {
    expect(sumarDias('2026-11-12', 6)).toBe('2026-11-18');
    expect(sumarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(difDias('2026-11-12', '2026-10-23')).toBe(20);
  });
  it('semana ISO, incluida la 53 de 2026', () => {
    expect(semanaIso('2026-11-12')).toEqual({ anio: 2026, semana: 46 });
    expect(semanaIso('2026-12-29')).toEqual({ anio: 2026, semana: 53 });
    expect(semanaIso('2027-01-01')).toEqual({ anio: 2026, semana: 53 });
    expect(semanaIso('2027-01-04')).toEqual({ anio: 2027, semana: 1 });
    expect(semanaIso('2025-12-29')).toEqual({ anio: 2026, semana: 1 });
  });
  it('lunes y domingo de una semana ISO', () => {
    expect(lunesSemanaIso(2026, 46)).toBe('2026-11-09');
    expect(domingoSemanaIso(2026, 46)).toBe('2026-11-15');
    expect(domingoSemanaIso(2026, 53)).toBe('2027-01-03');
  });
  it('convierte valores de Excel y texto', () => {
    expect(aFecha(46338)).toBe('2026-11-12');
    expect(aFecha('12/11/2026')).toBe('2026-11-12');
    expect(aFecha('2026-11-12')).toBe('2026-11-12');
    expect(aFecha(new Date(Date.UTC(2026, 10, 12)))).toBe('2026-11-12');
    expect(aFecha('')).toBeNull();
    expect(aFecha('hola')).toBeNull();
    expect(esFecha('2026-02-30')).toBe(false);
    expect(mesDe('2026-11-12')).toBe(11);
  });
});
