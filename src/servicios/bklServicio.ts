import { Bkl, type BklDatos, type DatosCierre, type Prioridad, type Tarea } from '../dominio/bkl';
import { ReglaNegocioError } from '../dominio/errores';
import type { Fecha } from '../dominio/fechas';
import type { RepuestoDatos } from '../dominio/repuesto';
import type { Equipo, Repos } from '../datos/tipos';

const normal = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const sinCeros = (s: string) => s.replace(/^0+/, '');

/** Encuentra un equipo por código (45-86, 4586, 518) o ahorrativo (A01). */
export function buscarEquipo(equipos: Equipo[], texto: string): Equipo | null {
  const t = normal(texto);
  if (!t) return null;
  return (
    equipos.find((e) => normal(e.codigo) === t) ??
    equipos.find((e) => e.ahorrativo && normal(e.ahorrativo) === t) ??
    equipos.find((e) => sinCeros(normal(e.codigo)) === sinCeros(t)) ??
    null
  );
}

export interface EntradaBkl extends Partial<Omit<BklDatos, 'equipoId' | 'tareas' | 'repuestos'>> {
  equipo: string;
  actividad: string;
  prioridad: Prioridad;
  tareas: Tarea[];
  repuestos: RepuestoDatos[];
}

/** Campos que el planner puede cambiar al editar (no número, ni inicio original, ni reprogramaciones). */
const EDITABLES: (keyof BklDatos)[] = [
  'equipoId', 'actividad', 'sistema', 'prioridad', 'responsableId', 'plannerId', 'hhEstimadas', 'diasEstimados', 'tecnicos',
  'fechaIngreso', 'inicioReal', 'finReal', 'hhReales', 'ejecutadoPor', 'horometro', 'noOt', 'observaciones', 'estadoManual', 'tareas', 'repuestos',
];

export class BklServicio {
  constructor(private repos: Repos, private hoy: () => Fecha) {}

  private async exigir(numero: number): Promise<Bkl> {
    const b = await this.repos.bkls.obtener(numero);
    if (!b) throw new ReglaNegocioError(`No existe el BKL ${numero}.`);
    return b;
  }

  async crear(e: EntradaBkl): Promise<number> {
    const equipo = buscarEquipo(await this.repos.equipos.listar(), e.equipo);
    if (!equipo) throw new ReglaNegocioError(`No se encontró el equipo "${e.equipo}".`);
    const { equipo: _texto, ...resto } = e;
    const b = Bkl.nuevo({ ...resto, equipoId: equipo.id }, await this.repos.parametros.obtener(), this.hoy());
    b.validar();
    return this.repos.bkls.guardar(b);
  }

  async actualizar(numero: number, cambios: Partial<BklDatos>): Promise<void> {
    const b = await this.exigir(numero);
    const d = b.datos();
    for (const k of EDITABLES) if (k in cambios) (d as unknown as Record<string, unknown>)[k] = cambios[k];
    const nuevo = new Bkl(d);
    if (cambios.inicioProgramado !== undefined && cambios.inicioProgramado !== b.d.inicioProgramado) {
      if (cambios.inicioProgramado === null) nuevo.d.inicioProgramado = null;
      else nuevo.reprogramar(cambios.inicioProgramado);
    }
    nuevo.validar();
    await this.repos.bkls.guardar(nuevo);
  }

  async reprogramar(numero: number, f: Fecha): Promise<void> {
    const b = await this.exigir(numero);
    b.reprogramar(f);
    await this.repos.bkls.guardar(b);
  }

  async cerrar(numero: number, c: DatosCierre): Promise<void> {
    const b = await this.exigir(numero);
    b.cerrar(c);
    await this.repos.bkls.guardar(b);
  }

  async cancelar(numero: number): Promise<void> {
    const b = await this.exigir(numero);
    b.cancelar();
    await this.repos.bkls.guardar(b);
  }

  async reabrir(numero: number): Promise<void> {
    const b = await this.exigir(numero);
    if (b.d.estadoManual !== 'cerrado' && b.d.estadoManual !== 'cancelado') throw new ReglaNegocioError('El BKL no está cerrado ni cancelado.');
    b.d.estadoManual = null;
    await this.repos.bkls.guardar(b);
  }

  /** BKL abiertos ordenados por puntaje (mayor primero). */
  async backlog(): Promise<Bkl[]> {
    const hoy = this.hoy();
    return (await this.repos.bkls.listar())
      .filter((b) => b.abierto())
      .sort((a, b) => (b.puntaje(hoy) ?? 0) - (a.puntaje(hoy) ?? 0) || (a.d.numero ?? 0) - (b.d.numero ?? 0));
  }
}
