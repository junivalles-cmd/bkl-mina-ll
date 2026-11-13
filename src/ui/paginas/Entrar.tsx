import { useState, type FormEvent } from 'react';
import { useSesion } from '../contexto';
import { Aviso } from '../componentes/Aviso';

export function Entrar() {
  const { entrar, entrarDemo, sinPerfil, salir } = useSesion();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try { await entrar(usuario, clave); } catch (err) { setError(err); } finally { setEnviando(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-marca-900 to-marca-600 p-4">
      <form onSubmit={enviar} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-marca-600">Mina La Libertad · CONEQUISA</div>
          <h1 className="text-2xl font-bold text-slate-900">Programación de BKL</h1>
        </div>
        {sinPerfil && (
          <div className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
            Tu usuario existe pero no tiene perfil activo. Pide al administrador que lo active. <button type="button" className="underline" onClick={salir}>Salir</button>
          </div>
        )}
        <label className="etiqueta" htmlFor="usuario">Usuario</label>
        <input id="usuario" className="campo mb-3" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
        <label className="etiqueta" htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" className="campo mb-4" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
        <Aviso error={error} />
        <button className="btn-pri mt-3 w-full justify-center" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="mt-3 w-full text-center text-xs text-slate-500 underline" onClick={entrarDemo}>Ver demostración sin conexión</button>
      </form>
    </div>
  );
}
