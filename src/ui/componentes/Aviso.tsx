export function Aviso({ error }: { error: unknown }) {
  if (!error) return null;
  return <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error instanceof Error ? error.message : String(error)}</div>;
}

export function Cargando() {
  return <div className="p-6 text-sm text-slate-500">Cargando…</div>;
}
