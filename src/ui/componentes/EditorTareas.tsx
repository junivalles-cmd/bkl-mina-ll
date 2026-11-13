import { MAX_TAREAS, type Tarea } from '../../dominio/bkl';

export function EditorTareas({ valor, onCambio }: { valor: Tarea[]; onCambio: (t: Tarea[]) => void }) {
  const renumerar = (t: Tarea[]) => t.map((x, i) => ({ ...x, orden: i + 1 }));
  return (
    <div className="space-y-2">
      {valor.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 text-right text-sm font-semibold text-slate-500">{t.orden}</span>
          <input aria-label={`Tarea ${t.orden}`} className="campo" value={t.descripcion} onChange={(e) => onCambio(valor.map((x, j) => (j === i ? { ...x, descripcion: e.target.value } : x)))} />
          <button type="button" className="btn px-2" aria-label="Subir" disabled={i === 0} onClick={() => { const c = [...valor]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; onCambio(renumerar(c)); }}>↑</button>
          <button type="button" className="btn px-2" aria-label="Quitar tarea" onClick={() => onCambio(renumerar(valor.filter((_, j) => j !== i)))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn" disabled={valor.length >= MAX_TAREAS} onClick={() => onCambio([...valor, { orden: valor.length + 1, descripcion: '', hecha: false }])}>
        + Tarea {valor.length >= MAX_TAREAS ? `(máximo ${MAX_TAREAS})` : ''}
      </button>
    </div>
  );
}
