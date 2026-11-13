import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { leerV17, importarV17 } from '../../src/servicios/importarV17';
import { reposEnMemoria } from '../../src/datos/memoria';
import type { Perfil } from '../../src/datos/tipos';

const buf = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

async function libroMinimo(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const eq = wb.addWorksheet('EQUIPOS');
  eq.addRow(['CÓDIGO', 'AHORRATIVO', 'FAMILIA', 'MARCA', 'MODELO', 'UBICACIÓN', 'PROYECTO']);
  eq.addRow([518, 'T01', 'Tractor', 'Caterpillar', 'D9R', 'Volcan', 'Mina La Libertad']);
  eq.getCell('A2').numFmt = '00-00';
  eq.addRow([456020, 'A12', 'Articulado', 'Caterpillar', '740', 'Mojon', '']);
  eq.getCell('A3').numFmt = '00-0000';
  const bd = wb.addWorksheet('BD BKL');
  for (let i = 0; i < 5; i++) bd.addRow([]);
  bd.addRow(['No. BKL', 'FECHA INGRESO', 'EQUIPO']);
  bd.addRow(['BKL-007', new Date(Date.UTC(2026, 9, 1)), 'a12', 'Cambio de bomba', 'A - CRÍTICA', { formula: 'X', result: 'PENDIENTE REPUESTOS' }, 'PENDIENTE REPUESTOS', 'JUNIOR VALLES', 'GELBER CABRERA', 'OT-1', null, 1200, 'HIDRÁULICO',
    new Date(Date.UTC(2026, 9, 10)), new Date(Date.UTC(2026, 9, 7)), 2, 'LUIS', 16]);
  bd.addRow(['BKL-008', 46338, 518, 'Fuga', 'C - PROGRAMABLE', null, 'CERRADO', null, 'JEAN CARLOS SOZA', null, null, null, '', 46340, 46340, 1, null, null, 46340, 46341, 'Jean', 5]);
  bd.addRow(['BKL-009', 46338, 'ZZ-99', 'Equipo que no existe', 'B - ALTA']);
  const ta = wb.addWorksheet('BD TAREAS');
  ta.addRow(['No. BKL', 'DESCRIPCIÓN', 'No. TAREA']);
  ta.addRow(['BKL-007', 'Desmontar bomba']);
  ta.addRow(['BKL-007', 'Montar bomba nueva']);
  const re = wb.addWorksheet('BD REPUESTOS');
  re.addRow(['No. BKL', 'CÓDIGO GP', 'NO. PARTE', 'DESCRIPCIÓN', 'CANTIDAD', 'TAREA', 'ALMACÉN', 'UBICACIÓN', 'P. UND USD', 'STOCK', 'No. SC']);
  re.addRow(['BKL-007', '1', 'B-100', 'BOMBA', 1, 2, '', '', 3500, 'PEDIR', 'V-0165']);
  re.addRow(['BKL-007', '2', 'S-1', 'SELLO', 4, 1, 'NIMAC', 'C1', 2.5, null, null]);
  const sc = wb.addWorksheet('PEDIDOS SC');
  sc.addRow(['No. SC', 'FECHA SC', 'No. BKL', 'EQUIPO', 'PRIORIDAD', 'PROVEEDOR', 'ESTADO SC', 'No. OC', 'FECHA ESTIMADA', 'FECHA RECIBIDA', 'LÍNEAS', 'MONTO', 'DÍAS', 'OBS']);
  sc.addRow(['V-0165', new Date(Date.UTC(2026, 9, 2)), 'BKL-007', null, 'EMERGENCIA', 'NIMAC', 'OC EMITIDA', 'OC-55']);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const perfil = (id: string, nombre: string): Perfil => ({ id, usuario: id, nombre, correo: null, rol: 'responsable', hhSemana: 160, activo: true });

describe('leerV17', () => {
  it('lee el FORMATO_BKL_V17 real', async () => {
    const d = await leerV17(buf(readFileSync('tests/fixtures/FORMATO_BKL_V17.xlsx')));
    expect(d.equipos.find((e) => e.codigo === '05-18')?.ahorrativo).toBe('T01');
    const b1 = d.bkls.find((b) => b.numero === 1)!;
    expect(b1.equipo).toBe('15-59');
    expect(b1.prioridad).toBe('B');
    expect(b1.tareas).toHaveLength(3);
    expect(b1.repuestos.length).toBeGreaterThanOrEqual(5);
    expect(b1.repuestos[0]).toMatchObject({ codigoGp: '81380', numeroParte: '4364440', cantidad: 2, precioUsd: 18.05, stock: 'disponible', tareaOrden: 1 });
    expect(b1.inicioProgramado).toBe('2026-11-12');
  });
  it('códigos numéricos con formato, prioridades y estados', async () => {
    const d = await leerV17(await libroMinimo());
    expect(d.equipos.map((e) => e.codigo)).toEqual(['05-18', '45-6020']);
    const b7 = d.bkls.find((b) => b.numero === 7)!;
    expect(b7).toMatchObject({ equipo: 'a12', prioridad: 'A', estadoManual: 'pendiente_repuestos', responsable: 'GELBER CABRERA', fechaIngreso: '2026-10-01', inicioProgramado: '2026-10-10', inicioOriginal: '2026-10-07', tecnicos: 'LUIS', hhEstimadas: 16, horometro: 1200 });
    expect(b7.tareas.map((t) => t.orden)).toEqual([1, 2]);
    expect(b7.repuestos[0]).toMatchObject({ stock: 'pedir', scMaestro: 'V-0165' });
    expect(b7.repuestos[1].stock).toBe('disponible');
    const b8 = d.bkls.find((b) => b.numero === 8)!;
    expect(b8).toMatchObject({ equipo: '518', estadoManual: 'cerrado', finReal: '2026-11-15', hhReales: 5, ejecutadoPor: 'Jean' });
    expect(d.scs[0]).toMatchObject({ numeroMaestro: 'V-0165', estado: 'oc_emitida', prioridad: 'emergencia', noOc: 'OC-55', bklNumeros: [7] });
  });
});

describe('importarV17', () => {
  it('carga en los repositorios, enlaza SC y avisa lo que no puede', async () => {
    const repos = reposEnMemoria({ perfiles: [perfil('g', 'Gelber Cabrera'), perfil('j', 'Jean Carlos Soza')] });
    const r = await importarV17(repos, await leerV17(await libroMinimo()));
    expect(r).toMatchObject({ equipos: 2, bkls: 2, scs: 1 });
    expect(r.avisos.join('\n')).toMatch(/BKL-009.*ZZ-99/);
    expect(r.avisos.join('\n')).toMatch(/JUNIOR VALLES/);
    const b7 = await repos.bkls.obtener(7);
    expect(b7?.d.responsableId).toBe('g');
    expect(b7?.repuestos()[0].estadoTexto()).toBe('SCB-0001 · OC EMITIDA');
    expect(b7?.estado()).toBe('PENDIENTE REPUESTOS');
    expect((await repos.bkls.obtener(8))?.estado()).toBe('CERRADO');
    // reimportar no duplica
    const r2 = await importarV17(repos, await leerV17(await libroMinimo()));
    expect(r2.bkls).toBe(0);
    expect(r2.avisos.join('\n')).toMatch(/BKL-007 ya existe/);
  });
});

describe('limpiarLibro', () => {
  it('quita elementos anidados sin romper el XML', async () => {
    const { quitarElementos } = await import('../../src/servicios/importarV17');
    const x = '<ws><a/><mc:AlternateContent x="1"><mc:Choice><controls><mc:AlternateContent><c/></mc:AlternateContent></controls></mc:Choice></mc:AlternateContent><b>1</b><drawing r:id="2"/></ws>';
    expect(quitarElementos(quitarElementos(x, 'mc:AlternateContent'), 'drawing')).toBe('<ws><a/><b>1</b></ws>');
    expect(quitarElementos('<x><drawingX/><drawing/></x>', 'drawing')).toBe('<x><drawingX/></x>');
  });
  it('abre .xlsm reales con botones de macros', async () => {
    for (const f of ['tests/fixtures/libro_con_botones.xlsm', 'tests/fixtures/FORMATO_BKL_usuario.xlsm']) {
      const d = await leerV17(buf(readFileSync(f)));
      expect(d.equipos.length, f).toBeGreaterThan(0);
    }
  });
});
