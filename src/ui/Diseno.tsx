import { NavLink, Outlet } from 'react-router-dom';
import { useSesion } from './contexto';

export function Diseno() {
  const { perfil, salir, demo, puede } = useSesion();
  const enlace = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-marca-100 hover:text-white'}`;
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="no-imprimir bg-marca-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-2">
          <div className="mr-4 font-bold tracking-tight">BKL · Mina La Libertad</div>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/backlog" className={enlace}>Backlog</NavLink>
            {puede('admin', 'planner') && <NavLink to="/bkl/nuevo" className={enlace}>Nuevo BKL</NavLink>}
            {puede('admin') && <NavLink to="/admin" className={enlace}>Administración</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {demo && <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">DEMOSTRACIÓN</span>}
            <span className="text-marca-100">{perfil?.nombre} · {perfil?.rol}</span>
            <button className="text-marca-100 underline hover:text-white" onClick={salir}>Salir</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4"><Outlet /></main>
    </div>
  );
}
