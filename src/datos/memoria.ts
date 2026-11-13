import { Bkl } from '../dominio/bkl';
import { PARAMETROS_DEF, type Parametros } from '../dominio/parametros';
import type { Equipo, EventoBkl, Perfil, Repos } from './tipos';

let contador = 0;
const nuevoId = () => `m-${++contador}`;

/** Repositorios en memoria: pruebas y modo demostración. */
export function reposEnMemoria(inicial: { equipos?: Equipo[]; perfiles?: Perfil[]; bkls?: Bkl[]; actual?: string } = {}): Repos {
  const equipos = [...(inicial.equipos ?? [])];
  const perfiles = [...(inicial.perfiles ?? [])];
  const bkls = new Map<number, Bkl>();
  const eventos = new Map<number, EventoBkl[]>();
  let parametros: Parametros = { ...PARAMETROS_DEF };
  let siguiente = 1;
  for (const b of inicial.bkls ?? []) {
    bkls.set(b.d.numero!, new Bkl({ ...b.datos(), id: b.d.id ?? nuevoId() }));
    siguiente = Math.max(siguiente, b.d.numero! + 1);
  }
  const ev = (n: number, tipo: string, detalle: Record<string, unknown> = {}) =>
    eventos.set(n, [...(eventos.get(n) ?? []), { tipo, detalle, fecha: new Date().toISOString(), usuario: inicial.actual ?? null }]);

  return {
    equipos: {
      async listar() { return equipos.map((e) => ({ ...e })).sort((a, b) => a.codigo.localeCompare(b.codigo)); },
      async guardar(e) {
        const i = equipos.findIndex((x) => x.id === e.id || x.codigo === e.codigo);
        const final = { ...e, id: e.id ?? (i >= 0 ? equipos[i].id : nuevoId()) } as Equipo;
        if (i >= 0) equipos[i] = final; else equipos.push(final);
        return final;
      },
      async guardarVarios(es) { for (const e of es) await this.guardar(e); return es.length; },
    },
    perfiles: {
      async listar() { return perfiles.map((p) => ({ ...p })); },
      async actual() { return perfiles.find((p) => p.id === inicial.actual) ?? null; },
    },
    parametros: {
      async obtener() { return { ...parametros }; },
      async guardar(p) { parametros = { ...p }; },
    },
    bkls: {
      async listar() { return [...bkls.values()].map((b) => new Bkl(b.datos())); },
      async obtener(numero) { const b = bkls.get(numero); return b ? new Bkl(b.datos()) : null; },
      async guardar(b) {
        const d = b.datos();
        const nuevo = !d.id;
        const numero = d.numero ?? siguiente;
        siguiente = Math.max(siguiente, numero + 1);
        const previo = bkls.get(numero);
        if (previo && previo.d.inicioProgramado && previo.d.inicioProgramado !== d.inicioProgramado) {
          ev(numero, 'reprogramado', { de: previo.d.inicioProgramado, a: d.inicioProgramado });
        }
        bkls.set(numero, new Bkl({ ...d, id: d.id ?? nuevoId(), numero }));
        if (nuevo) ev(numero, 'creado');
        return numero;
      },
      async eventos(numero) { return [...(eventos.get(numero) ?? [])]; },
    },
  };
}
