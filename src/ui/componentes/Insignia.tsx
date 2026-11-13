const COLORES: Record<string, string> = {
  'PROGRAMADO': 'bg-blue-100 text-blue-800',
  'LISTO PARA PROGRAMAR': 'bg-sky-100 text-sky-800',
  'PENDIENTE REPUESTOS': 'bg-amber-100 text-amber-800',
  'EN EJECUCIÓN': 'bg-violet-100 text-violet-800',
  'EJECUTADO': 'bg-emerald-100 text-emerald-800',
  'CERRADO': 'bg-slate-200 text-slate-700',
  'CANCELADO': 'bg-slate-100 text-slate-500 line-through',
  'RETRASADO': 'bg-red-100 text-red-800',
  'RETRASADO – REPUESTOS': 'bg-red-100 text-red-800',
  'EJECUTADO CON RETRASO': 'bg-orange-100 text-orange-800',
  'ESPERA REPUESTOS': 'bg-amber-100 text-amber-800',
  'PENDIENTE': 'bg-slate-100 text-slate-700',
  'A': 'bg-red-600 text-white', 'B': 'bg-amber-500 text-white', 'C': 'bg-slate-500 text-white',
};

export function Insignia({ texto }: { texto: string }) {
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ${COLORES[texto] ?? 'bg-slate-100 text-slate-700'}`}>{texto}</span>;
}
