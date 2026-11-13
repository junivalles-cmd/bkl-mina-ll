import { Navigate, Route, Routes } from 'react-router-dom';
import { useSesion } from './contexto';
import { Diseno } from './Diseno';
import { Cargando } from './componentes/Aviso';
import { Entrar } from './paginas/Entrar';
import { Backlog } from './paginas/Backlog';
import { BklFormulario } from './paginas/BklFormulario';
import { BklDetalle } from './paginas/BklDetalle';
import { Imprimir } from './paginas/Imprimir';
import { Admin } from './paginas/Admin';
import type { Rol } from '../datos/tipos';
import type { ReactNode } from 'react';

function Solo({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { puede } = useSesion();
  return puede(...roles) ? <>{children}</> : <div className="tarjeta text-sm text-slate-600">No tienes permiso para ver esta pantalla.</div>;
}

export function App() {
  const { perfil, cargando } = useSesion();
  if (cargando) return <Cargando />;
  if (!perfil || !perfil.activo) return <Entrar />;
  return (
    <Routes>
      <Route path="/bkl/:numero/imprimir" element={<Imprimir />} />
      <Route element={<Diseno />}>
        <Route path="/backlog" element={<Backlog />} />
        <Route path="/bkl/nuevo" element={<Solo roles={['admin', 'planner']}><BklFormulario /></Solo>} />
        <Route path="/bkl/:numero/editar" element={<Solo roles={['admin', 'planner']}><BklFormulario /></Solo>} />
        <Route path="/bkl/:numero" element={<BklDetalle />} />
        <Route path="/admin" element={<Solo roles={['admin']}><Admin /></Solo>} />
        <Route path="*" element={<Navigate to="/backlog" replace />} />
      </Route>
    </Routes>
  );
}
