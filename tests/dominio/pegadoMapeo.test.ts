import { describe, it, expect } from 'vitest';
import { PegadoExcel } from '../../src/dominio/pegadoExcel';

const TC = 36.62;

describe('PegadoExcel.analizar', () => {
  it('lista copiada de la Consulta de Repuestos (con encabezado)', () => {
    const t = 'CODIGO\tN° PARTE\tDESCRIPCION\tUND\tCANTIDAD\tALMACEN\tUBICACION\tAREA\n' +
      '81380\t4364440\tTAPON\tEA\t2\tCONSIGNADO NIMAC\tC1-2A3\tCONSIGNADO NIMAC\n' +
      '7001\t4T-3925\tCUCHILLA\tEA\t6\tALMACEN13A\tR3\tALMANCEN EQUINOX - VOLCAN';
    const a = PegadoExcel.analizar(t);
    expect(a.encabezado).toBe(true);
    expect(a.mapeo).toEqual(['codigoGp', 'numeroParte', 'descripcion', 'ignorar', 'cantidad', 'almacen', 'ubicacion', 'ignorar']);
    const { filas, errores } = PegadoExcel.convertir(a, TC);
    expect(errores).toEqual([]);
    expect(filas[1]).toMatchObject({ codigoGp: '7001', numeroParte: '4T-3925', descripcion: 'CUCHILLA', cantidad: 6, almacen: 'ALMACEN13A', ubicacion: 'R3', precioUsd: 0, stock: 'disponible' });
  });
  it('la misma lista sin encabezado se reconoce por la columna UND', () => {
    const a = PegadoExcel.analizar('81380\t4364440\tTAPON\tEA\t2\tCONSIGNADO NIMAC\tC1-2A3\tCONSIGNADO NIMAC');
    expect(a.encabezado).toBe(false);
    expect(a.mapeo.slice(0, 7)).toEqual(['codigoGp', 'numeroParte', 'descripcion', 'ignorar', 'cantidad', 'almacen', 'ubicacion']);
  });
  it('BASE DATOS del inventario: existencia y costo en córdobas', () => {
    const t = 'CODIGO\tNúmerodeParte\tDescripcion\tUND\tSITIO\tCompartimiento\tExistenciaTotal\tCosto C$\n' +
      '81380\t4364440\tTAPON\tEA\tCONSIGNADO NIMAC\tC1\t5\t366.20\n81381\t2435336\tPERNO\tEA\tALMACEN13A\tR1\t0\t73.24';
    const a = PegadoExcel.analizar(t);
    expect(a.mapeo).toEqual(['codigoGp', 'numeroParte', 'descripcion', 'ignorar', 'almacen', 'ubicacion', 'existencia', 'precioCs']);
    const { filas } = PegadoExcel.convertir(a, TC);
    expect(filas.map((f) => [f.cantidad, f.precioUsd, f.stock])).toEqual([[1, 10, 'disponible'], [1, 2, 'pedir']]);
  });
  it('formato del formulario V17 sigue funcionando', () => {
    const a = PegadoExcel.analizar('81380\t4364440\tTAPON\t2\t1\tNIMAC\tC1-2A3\t$18.05\tDISPONIBLE');
    expect(a.mapeo).toEqual(['codigoGp', 'numeroParte', 'descripcion', 'cantidad', 'tarea', 'almacen', 'ubicacion', 'precioUsd', 'stock']);
  });
  it('mapeo manual: el usuario reasigna columnas', () => {
    const a = PegadoExcel.analizar('FILTRO ACEITE\t1R-0716\t3');
    const { filas } = PegadoExcel.convertir({ ...a, mapeo: ['descripcion', 'numeroParte', 'cantidad'] }, TC);
    expect(filas[0]).toMatchObject({ descripcion: 'FILTRO ACEITE', numeroParte: '1R-0716', cantidad: 3, stock: 'pedir' });
  });
  it('encabezados con P. UND USD y TOTAL USD no se confunden', () => {
    const a = PegadoExcel.analizar('NO. PARTE\tDESCRIPCIÓN\tCANT.\tP. UND USD\tTOTAL USD\n1R-0716\tFILTRO\t2\t10\t20');
    expect(a.mapeo).toEqual(['numeroParte', 'descripcion', 'cantidad', 'precioUsd', 'ignorar']);
  });
});
