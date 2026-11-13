import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { Bkl, type BklDatos, type EstadoManual, type Prioridad } from '../dominio/bkl';
import { aFecha } from '../dominio/fechas';
import type { EstadoSc, RepuestoDatos } from '../dominio/repuesto';
import type { Equipo, Perfil, Repos, ScImportada } from '../datos/tipos';
import { buscarEquipo } from './bklServicio';

export interface RepuestoV17 extends RepuestoDatos {
  scMaestro: string | null;
}

export interface BklV17 extends Omit<BklDatos, 'equipoId' | 'responsableId' | 'plannerId' | 'repuestos'> {
  numero: number;
  equipo: string;
  responsable: string;
  planner: string;
  repuestos: RepuestoV17[];
}

export interface DatosV17 {
  equipos: Omit<Equipo, 'id'>[];
  bkls: BklV17[];
  scs: (Omit<ScImportada, 'equipoId'>)[];
  errores: string[];
}

type Celda = ExcelJS.Cell;

/** Valor útil de una celda: resultado de fórmula, texto de rich text, etc. */
function valor(c: Celda): unknown {
  const v = c.value as unknown;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = v as Record<string, unknown>;
    if ('result' in o) return o.result ?? null;
    if ('formula' in o || 'sharedFormula' in o) return null;
    if ('richText' in o) return (o.richText as { text: string }[]).map((t) => t.text).join('');
    if ('text' in o) return o.text;
    if ('error' in o) return null;
  }
  return v ?? null;
}

function texto(c: Celda): string {
  const v = valor(c);
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return aFecha(v) ?? '';
  return String(v).trim();
}

function numero(c: Celda): number | null {
  const v = valor(c);
  if (v === null || v === '' || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
  return isFinite(n) ? n : null;
}

/** Código de equipo: respeta formatos numéricos tipo 00-00 / 00-0000 (518 → 05-18). */
function codigoEquipo(c: Celda): string {
  const v = valor(c);
  if (typeof v === 'number') {
    const m = /^(0+)-(0+)$/.exec(c.numFmt ?? '');
    if (m) {
      const s = String(Math.round(v)).padStart(m[1].length + m[2].length, '0');
      return `${s.slice(0, s.length - m[2].length)}-${s.slice(s.length - m[2].length)}`;
    }
    return String(v);
  }
  return texto(c);
}

const numeroBkl = (s: string): number | null => {
  const m = /(\d+)\s*$/.exec(s);
  return m ? Number(m[1]) : null;
};

const prioridad = (s: string): Prioridad | null => {
  const p = s.trim().charAt(0).toUpperCase();
  return p === 'A' || p === 'B' || p === 'C' ? p : null;
};

const estadoManual = (s: string): EstadoManual => {
  const t = s.toUpperCase();
  if (t.startsWith('PENDIENTE')) return 'pendiente_repuestos';
  if (t === 'CERRADO') return 'cerrado';
  if (t === 'CANCELADO') return 'cancelado';
  return null;
};

const ESTADOS_SC: Record<string, EstadoSc> = {
  SOLICITADA: 'solicitada', COTIZADA: 'cotizada', APROBADA: 'aprobada', 'OC EMITIDA': 'oc_emitida',
  'EN TRÁNSITO': 'en_transito', 'EN TRANSITO': 'en_transito', RECIBIDA: 'recibida', CANCELADA: 'cancelada',
};

/** Quita del XML cada elemento <tag ...>...</tag> (o <tag/>) respetando anidamiento del mismo tag. */
export function quitarElementos(xml: string, tag: string): string {
  const abre = new RegExp(`<${tag}(?=[\\s>/])`, 'g');
  let salida = '';
  let pos = 0;
  for (;;) {
    abre.lastIndex = pos;
    const m = abre.exec(xml);
    if (!m) break;
    const ini = m.index;
    const finApertura = xml.indexOf('>', ini);
    if (finApertura < 0) break;
    salida += xml.slice(pos, ini);
    if (xml[finApertura - 1] === '/') { pos = finApertura + 1; continue; }
    // buscar el cierre correspondiente contando aperturas y cierres del mismo tag
    const patron = new RegExp(`<${tag}(?=[\\s>/])[^>]*?(/?)>|</${tag}\\s*>`, 'g');
    patron.lastIndex = finApertura + 1;
    let nivel = 1;
    let fin = xml.length;
    let t: RegExpExecArray | null;
    while (nivel > 0 && (t = patron.exec(xml))) {
      if (t[0].startsWith('</')) nivel--;
      else if (t[1] !== '/') nivel++;
      if (nivel === 0) fin = t.index + t[0].length;
    }
    pos = fin;
  }
  return salida + xml.slice(pos);
}

const ETIQUETAS_SOBRANTES = ['mc:AlternateContent', 'controls', 'oleObjects', 'drawing', 'legacyDrawing', 'legacyDrawingHF', 'tableParts', 'picture'];

/** Quita dibujos, botones, comentarios, tablas y macros: ExcelJS falla con ellos y no hacen falta para leer datos. */
export async function limpiarLibro(buf: ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(buf);
  for (const nombre of Object.keys(zip.files)) {
    if (/^xl\/(drawings|ctrlProps|activeX|comments|threadedComments|persons|tables|charts|media|embeddings)\b|^xl\/vbaProject\.bin$|^xl\/comments\d*\.xml$/.test(nombre)) zip.remove(nombre);
  }
  for (const nombre of Object.keys(zip.files)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(nombre)) {
      let x = await zip.file(nombre)!.async('string');
      for (const t of ETIQUETAS_SOBRANTES) x = quitarElementos(x, t);
      zip.file(nombre, x);
    } else if (/^xl\/worksheets\/_rels\/.*\.rels$/.test(nombre)) {
      let x = await zip.file(nombre)!.async('string');
      x = x.replace(/<Relationship [^>]*Type="[^"]*\/(drawing|vmlDrawing|ctrlProp|comments|threadedComment|control|table|oleObject|image|package)"[^>]*\/>/g, '');
      zip.file(nombre, x);
    }
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

export async function leerV17(buf: ArrayBuffer): Promise<DatosV17> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await limpiarLibro(buf));
  const hoja = (n: string) => {
    const h = wb.getWorksheet(n);
    if (!h) throw new Error(`El libro no tiene la hoja "${n}". ¿Es el FORMATO_BKL_V17?`);
    return h;
  };
  const errores: string[] = [];

  const equipos: Omit<Equipo, 'id'>[] = [];
  hoja('EQUIPOS').eachRow((fila, i) => {
    if (i === 1) return;
    const codigo = codigoEquipo(fila.getCell(1));
    if (!codigo) return;
    equipos.push({
      codigo, ahorrativo: texto(fila.getCell(2)) || null, familia: texto(fila.getCell(3)), marca: texto(fila.getCell(4)),
      modelo: texto(fila.getCell(5)), serie: null, ubicacion: texto(fila.getCell(6)), criticidad: null, activo: true,
    });
  });

  const bkls: BklV17[] = [];
  hoja('BD BKL').eachRow((f, i) => {
    if (i < 7) return;
    const id = texto(f.getCell(1));
    if (!id) return;
    const n = numeroBkl(id);
    const pr = prioridad(texto(f.getCell(5)));
    const actividad = texto(f.getCell(4));
    if (n === null) { errores.push(`Fila ${i} de BD BKL: número "${id}" no válido.`); return; }
    if (!pr) { errores.push(`${id}: prioridad "${texto(f.getCell(5))}" no válida.`); return; }
    if (!actividad) { errores.push(`${id}: sin actividad.`); return; }
    const fecha = (col: number) => aFecha(valor(f.getCell(col)));
    bkls.push({
      numero: n, equipo: codigoEquipo(f.getCell(3)), actividad, prioridad: pr, origen: null, origenRef: null,
      fechaIngreso: fecha(2) ?? fecha(14) ?? '2026-01-01',
      estadoManual: estadoManual(texto(f.getCell(7))), planner: texto(f.getCell(8)), responsable: texto(f.getCell(9)),
      noOt: texto(f.getCell(10)) || null, horometro: numero(f.getCell(12)), sistema: texto(f.getCell(13)),
      inicioProgramado: fecha(14), inicioOriginal: fecha(15) ?? fecha(14), diasEstimados: numero(f.getCell(16)) ?? 1,
      tecnicos: texto(f.getCell(17)) || null, hhEstimadas: numero(f.getCell(18)), inicioReal: fecha(19), finReal: fecha(20),
      ejecutadoPor: texto(f.getCell(21)) || null, hhReales: numero(f.getCell(22)), observaciones: texto(f.getCell(23)) || null,
      tareas: [], repuestos: [],
    });
  });
  const porNumero = new Map(bkls.map((b) => [b.numero, b]));

  hoja('BD TAREAS').eachRow((f, i) => {
    if (i === 1) return;
    const b = porNumero.get(numeroBkl(texto(f.getCell(1))) ?? -1);
    const desc = texto(f.getCell(2));
    if (!b || !desc) return;
    b.tareas.push({ orden: b.tareas.length + 1, descripcion: desc, hecha: false });
  });

  hoja('BD REPUESTOS').eachRow((f, i) => {
    if (i === 1) return;
    const b = porNumero.get(numeroBkl(texto(f.getCell(1))) ?? -1);
    if (!b) return;
    const parte = texto(f.getCell(3));
    const desc = texto(f.getCell(4));
    if (!parte && !desc) return;
    const cant = numero(f.getCell(5));
    if (!cant || cant <= 0) { errores.push(`BKL-${b.numero}: repuesto ${parte || desc} sin cantidad, no se importó.`); return; }
    const sc = texto(f.getCell(11));
    const tarea = numero(f.getCell(6));
    b.repuestos.push({
      codigoGp: texto(f.getCell(2)), numeroParte: parte, descripcion: desc, cantidad: cant,
      tareaOrden: tarea && b.tareas.some((t) => t.orden === tarea) ? tarea : null,
      almacen: texto(f.getCell(7)), ubicacion: texto(f.getCell(8)), precioUsd: numero(f.getCell(9)) ?? 0,
      stock: texto(f.getCell(10)).toUpperCase() === 'PEDIR' || sc ? 'pedir' : 'disponible', scMaestro: sc || null,
    });
  });

  const scs: DatosV17['scs'] = [];
  const hojaSc = wb.getWorksheet('PEDIDOS SC');
  hojaSc?.eachRow((f, i) => {
    if (i === 1) return;
    const num = texto(f.getCell(1));
    if (!num) return;
    const bk = texto(f.getCell(3)).split(/[,;/ ]+/).map(numeroBkl).filter((x): x is number => x !== null);
    const pr = texto(f.getCell(5)).toUpperCase();
    scs.push({
      numeroMaestro: num, fecha: aFecha(valor(f.getCell(2))), bklNumeros: bk,
      prioridad: pr.startsWith('EMER') ? 'emergencia' : pr.startsWith('CRIT') ? 'critica' : 'normal',
      proveedor: texto(f.getCell(6)) || null, estado: ESTADOS_SC[texto(f.getCell(7)).toUpperCase()] ?? 'solicitada',
      noOc: texto(f.getCell(8)) || null, fechaEstimada: aFecha(valor(f.getCell(9))), fechaRecibida: aFecha(valor(f.getCell(10))),
      observaciones: texto(f.getCell(14)) || null,
    });
  });
  // SC citadas en repuestos pero sin fila en PEDIDOS SC
  for (const b of bkls) for (const r of b.repuestos) {
    if (r.scMaestro && !scs.some((s) => s.numeroMaestro === r.scMaestro)) {
      scs.push({ numeroMaestro: r.scMaestro, fecha: null, bklNumeros: [b.numero], prioridad: 'normal', proveedor: null, estado: 'solicitada', noOc: null, fechaEstimada: null, fechaRecibida: null, observaciones: 'Importada desde BD REPUESTOS (no estaba en PEDIDOS SC)' });
    }
  }
  return { equipos, bkls, scs, errores };
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');

function buscarPerfil(perfiles: Perfil[], nombre: string): Perfil | null {
  const n = normal(nombre);
  if (!n) return null;
  return perfiles.find((p) => normal(p.nombre) === n || normal(p.usuario) === n) ?? null;
}

export interface ResumenImportacion {
  equipos: number;
  bkls: number;
  scs: number;
  avisos: string[];
}

export async function importarV17(repos: Repos, datos: DatosV17): Promise<ResumenImportacion> {
  const avisos = [...datos.errores];
  await repos.equipos.guardarVarios(datos.equipos);
  const equipos = await repos.equipos.listar();
  const perfiles = await repos.perfiles.listar();
  const existentes = new Set((await repos.bkls.listar()).map((b) => b.d.numero));
  const sinPerfil = new Set<string>();

  const aGuardar: { v: BklV17; equipoId: string }[] = [];
  for (const v of datos.bkls) {
    const id = `BKL-${String(v.numero).padStart(3, '0')}`;
    if (existentes.has(v.numero)) { avisos.push(`${id} ya existe en la app; no se importó de nuevo.`); continue; }
    const eq = buscarEquipo(equipos, v.equipo);
    if (!eq) { avisos.push(`${id}: equipo "${v.equipo}" no está en EQUIPOS; no se importó.`); continue; }
    aGuardar.push({ v, equipoId: eq.id });
  }

  // SC primero (sin enlaces a BKL todavía), para poder poner solicitud_id en los repuestos.
  const numerosNuevos = new Set(aGuardar.map((x) => x.v.numero));
  const scs: ScImportada[] = [];
  for (const s of datos.scs) {
    const usadas = aGuardar.filter((x) => x.v.repuestos.some((r) => r.scMaestro === s.numeroMaestro) || s.bklNumeros.includes(x.v.numero));
    if (!usadas.length) continue;
    scs.push({ ...s, equipoId: usadas[0].equipoId, bklNumeros: s.bklNumeros.filter((n) => numerosNuevos.has(n)) });
  }

  let n = 0;
  const idsSc = new Map<string, string>();
  for (const { v, equipoId } of aGuardar) {
    const resp = buscarPerfil(perfiles, v.responsable);
    const plan = buscarPerfil(perfiles, v.planner);
    if (v.responsable && !resp) sinPerfil.add(v.responsable);
    if (v.planner && !plan) sinPerfil.add(v.planner);
    const { equipo: _e, responsable: _r, planner: _p, repuestos, ...resto } = v;
    const b = new Bkl({
      ...resto, equipoId, responsableId: resp?.id ?? null, plannerId: plan?.id ?? null,
      repuestos: repuestos.map(({ scMaestro: _sc, ...r }) => ({ ...r, solicitudId: null })),
    });
    if (b.d.estadoManual === 'cerrado' && (!b.d.finReal || !b.d.ejecutadoPor || b.d.hhReales === null)) {
      avisos.push(`BKL-${v.numero}: marcado CERRADO sin fin real / ejecutado por / HH reales; se importó como abierto.`);
      b.d.estadoManual = null;
    }
    if (b.d.inicioReal && b.d.finReal && b.d.finReal < b.d.inicioReal) {
      avisos.push(`BKL-${v.numero}: fin real antes del inicio real; se dejó solo el fin real.`);
      b.d.inicioReal = null;
    }
    // se guarda sin SC; los repuestos se enlazan cuando existan las SC
    try {
      b.validar();
      await repos.bkls.guardar(b);
      n++;
    } catch (e) {
      avisos.push(`BKL-${v.numero}: ${(e as Error).message}`);
    }
  }

  if (scs.length) for (const [k, v] of await repos.solicitudes.importar(scs)) idsSc.set(k, v);
  // enlazar repuestos con su SC
  for (const v of datos.bkls) {
    if (!numerosNuevos.has(v.numero) || !v.repuestos.some((r) => r.scMaestro)) continue;
    const b = await repos.bkls.obtener(v.numero);
    if (!b) continue;
    b.d.repuestos = b.d.repuestos.map((r, i) => ({ ...r, solicitudId: v.repuestos[i]?.scMaestro ? idsSc.get(v.repuestos[i].scMaestro!) ?? null : null }));
    await repos.bkls.guardar(b);
  }

  if (sinPerfil.size) avisos.push(`Sin usuario en la app (crea el usuario y vuelve a asignar): ${[...sinPerfil].join(', ')}.`);
  return { equipos: datos.equipos.length, bkls: n, scs: scs.length, avisos };
}
