/** Fecha de calendario sin hora, formato YYYY-MM-DD. Toda la aritmética se hace en UTC. */
export type Fecha = string;

const DIA_MS = 86_400_000;
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function aUtc(f: Fecha): number {
  const m = RE_ISO.exec(f);
  if (!m) throw new Error(`Fecha inválida: ${f}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

function deUtc(ms: number): Fecha {
  return new Date(ms).toISOString().slice(0, 10);
}

export function esFecha(s: string): boolean {
  const m = RE_ISO.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function sumarDias(f: Fecha, n: number): Fecha {
  return deUtc(aUtc(f) + n * DIA_MS);
}

/** a − b en días. */
export function difDias(a: Fecha, b: Fecha): number {
  return Math.round((aUtc(a) - aUtc(b)) / DIA_MS);
}

export function semanaIso(f: Fecha): { anio: number; semana: number } {
  const d = new Date(aUtc(f));
  const dia = d.getUTCDay() || 7; // lunes=1 … domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - dia); // jueves de esa semana
  const anio = d.getUTCFullYear();
  const semana = Math.ceil(((d.getTime() - Date.UTC(anio, 0, 1)) / DIA_MS + 1) / 7);
  return { anio, semana };
}

export function lunesSemanaIso(anio: number, semana: number): Fecha {
  const cuatroEne = Date.UTC(anio, 0, 4);
  const dia = new Date(cuatroEne).getUTCDay() || 7;
  return deUtc(cuatroEne - (dia - 1) * DIA_MS + (semana - 1) * 7 * DIA_MS);
}

export function domingoSemanaIso(anio: number, semana: number): Fecha {
  return sumarDias(lunesSemanaIso(anio, semana), 6);
}

export function mesDe(f: Fecha): number {
  return +f.slice(5, 7);
}

export function hoyManagua(): Fecha {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua' }).format(new Date());
}

/** Convierte lo que venga de Excel o de un formulario a Fecha. */
export function aFecha(v: unknown): Fecha | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : deUtc(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number') {
    if (!isFinite(v) || v < 1) return null;
    return deUtc(Date.UTC(1899, 11, 30) + Math.floor(v) * DIA_MS);
  }
  const s = String(v).trim();
  if (esFecha(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return esFecha(s.slice(0, 10)) ? s.slice(0, 10) : null;
  const m = RE_DMY.exec(s);
  if (m) {
    const f = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return esFecha(f) ? f : null;
  }
  return null;
}

export function fechaCorta(f: Fecha | null | undefined): string {
  if (!f) return '';
  return `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}`;
}
