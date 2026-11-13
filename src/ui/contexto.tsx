import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { correoDeUsuario, supabase } from '../datos/cliente';
import { reposEnMemoria } from '../datos/memoria';
import { reposSupabase } from '../datos/supabase';
import type { Perfil, Repos, Rol } from '../datos/tipos';
import { hoyManagua, type Fecha } from '../dominio/fechas';
import { BklServicio } from '../servicios/bklServicio';
import { datosDemo } from './demo';

interface Sesion {
  repos: Repos;
  servicio: BklServicio;
  perfil: Perfil | null;
  cargando: boolean;
  demo: boolean;
  hoy: Fecha;
  sinPerfil: boolean;
  entrar(usuario: string, clave: string): Promise<void>;
  entrarDemo(): void;
  salir(): Promise<void>;
  puede(...roles: Rol[]): boolean;
}

const Ctx = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de ProveedorSesion');
  return s;
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const hoy = hoyManagua();
  const [demo, setDemo] = useState(() => sessionStorage.getItem('bkl-demo') === '1');
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sinPerfil, setSinPerfil] = useState(false);

  const repos = useMemo<Repos>(() => {
    if (demo) {
      const d = datosDemo(hoy);
      return reposEnMemoria({ ...d, actual: 'p0' });
    }
    return reposSupabase(supabase());
  }, [demo, hoy]);
  const servicio = useMemo(() => new BklServicio(repos, hoyManagua), [repos]);

  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      setCargando(true);
      try {
        const p = await repos.perfiles.actual();
        if (!vivo) return;
        setPerfil(p);
        if (!demo) {
          const { data } = await supabase().auth.getSession();
          setSinPerfil(!!data.session && !p);
        }
      } finally {
        if (vivo) setCargando(false);
      }
    };
    cargar();
    if (demo) return () => { vivo = false; };
    const { data } = supabase().auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') { qc.clear(); cargar(); }
    });
    return () => { vivo = false; data.subscription.unsubscribe(); };
  }, [repos, demo, qc]);

  const valor: Sesion = {
    repos, servicio, perfil, cargando, demo, hoy, sinPerfil,
    async entrar(usuario, clave) {
      const { error } = await supabase().auth.signInWithPassword({ email: correoDeUsuario(usuario), password: clave });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Usuario o contraseña incorrectos.' : error.message);
    },
    entrarDemo() { sessionStorage.setItem('bkl-demo', '1'); qc.clear(); setDemo(true); },
    async salir() {
      if (demo) { sessionStorage.removeItem('bkl-demo'); setPerfil(null); qc.clear(); setDemo(false); return; }
      await supabase().auth.signOut();
    },
    puede: (...roles) => !!perfil && perfil.activo && roles.includes(perfil.rol),
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
