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

export type CampoPegado = 'codigoGp' | 'numeroParte' | 'descripcion' | 'cantidad' | 'tarea' | 'almacen' | 'ubicacion' | 'precioUsd' | 'precioCs' | 'stock' | 'existencia' | 'ignorar';

export const CAMPOS_PEGADO: { campo: CampoPegado; etiqueta: string }[] = [
  { campo: 'codigoGp', etiqueta: 'Cód. GP' }, { campo: 'numeroParte', etiqueta: 'No. parte' }, { campo: 'descripcion', etiqueta: 'Descripción' },
  { campo: 'cantidad', etiqueta: 'Cantidad' }, { campo: 'tarea', etiqueta: 'Tarea' }, { campo: 'almacen', etiqueta: 'Almacén' },
  { campo: 'ubicacion', etiqueta: 'Ubicación' }, { campo: 'precioUsd', etiqueta: 'P. Und USD' }, { campo: 'precioCs', etiqueta: 'P. Und C$' },
  { campo: 'stock', etiqueta: 'Stock (DISPONIBLE/PEDIR)' }, { campo: 'existencia', etiqueta: 'Existencia en almacén' }, { campo: 'ignorar', etiqueta: '— no usar —' },
];

/** Orden del formulario V17 (y de la app). */
export const ORDEN_V17: CampoPegado[] = ['codigoGp', 'numeroParte', 'descripcion', 'cantidad', 'tarea', 'almacen', 'ubicacion', 'precioUsd', 'stock'];
/** Orden de "Copiar p/ Excel" de la Consulta de Repuestos. */
export const ORDEN_INVENTARIO: CampoPegado[] = ['codigoGp', 'numeroParte', 'descripcion', 'ignorar', 'cantidad', 'almacen', 'ubicacion', 'ignorar'];

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Reconoce un encabezado de columna; null si no es un nombre conocido. */
export function campoDeEncabezado(texto: string): CampoPegado | null {
  const t = sinTildes(texto);
  if (!t) return null;
  if (/\btotal\b|monto|^clave|^area$|^(und|u\.?m\.?|unidad|unidadmedida|unidad de medida)$/.test(t)) return 'ignorar';
  if (/existencia|bin dispo|disponible/.test(t)) return 'existencia';
  if (/c\$|cordoba/.test(t)) return 'precioCs';
  if (/^(n|no|nro|num)\.?\s*(de\s*)?parte|^n\s*[°º]\s*(de\s*)?parte|numero\s*de\s*parte|^p\/n$|^parte$|part\s*n/.test(t)) return 'numeroParte';
  if (/^descrip/.test(t)) return 'descripcion';
  if (/^cant/.test(t)) return 'cantidad';
  if (/^tarea/.test(t)) return 'tarea';
  if (/almacen|^sitio|bodega/.test(t)) return 'almacen';
  if (/ubic|compartimiento/.test(t)) return 'ubicacion';
  if (/^stock/.test(t)) return 'stock';
  if (/usd|precio|p\.? ?und|costo|currcost/.test(t)) return 'precioUsd';
  if (/^cod|itemnmbr|^item$|^gp$/.test(t)) return 'codigoGp';
  return null;
}

export interface AnalisisPegado {
  /** Filas de datos (sin el encabezado), ya sin filas vacías. */
  filas: string[][];
  columnas: number;
  encabezado: boolean;
  titulos: string[];
  mapeo: CampoPegado[];
  formato: string;
}

const PALABRAS_ENCABEZADO = /parte|descrip|cant|almac|stock/i;


export const PegadoExcel = {
  /** Lee el texto pegado y propone qué es cada columna (por encabezado o por formato conocido). */
  analizar(texto: string): AnalisisPegado {
    const todas = texto.replace(/\r\n?/g, '\n').split('\n').map((l) => l.split('\t').map((x) => x.trim()));
    let filas = todas.filter((c) => c.some((x) => x !== ''));
    const columnas = Math.max(0, ...filas.map((f) => f.length));
    let encabezado = false;
    let titulos: string[] = [];
    let mapeo: CampoPegado[] = [];
    let formato = '';
    if (filas.length) {
      const reconocidos = filas[0].map(campoDeEncabezado);
      if (reconocidos.filter((x) => x !== null).length >= 2 || (PALABRAS_ENCABEZADO.test(filas[0].join(' ')) && reconocidos.some((x) => x !== null))) {
        encabezado = true;
        titulos = filas[0];
        mapeo = Array.from({ length: columnas }, (_, i) => reconocidos[i] ?? 'ignorar');
        // un mismo campo solo una vez: los repetidos se ignoran
        const vistos = new Set<CampoPegado>();
        mapeo = mapeo.map((m) => (m !== 'ignorar' && vistos.has(m) ? 'ignorar' : (vistos.add(m), m)));
        filas = filas.slice(1);
        formato = 'Columnas reconocidas por el encabezado';
      }
    }
    if (!encabezado) {
      const muestra = filas.slice(0, 5);
      const esTexto = (i: number) => muestra.every((f) => (f[i] ?? '') === '' || leerNumero(f[i]) === null);
      const esNumero = (i: number) => muestra.every((f) => (f[i] ?? '') === '' || leerNumero(f[i]) !== null);
      if (columnas >= 5 && esTexto(3) && esNumero(4)) {
        mapeo = ORDEN_INVENTARIO.slice(0, columnas);
        formato = 'Lista de la Consulta de Repuestos (Código, N° parte, Descripción, UND, Cantidad, Almacén, Ubicación, Área)';
      } else {
        mapeo = ORDEN_V17.slice(0, columnas);
        formato = 'Orden del formulario (Cód. GP, No. parte, Descripción, Cant., Tarea, Almacén, Ubicación, P. Und USD, Stock)';
      }
      while (mapeo.length < columnas) mapeo.push('ignorar');
    }
    return { filas, columnas, encabezado, titulos, mapeo, formato };
  },

  /** Convierte las filas según el mapeo elegido. tipoCambio convierte precios en C$ a USD. */
  convertir(a: Pick<AnalisisPegado, 'filas' | 'mapeo'>, tipoCambio: number): { filas: RepuestoDatos[]; errores: ErrorPegado[] } {
    const filas: RepuestoDatos[] = [];
    const errores: ErrorPegado[] = [];
    const col = (c: CampoPegado) => a.mapeo.indexOf(c);
    const de = (f: string[], c: CampoPegado) => (col(c) >= 0 ? f[col(c)] ?? '' : '');
    a.filas.forEach((f, idx) => {
      const n = idx + 1;
      const err = (m: string) => errores.push({ fila: n, mensaje: `Fila ${n}: ${m}` });
      const numeroParte = de(f, 'numeroParte');
      const descripcion = de(f, 'descripcion');
      if (!numeroParte && !descripcion) { err('falta No. parte o descripción'); return; }
      const cantTxt = de(f, 'cantidad');
      const cantidad = cantTxt === '' ? 1 : leerNumero(cantTxt);
      if (cantidad === null || cantidad <= 0) { err('cantidad inválida'); return; }
      let precioUsd = 0;
      const pu = de(f, 'precioUsd');
      const pc = de(f, 'precioCs');
      if (pu !== '') {
        const v = leerNumero(pu);
        if (v === null || v < 0) { err('precio inválido'); return; }
        precioUsd = v;
      } else if (pc !== '') {
        const v = leerNumero(pc);
        if (v === null || v < 0) { err('precio inválido'); return; }
        precioUsd = Math.round((v / tipoCambio) * 100) / 100;
      }
      const tarea = de(f, 'tarea');
      const tareaN = tarea === '' ? null : leerNumero(tarea);
      if (tareaN !== null && (!Number.isInteger(tareaN) || tareaN < 1 || tareaN > 20)) { err('tarea inválida (1 a 20)'); return; }
      const almacen = de(f, 'almacen');
      const st = de(f, 'stock').toUpperCase();
      if (st && st !== 'DISPONIBLE' && st !== 'PEDIR') { err('stock debe ser DISPONIBLE o PEDIR'); return; }
      let stock: RepuestoDatos['stock'];
      if (st) stock = st === 'PEDIR' ? 'pedir' : 'disponible';
      else if (col('existencia') >= 0) stock = (leerNumero(de(f, 'existencia')) ?? 0) > 0 ? 'disponible' : 'pedir';
      else stock = almacen ? 'disponible' : 'pedir';
      filas.push({ codigoGp: de(f, 'codigoGp'), numeroParte, descripcion, cantidad, tareaOrden: tareaN, almacen, ubicacion: de(f, 'ubicacion'), precioUsd, stock });
    });
    return { filas, errores };
  },

  /** Atajo: detecta columnas y convierte (tipo de cambio por defecto). */
  parsear(texto: string, tipoCambio = 36.62): { filas: RepuestoDatos[]; errores: ErrorPegado[] } {
    return this.convertir(this.analizar(texto), tipoCambio);
  },
};

/** Columnas de la tabla de repuestos, en el orden en que se ven. */
export type CampoTabla = 'codigoGp' | 'numeroParte' | 'descripcion' | 'cantidad' | 'tareaOrden' | 'almacen' | 'ubicacion' | 'precioUsd' | 'stock';
export const COLUMNAS_TABLA: CampoTabla[] = ['codigoGp', 'numeroParte', 'descripcion', 'cantidad', 'tareaOrden', 'almacen', 'ubicacion', 'precioUsd', 'stock'];
const NOMBRE_COL: Record<CampoTabla, string> = {
  codigoGp: 'código GP', numeroParte: 'No. parte', descripcion: 'descripción', cantidad: 'cantidad', tareaOrden: 'tarea',
  almacen: 'almacén', ubicacion: 'ubicación', precioUsd: 'precio', stock: 'stock',
};

/**
 * Pega como en Excel: desde la celda (fila, campo) hacia abajo y hacia la derecha.
 * Crea filas si faltan. Devuelve las filas nuevas y los valores que no se pudieron usar.
 */
export function pegarEnCelda(actuales: RepuestoDatos[], fila: number, campo: CampoTabla, texto: string): { filas: RepuestoDatos[]; errores: string[] } {
  const lineas = texto.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  const filas = actuales.map((r) => ({ ...r }));
  const errores: string[] = [];
  const col0 = COLUMNAS_TABLA.indexOf(campo);
  lineas.forEach((linea, k) => {
    const i = fila + k;
    while (filas.length <= i) filas.push({ codigoGp: '', numeroParte: '', descripcion: '', cantidad: 1, tareaOrden: null, almacen: '', ubicacion: '', precioUsd: 0, stock: 'pedir' });
    const r = filas[i];
    let tocoAlmacen = false;
    let tocoStock = false;
    linea.split('\t').forEach((valor, j) => {
      const c = COLUMNAS_TABLA[col0 + j];
      if (!c) return;
      const v = valor.trim();
      const mal = (txt = `${NOMBRE_COL[c]} "${v}" no válida`) => errores.push(`Fila ${i + 1}: ${txt}`);
      switch (c) {
        case 'cantidad': {
          if (v === '') return;
          const n = leerNumero(v);
          if (n === null || n <= 0) return mal();
          r.cantidad = n; return;
        }
        case 'precioUsd': {
          if (v === '') { r.precioUsd = 0; return; }
          const n = leerNumero(v);
          if (n === null || n < 0) return mal(`precio "${v}" no válido`);
          r.precioUsd = n; return;
        }
        case 'tareaOrden': {
          if (v === '') { r.tareaOrden = null; return; }
          const n = leerNumero(v);
          if (n === null || !Number.isInteger(n) || n < 1 || n > 20) return mal(`tarea "${v}" no válida`);
          r.tareaOrden = n; return;
        }
        case 'stock': {
          const s = v.toUpperCase();
          if (s === '') return;
          if (s !== 'DISPONIBLE' && s !== 'PEDIR') return mal(`stock "${v}" debe ser DISPONIBLE o PEDIR`);
          if (!r.sc) r.stock = s === 'PEDIR' ? 'pedir' : 'disponible';
          tocoStock = true; return;
        }
        case 'almacen':
          r.almacen = v; tocoAlmacen = true; return;
        default:
          r[c] = v;
      }
    });
    if (tocoAlmacen && !tocoStock && !r.sc) r.stock = r.almacen ? 'disponible' : 'pedir';
  });
  return { filas, errores };
}
