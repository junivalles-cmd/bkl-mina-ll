import { describe, it, expect, beforeEach } from 'vitest';
import { reposEnMemoria } from '../../src/datos/memoria';
import { BklServicio, buscarEquipo } from '../../src/servicios/bklServicio';
import type { Equipo, Repos } from '../../src/datos/tipos';
import { ReglaNegocioError } from '../../src/dominio/errores';

const eq = (codigo: string, ahorrativo: string | null, id = codigo): Equipo => ({ id, codigo, ahorrativo, familia: 'Articulado', marca: 'CAT', modelo: '740', serie: null, ubicacion: 'Volcán', criticidad: null, activo: true });
let repos: Repos;
let s: BklServicio;
beforeEach(() => {
  repos = reposEnMemoria({ equipos: [eq('45-86', 'A01'), eq('15-59', 'R01'), eq('05-18', 'T01')] });
  s = new BklServicio(repos, () => '2026-11-12');
});

describe('buscarEquipo', () => {
  it('por código, sin guion, ahorrativo y mayúsculas', () => {
    const es = [eq('45-86', 'A01'), eq('15-59', 'R01'), eq('05-18', 'T01')];
    expect(buscarEquipo(es, '45-86')?.codigo).toBe('45-86');
    expect(buscarEquipo(es, '1559')?.codigo).toBe('15-59');
    expect(buscarEquipo(es, 'a01')?.codigo).toBe('45-86');
    expect(buscarEquipo(es, ' 518 ')?.codigo).toBe('05-18');
    expect(buscarEquipo(es, '99-99')).toBeNull();
  });
});

describe('BklServicio', () => {
  it('crea con número consecutivo y fechas por defecto', async () => {
    const n1 = await s.crear({ equipo: 'A01', actividad: 'Cambio de mandos', prioridad: 'A', tareas: [{ orden: 1, descripcion: 'Desmontar', hecha: false }], repuestos: [] });
    const n2 = await s.crear({ equipo: '15-59', actividad: 'Fuga', prioridad: 'C', tareas: [], repuestos: [] });
    expect([n1, n2]).toEqual([1, 2]);
    const b = await repos.bkls.obtener(1);
    expect(b?.d.equipoId).toBe('45-86');
    expect(b?.d.inicioProgramado).toBe('2026-11-18');
  });
  it('equipo inexistente o datos inválidos lanzan', async () => {
    await expect(s.crear({ equipo: 'ZZ', actividad: 'x', prioridad: 'A', tareas: [], repuestos: [] })).rejects.toThrow(ReglaNegocioError);
    await expect(s.crear({ equipo: 'A01', actividad: '', prioridad: 'A', tareas: [], repuestos: [] })).rejects.toThrow(/actividad/i);
  });
  it('backlog: solo abiertos, ordenado por puntaje', async () => {
    await s.crear({ equipo: 'A01', actividad: 'c', prioridad: 'C', tareas: [], repuestos: [] });
    await s.crear({ equipo: 'A01', actividad: 'a', prioridad: 'A', tareas: [], repuestos: [] });
    await s.crear({ equipo: 'A01', actividad: 'b', prioridad: 'B', tareas: [], repuestos: [] });
    await s.cancelar(3);
    const bl = await s.backlog();
    expect(bl.map((b) => b.d.actividad)).toEqual(['a', 'c']);
  });
  it('reprogramar, cerrar y actualizar persisten', async () => {
    await s.crear({ equipo: 'A01', actividad: 'x', prioridad: 'A', tareas: [], repuestos: [] });
    await s.reprogramar(1, '2026-11-25');
    expect((await repos.bkls.obtener(1))?.d.inicioProgramado).toBe('2026-11-25');
    await s.actualizar(1, { actividad: 'y', hhEstimadas: 12 });
    expect((await repos.bkls.obtener(1))?.hh(await repos.parametros.obtener())).toBe(12);
    await expect(s.cerrar(1, { finReal: '2026-11-12', ejecutadoPor: '', hhReales: 3 })).rejects.toThrow(ReglaNegocioError);
    await s.cerrar(1, { finReal: '2026-11-12', ejecutadoPor: 'Jean Carlos', hhReales: 10 });
    expect((await repos.bkls.obtener(1))?.estado()).toBe('CERRADO');
    await expect(s.reprogramar(1, '2026-12-01')).rejects.toThrow(/cerrado/);
  });
  it('actualizar no permite tocar número ni inicio original', async () => {
    await s.crear({ equipo: 'A01', actividad: 'x', prioridad: 'A', tareas: [], repuestos: [] });
    await s.actualizar(1, { numero: 99, inicioOriginal: '2020-01-01' } as never);
    const b = await repos.bkls.obtener(1);
    expect(b?.d.numero).toBe(1);
    expect(b?.d.inicioOriginal).toBe('2026-11-18');
  });
});
