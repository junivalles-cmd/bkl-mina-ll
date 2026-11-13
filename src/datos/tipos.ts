import type { Bkl, Prioridad } from '../dominio/bkl';
import type { Parametros } from '../dominio/parametros';
import type { EstadoSc } from '../dominio/repuesto';

export type Rol = 'admin' | 'planner' | 'responsable' | 'supervisor' | 'almacen' | 'compras' | 'jefatura';
export const ROLES: Rol[] = ['admin', 'planner', 'responsable', 'supervisor', 'almacen', 'compras', 'jefatura'];

export interface Equipo {
  id: string;
  codigo: string;
  ahorrativo: string | null;
  familia: string;
  marca: string;
  modelo: string;
  serie: string | null;
  ubicacion: string;
  criticidad: Prioridad | null;
  activo: boolean;
}

export interface Perfil {
  id: string;
  usuario: string;
  nombre: string;
  correo: string | null;
  rol: Rol;
  hhSemana: number;
  activo: boolean;
}

export interface ScImportada {
  numeroMaestro: string;
  fecha: string | null;
  equipoId: string;
  prioridad: 'emergencia' | 'critica' | 'normal';
  proveedor: string | null;
  estado: EstadoSc;
  noOc: string | null;
  fechaEstimada: string | null;
  fechaRecibida: string | null;
  observaciones: string | null;
  bklNumeros: number[];
}

export interface EventoBkl {
  tipo: string;
  detalle: Record<string, unknown>;
  fecha: string;
  usuario: string | null;
}

export interface Repos {
  equipos: {
    listar(): Promise<Equipo[]>;
    guardar(e: Omit<Equipo, 'id'> & { id?: string }): Promise<Equipo>;
    guardarVarios(es: (Omit<Equipo, 'id'> & { id?: string })[]): Promise<number>;
  };
  perfiles: {
    listar(): Promise<Perfil[]>;
    actual(): Promise<Perfil | null>;
    /** Cambia nombre, rol, HH/semana o activo (solo admin). */
    guardar(p: Perfil): Promise<void>;
    /** Crea usuario + perfil (función segura crear-usuario en Supabase). */
    crear(p: Omit<Perfil, 'id'>, clave: string): Promise<void>;
  };
  parametros: {
    obtener(): Promise<Parametros>;
    guardar(p: Parametros): Promise<void>;
  };
  solicitudes: {
    /** Crea SC importadas (con su V-#### en numero_maestro); devuelve numero_maestro → id. */
    importar(scs: ScImportada[]): Promise<Map<string, string>>;
  };
  bkls: {
    listar(): Promise<Bkl[]>;
    obtener(numero: number): Promise<Bkl | null>;
    /** Guarda cabecera, tareas y repuestos de una vez; devuelve el número. */
    guardar(b: Bkl): Promise<number>;
    eventos(numero: number): Promise<EventoBkl[]>;
  };
}
