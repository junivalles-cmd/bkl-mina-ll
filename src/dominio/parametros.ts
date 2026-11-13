export interface Parametros {
  tipoCambio: number;
  factorTiempoEfectivo: number;
  diasParaIniciar: number;
  diasEstimadosDef: number;
  hhPorDia: number;
}

export const PARAMETROS_DEF: Parametros = {
  tipoCambio: 36.62,
  factorTiempoEfectivo: 0.5,
  diasParaIniciar: 6,
  diasEstimadosDef: 1,
  hhPorDia: 8,
};

/** Claves tal como están en la tabla `parametro`. */
export const CLAVES_PARAMETRO: Record<keyof Parametros, string> = {
  tipoCambio: 'tipo_cambio',
  factorTiempoEfectivo: 'factor_tiempo_efectivo',
  diasParaIniciar: 'dias_para_iniciar',
  diasEstimadosDef: 'dias_estimados_def',
  hhPorDia: 'hh_por_dia',
};
