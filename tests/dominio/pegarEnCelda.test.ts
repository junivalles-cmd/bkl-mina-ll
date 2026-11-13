import { describe, it, expect } from 'vitest';
import { pegarEnCelda } from '../../src/dominio/pegadoExcel';
import type { RepuestoDatos } from '../../src/dominio/repuesto';

const r = (o: Partial<RepuestoDatos> = {}): RepuestoDatos => ({ codigoGp: '', numeroParte: '', descripcion: '', cantidad: 1, tareaOrden: null, almacen: '', ubicacion: '', precioUsd: 0, stock: 'pedir', ...o });

describe('pegarEnCelda (columna por columna)', () => {
  it('una columna llena hacia abajo y crea filas', () => {
    const { filas } = pegarEnCelda([r()], 0, 'numeroParte', '1R-0716\r\n4364440\n2435336\n');
    expect(filas.map((f) => f.numeroParte)).toEqual(['1R-0716', '4364440', '2435336']);
    expect(filas).toHaveLength(3);
  });
  it('luego otra columna sobre las mismas filas', () => {
    let { filas } = pegarEnCelda([r()], 0, 'numeroParte', 'A\nB\nC');
    ({ filas } = pegarEnCelda(filas, 0, 'descripcion', 'FILTRO\nPERNO\nSELLO'));
    ({ filas } = pegarEnCelda(filas, 0, 'cantidad', '2\n4\n1,5'));
    ({ filas } = pegarEnCelda(filas, 0, 'precioUsd', '$18.05\n1,234.50\n3'));
    expect(filas.map((f) => [f.numeroParte, f.descripcion, f.cantidad, f.precioUsd])).toEqual([['A', 'FILTRO', 2, 18.05], ['B', 'PERNO', 4, 1234.5], ['C', 'SELLO', 1.5, 3]]);
  });
  it('empieza en la fila donde estás parado', () => {
    const { filas } = pegarEnCelda([r({ numeroParte: 'X' }), r({ numeroParte: 'Y' })], 1, 'descripcion', 'UNO\nDOS');
    expect(filas.map((f) => [f.numeroParte, f.descripcion])).toEqual([['X', ''], ['Y', 'UNO'], ['', 'DOS']]);
  });
  it('almacén pegado decide el stock si no se pegó stock', () => {
    const { filas } = pegarEnCelda([r(), r()], 0, 'almacen', 'NIMAC\n');
    expect(filas.map((f) => f.stock)).toEqual(['disponible', 'pedir']);
    const sc = pegarEnCelda([r({ stock: 'pedir', sc: { numero: 1, estado: 'aprobada' } })], 0, 'almacen', 'NIMAC').filas;
    expect(sc[0].stock).toBe('pedir');
  });
  it('varias columnas se llenan hacia la derecha desde la celda', () => {
    const { filas } = pegarEnCelda([r()], 0, 'descripcion', 'FILTRO\t2\t1\nPERNO\t4\t');
    expect(filas.map((f) => [f.descripcion, f.cantidad, f.tareaOrden])).toEqual([['FILTRO', 2, 1], ['PERNO', 4, null]]);
  });
  it('valores inválidos se informan y no dañan la fila', () => {
    const { filas, errores } = pegarEnCelda([r(), r()], 0, 'cantidad', 'dos\n0');
    expect(filas.map((f) => f.cantidad)).toEqual([1, 1]);
    expect(errores).toEqual(['Fila 1: cantidad "dos" no válida', 'Fila 2: cantidad "0" no válida']);
    expect(pegarEnCelda([r()], 0, 'stock', 'pedir').filas[0].stock).toBe('pedir');
    expect(pegarEnCelda([r()], 0, 'stock', 'quizá').errores).toEqual(['Fila 1: stock "quizá" debe ser DISPONIBLE o PEDIR']);
  });
});
