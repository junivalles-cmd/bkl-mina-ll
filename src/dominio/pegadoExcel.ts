import type { RepuestoDatos } from './repuesto';

export interface ErrorPegado {
  fila: number;
  mensaje: string;
}

/** Convierte "1,234.50", "$18.05", "18,05" o "1.5" a número; null si no es número. */
export function leerNumero(s: string): number | null {
  let t = s.trim().replace(/[$\sUSD]/gi, '');
  if (t === '') return null;
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

const PALABRAS_ENCABEZADO = /parte|descrip|cant|almac|stock/i;

/** Columnas: Cód. GP, No. parte, Descripción, Cant., Tarea, Almacén, Ubicación, P. Und USD, Stock. */
export const PegadoExcel = {
  parsear(texto: string): { filas: RepuestoDatos[]; errores: ErrorPegado[] } {
    const filas: RepuestoDatos[] = [];
    const errores: ErrorPegado[] = [];
    const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
    let n = 0;
    for (const linea of lineas) {
      const c = linea.split('\t').map((x) => x.trim());
      if (c.every((x) => x === '')) continue;
      if (n === 0 && filas.length === 0 && errores.length === 0 && PALABRAS_ENCABEZADO.test(c.join(' ')) && leerNumero(c[3] ?? '') === null) continue;
      n++;
      const err = (m: string) => errores.push({ fila: n, mensaje: `Fila ${n}: ${m}` });
      const [codigoGp = '', numeroParte = '', descripcion = '', cant = '', tarea = '', almacen = '', ubicacion = '', precio = '', stock = ''] = c;
      if (!numeroParte && !descripcion) { err('falta No. parte o descripción'); continue; }
      const cantidad = leerNumero(cant);
      if (cantidad === null || cantidad <= 0) { err('cantidad inválida'); continue; }
      const precioUsd = precio === '' ? 0 : leerNumero(precio);
      if (precioUsd === null || precioUsd < 0) { err('precio inválido'); continue; }
      const tareaN = tarea === '' ? null : leerNumero(tarea);
      if (tareaN !== null && (!Number.isInteger(tareaN) || tareaN < 1 || tareaN > 20)) { err('tarea inválida (1 a 20)'); continue; }
      const st = stock.toUpperCase();
      if (st && st !== 'DISPONIBLE' && st !== 'PEDIR') { err('stock debe ser DISPONIBLE o PEDIR'); continue; }
      filas.push({
        codigoGp, numeroParte, descripcion, cantidad, tareaOrden: tareaN, almacen, ubicacion, precioUsd,
        stock: st === 'PEDIR' ? 'pedir' : st === 'DISPONIBLE' ? 'disponible' : almacen ? 'disponible' : 'pedir',
      });
    }
    return { filas, errores };
  },
};
