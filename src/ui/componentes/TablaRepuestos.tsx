import { useMemo, useState, type ClipboardEvent } from 'react';
import { PegadoExcel, leerNumero } from '../../dominio/pegadoExcel';
import { Repuesto, type RepuestoDatos } from '../../dominio/repuesto';
import { dinero } from '../formato';

interface Props {
  valor: RepuestoDatos[];
  onCambio?: (v: RepuestoDatos[]) => void;
  /** Órdenes de tarea disponibles para la columna Tarea. */
  tareas: number[];
  editable?: boolean;
}

const vacio = (): RepuestoDatos => ({ codigoGp: '', numeroParte: '', descripcion: '', cantidad: 1, tareaOrden: null, almacen: '', ubicacion: '', precioUsd: 0, stock: 'disponible' });

export function TablaRepuestos({ valor, onCambio, tareas, editable = false }: Props) {
  const [pegando, setPegando] = useState(false);
  const [texto, setTexto] = useState('');
  const vista = useMemo(() => PegadoExcel.parsear(texto), [texto]);
  const total = valor.reduce((s, r) => s + new Repuesto(r).total(), 0);

  const cambiar = (i: number, c: Partial<RepuestoDatos>) => onCambio?.(valor.map((r, j) => (j === i ? { ...r, ...c } : r)));
  const agregar = (filas: RepuestoDatos[]) => onCambio?.([...valor, ...filas]);

  const alPegar = (e: ClipboardEvent<HTMLDivElement>) => {
    if (!editable) return;
    const t = e.clipboardData.getData('text/plain') || e.clipboardData.getData('text');
    const destino = e.target as HTMLElement;
    if (!t.includes('\t') || (destino.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    const r = PegadoExcel.parsear(t);
    if (r.filas.length) agregar(r.filas);
    if (r.errores.length) { setTexto(t); setPegando(true); }
  };

  const celda = 'border-b border-slate-100 px-1 py-1';
  const inp = 'w-full rounded border border-transparent px-1 py-0.5 text-sm hover:border-slate-300 focus:border-marca-600 focus:outline-none';

  return (
    <div data-testid="zona-repuestos" onPaste={alPegar}>
      {editable && (
        <div className="mb-2 flex flex-wrap items-center gap-2 no-imprimir">
          <button type="button" className="btn" onClick={() => setPegando(true)}>📋 Pegar desde Excel</button>
          <button type="button" className="btn" onClick={() => agregar([vacio()])}>+ Fila</button>
          <span className="text-xs text-slate-500">Orden: Cód. GP · No. parte · Descripción · Cant. · Tarea · Almacén · Ubicación · P. Und USD · Stock. También puedes pegar directo sobre la tabla.</span>
        </div>
      )}
      {pegando && (
        <div className="mb-3 rounded-lg border border-marca-100 bg-marca-50 p-3">
          <label className="etiqueta" htmlFor="pegar-repuestos">Filas copiadas de Excel</label>
          <textarea id="pegar-repuestos" className="campo h-28 font-mono text-xs" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Copia las filas en Excel y pégalas aquí (Ctrl+V)" />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span>{vista.filas.length} {vista.filas.length === 1 ? 'fila lista' : 'filas listas'}</span>
            <button type="button" className="btn-pri" disabled={!vista.filas.length} onClick={() => { agregar(vista.filas); setTexto(''); setPegando(false); }}>
              Agregar {vista.filas.length}
            </button>
            <button type="button" className="btn" onClick={() => { setTexto(''); setPegando(false); }}>Cerrar</button>
          </div>
          {vista.errores.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-red-700">{vista.errores.map((e) => <li key={e.fila}>{e.mensaje}</li>)}</ul>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-1 py-1 w-8">#</th><th className="px-1">Cód. GP</th><th className="px-1">No. parte</th><th className="px-1">Descripción</th>
              <th className="px-1 w-16">Cant.</th><th className="px-1 w-16">Tarea</th><th className="px-1">Almacén</th><th className="px-1">Ubicación</th>
              <th className="px-1 w-24 text-right">P. Und USD</th><th className="px-1 w-24 text-right">Total</th><th className="px-1">Stock / estado</th>
              {editable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {valor.length === 0 && (
              <tr><td colSpan={12} className="px-2 py-4 text-center text-slate-400">Sin repuestos</td></tr>
            )}
            {valor.map((r, i) => {
              const rep = new Repuesto(r);
              const txt = (k: 'codigoGp' | 'numeroParte' | 'descripcion' | 'almacen' | 'ubicacion') =>
                editable ? <input aria-label={`${k} ${i + 1}`} className={inp} value={r[k]} onChange={(e) => cambiar(i, { [k]: e.target.value })} /> : r[k];
              return (
                <tr key={i}>
                  <td className={celda + ' text-slate-400'}>{i + 1}</td>
                  <td className={celda}>{txt('codigoGp')}</td>
                  <td className={celda}>{txt('numeroParte')}</td>
                  <td className={celda}>{txt('descripcion')}</td>
                  <td className={celda}>{editable ? <input className={inp} inputMode="decimal" defaultValue={r.cantidad} onBlur={(e) => { const n = leerNumero(e.target.value); if (n && n > 0) cambiar(i, { cantidad: n }); else e.target.value = String(r.cantidad); }} /> : r.cantidad}</td>
                  <td className={celda}>
                    {editable ? (
                      <select className={inp} value={r.tareaOrden ?? ''} onChange={(e) => cambiar(i, { tareaOrden: e.target.value ? Number(e.target.value) : null })}>
                        <option value="">—</option>
                        {tareas.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : r.tareaOrden ?? ''}
                  </td>
                  <td className={celda}>{txt('almacen')}</td>
                  <td className={celda}>{txt('ubicacion')}</td>
                  <td className={celda + ' text-right'}>{editable ? <input className={inp + ' text-right'} inputMode="decimal" defaultValue={r.precioUsd} onBlur={(e) => { const n = leerNumero(e.target.value); if (n !== null && n >= 0) cambiar(i, { precioUsd: n }); else e.target.value = String(r.precioUsd); }} /> : dinero(r.precioUsd)}</td>
                  <td className={celda + ' text-right tabular-nums'}>{dinero(rep.total())}</td>
                  <td className={celda}>
                    {editable && !r.sc ? (
                      <select className={inp} value={r.stock} onChange={(e) => cambiar(i, { stock: e.target.value as RepuestoDatos['stock'] })}>
                        <option value="disponible">DISPONIBLE</option>
                        <option value="pedir">PEDIR</option>
                      </select>
                    ) : <span className={rep.porPedir() ? 'font-semibold text-red-700' : rep.enSc() ? 'text-amber-700' : 'text-emerald-700'}>{rep.estadoTexto()}</span>}
                  </td>
                  {editable && <td className={celda}><button type="button" aria-label={`Quitar fila ${i + 1}`} className="text-slate-400 hover:text-red-600" onClick={() => onCambio?.(valor.filter((_, j) => j !== i))}>✕</button></td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan={9} className="px-1 py-2 text-right text-xs font-semibold uppercase text-slate-500">Total</td><td className="px-1 py-2 text-right font-semibold tabular-nums">USD {dinero(total)}</td><td colSpan={2} /></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
