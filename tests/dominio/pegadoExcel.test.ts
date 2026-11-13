import { describe, it, expect } from 'vitest';
import { PegadoExcel } from '../../src/dominio/pegadoExcel';

describe('PegadoExcel', () => {
  it('lee filas TSV con CRLF, ignora encabezado y vacías', () => {
    const t = 'Cód. GP\tNo. parte\tDescripción\tCant.\tTarea\tAlmacén\tUbicación\tP. Und USD\tStock\r\n' +
      '81380\t4364440\tTAPON\t2\t1\tNIMAC\tC1-2A3\t$18.05\tDISPONIBLE\r\n' +
      '\t\t\t\t\t\t\t\t\r\n' +
      '\t2435336\tPERNO\t4\t\t\t\t1,234.50\t\r\n';
    const { filas, errores } = PegadoExcel.parsear(t);
    expect(errores).toEqual([]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ codigoGp: '81380', numeroParte: '4364440', cantidad: 2, tareaOrden: 1, precioUsd: 18.05, stock: 'disponible' });
    expect(filas[1]).toMatchObject({ codigoGp: '', cantidad: 4, tareaOrden: null, precioUsd: 1234.5, stock: 'pedir' });
  });
  it('stock vacío con almacén = disponible; PEDIR en minúsculas', () => {
    const { filas } = PegadoExcel.parsear('1\tP1\tX\t1\t\tNIMAC\t\t5\t\n2\tP2\tY\t1\t\t\t\t5\tpedir');
    expect(filas.map((f) => f.stock)).toEqual(['disponible', 'pedir']);
  });
  it('acepta menos columnas', () => {
    const { filas, errores } = PegadoExcel.parsear('1\tP1\tFILTRO\t3');
    expect(errores).toEqual([]);
    expect(filas[0]).toMatchObject({ cantidad: 3, precioUsd: 0, almacen: '', stock: 'pedir' });
  });
  it('informa errores por fila', () => {
    const { filas, errores } = PegadoExcel.parsear('1\tP1\tA\t0\n1\t\t\t2\n1\tP3\tC\tdos\n1\tP4\tD\t1\t\t\t\tabc');
    expect(filas).toHaveLength(0);
    expect(errores.map((e) => e.mensaje)).toEqual([
      'Fila 1: cantidad inválida',
      'Fila 2: falta No. parte o descripción',
      'Fila 3: cantidad inválida',
      'Fila 4: precio inválido',
    ]);
  });
  it('números con coma decimal europea simple', () => {
    const { filas } = PegadoExcel.parsear('1\tP\tX\t1,5\t\t\t\t18,05');
    expect(filas[0].cantidad).toBe(1.5);
    expect(filas[0].precioUsd).toBe(18.05);
  });
});
