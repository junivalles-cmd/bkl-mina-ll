export type EstadoSc = 'solicitada' | 'cotizada' | 'aprobada' | 'oc_emitida' | 'en_transito' | 'recibida' | 'cancelada';
export type Stock = 'disponible' | 'pedir';

export const ESTADOS_SC: EstadoSc[] = ['solicitada', 'cotizada', 'aprobada', 'oc_emitida', 'en_transito', 'recibida', 'cancelada'];

export const TEXTO_ESTADO_SC: Record<EstadoSc, string> = {
  solicitada: 'SOLICITADA',
  cotizada: 'COTIZADA',
  aprobada: 'APROBADA',
  oc_emitida: 'OC EMITIDA',
  en_transito: 'EN TRÁNSITO',
  recibida: 'RECIBIDA',
  cancelada: 'CANCELADA',
};

export function numeroScTexto(n: number): string {
  return 'SCB-' + String(n).padStart(4, '0');
}

export interface RepuestoDatos {
  id?: string;
  tareaOrden: number | null;
  codigoGp: string;
  numeroParte: string;
  descripcion: string;
  cantidad: number;
  almacen: string;
  ubicacion: string;
  precioUsd: number;
  stock: Stock;
  solicitudId?: string | null;
  sc?: { numero: number; estado: EstadoSc } | null;
  kitListo?: boolean;
}

export class Repuesto {
  constructor(readonly d: RepuestoDatos) {}

  total(): number {
    return this.d.cantidad * this.d.precioUsd;
  }

  /** Hay que pedirlo y no tiene una SC vigente. */
  porPedir(): boolean {
    return this.d.stock === 'pedir' && (!this.d.sc || this.d.sc.estado === 'cancelada');
  }

  /** Pedido en una SC que aún no llega. */
  enSc(): boolean {
    return this.d.stock === 'pedir' && !!this.d.sc && this.d.sc.estado !== 'cancelada' && this.d.sc.estado !== 'recibida';
  }

  estadoTexto(): string {
    const { stock, sc } = this.d;
    if (stock !== 'pedir') return 'DISPONIBLE';
    if (!sc || sc.estado === 'cancelada') return 'POR PEDIR';
    const n = numeroScTexto(sc.numero);
    if (sc.estado === 'recibida') return `RECIBIDO (${n})`;
    return `${n} · ${TEXTO_ESTADO_SC[sc.estado]}`;
  }
}
