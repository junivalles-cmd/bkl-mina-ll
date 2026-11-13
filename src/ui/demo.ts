import { Bkl } from '../dominio/bkl';
import { PARAMETROS_DEF } from '../dominio/parametros';
import { sumarDias, type Fecha } from '../dominio/fechas';
import type { Equipo, Perfil } from '../datos/tipos';

const eq = (id: string, codigo: string, ahorrativo: string, familia: string, marca: string, modelo: string, ubicacion: string): Equipo =>
  ({ id, codigo, ahorrativo, familia, marca, modelo, serie: null, ubicacion, criticidad: null, activo: true });

export function datosDemo(hoy: Fecha) {
  const equipos = [
    eq('e1', '15-59', 'R01', 'Retroexcavadora', 'Caterpillar', '416F2', 'Volcán'),
    eq('e2', '45-86', 'A01', 'Camión articulado', 'Caterpillar', '740B', 'Mojón'),
    eq('e3', '05-49', 'T04', 'Tractor de orugas', 'Caterpillar', 'D6T XL', 'Volcán'),
    eq('e4', '20-85', 'E03', 'Excavadora', 'Komatsu', 'PC300', 'Acarreo'),
  ];
  const perfiles: Perfil[] = [
    { id: 'p0', usuario: 'jvalles', nombre: 'Junior Valles', correo: null, rol: 'admin', hhSemana: 0, activo: true },
    { id: 'p1', usuario: 'jsoza', nombre: 'Jean Carlos Soza', correo: null, rol: 'responsable', hhSemana: 160, activo: true },
    { id: 'p2', usuario: 'gcabrera', nombre: 'Gelber Cabrera', correo: null, rol: 'responsable', hhSemana: 160, activo: true },
  ];
  const P = PARAMETROS_DEF;
  const b = (numero: number, equipoId: string, actividad: string, prioridad: 'A' | 'B' | 'C', diasAtras: number, extra: Partial<Bkl['d']> = {}) =>
    new Bkl({ ...Bkl.nuevo({ equipoId, actividad, prioridad, responsableId: numero % 2 ? 'p1' : 'p2', plannerId: 'p0' }, P, sumarDias(hoy, -diasAtras)).datos(), numero, ...extra });
  const bkls = [
    b(1, 'e1', 'Cambio de planetarios delanteros, balineras de patente y retenedores', 'B', 3, {
      sistema: 'Eje delantero', hhEstimadas: 16, diasEstimados: 2,
      tareas: [
        { orden: 1, descripcion: 'Desmontaje de mandos finales delanteros y reemplazo de juego planetario', hecha: false },
        { orden: 2, descripcion: 'Reemplazo de balineras y pines de patente', hecha: false },
        { orden: 3, descripcion: 'Sellos, armado, ajuste y llenado de aceite', hecha: false },
      ],
      repuestos: [
        { codigoGp: '81380', numeroParte: '4364440', descripcion: 'TAPON', cantidad: 2, tareaOrden: 1, almacen: 'CONSIGNADO NIMAC', ubicacion: 'C1-2A3', precioUsd: 18.05, stock: 'disponible' },
        { codigoGp: '81382', numeroParte: '4907461', descripcion: 'JGO PLANETARIO', cantidad: 2, tareaOrden: 1, almacen: 'CONSIGNADO NIMAC', ubicacion: 'C1-2C1', precioUsd: 2445.27, stock: 'disponible' },
        { codigoGp: '81384', numeroParte: '4907460', descripcion: 'CORONA MANDO FINAL', cantidad: 2, tareaOrden: 1, almacen: '', ubicacion: '', precioUsd: 812.93, stock: 'pedir' },
      ],
    }),
    b(2, 'e2', 'Reparación de fuga en cilindro de volteo', 'A', 25, { hhEstimadas: 6, inicioProgramado: sumarDias(hoy, -4), inicioOriginal: sumarDias(hoy, -4) }),
    b(3, 'e3', 'Cambio de cuchillas y cantoneras', 'C', 10, { inicioProgramado: sumarDias(hoy, 2), repuestos: [
      { codigoGp: '7001', numeroParte: '4T-3925', descripcion: 'CUCHILLA', cantidad: 6, tareaOrden: null, almacen: 'ALMACEN 13A', ubicacion: 'R3', precioUsd: 96.4, stock: 'disponible' },
    ] }),
    b(4, 'e4', 'Inspección y ajuste de tren de rodaje', 'B', 40, { inicioReal: sumarDias(hoy, -6), finReal: sumarDias(hoy, -5), hhReales: 7, ejecutadoPor: 'Gelber Cabrera', estadoManual: 'cerrado' }),
  ];
  return { equipos, perfiles, bkls };
}
