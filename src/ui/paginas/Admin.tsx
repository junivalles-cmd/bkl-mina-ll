import { useState, type FormEvent } from 'react';
import { CLAVES_PARAMETRO, type Parametros } from '../../dominio/parametros';
import type { Equipo, Perfil, Rol } from '../../datos/tipos';
import { ROLES } from '../../datos/tipos';
import type { DatosV17, ResumenImportacion } from '../../servicios/importarV17';

const modImport = () => import('../../servicios/importarV17');
import { useAccion, useEquipos, useParametros, usePerfiles } from '../consultas';
import { useSesion } from '../contexto';
import { Aviso } from '../componentes/Aviso';

type Pestana = 'equipos' | 'usuarios' | 'parametros' | 'importar';

export function Admin() {
  const [p, setP] = useState<Pestana>('equipos');
  const tab = (id: Pestana, t: string) => (
    <button className={`border-b-2 px-3 py-2 text-sm font-medium ${p === id ? 'border-marca-600 text-marca-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`} onClick={() => setP(id)}>{t}</button>
  );
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Administración</h1>
      <div className="flex border-b border-slate-200">{tab('equipos', 'Equipos')}{tab('usuarios', 'Usuarios')}{tab('parametros', 'Parámetros')}{tab('importar', 'Importar FORMATO_BKL_V17')}</div>
      {p === 'equipos' && <Equipos />}
      {p === 'usuarios' && <Usuarios />}
      {p === 'parametros' && <ParametrosForm />}
      {p === 'importar' && <Importar />}
    </div>
  );
}

const equipoVacio: Omit<Equipo, 'id'> = { codigo: '', ahorrativo: '', familia: '', marca: '', modelo: '', serie: '', ubicacion: '', criticidad: null, activo: true };

function Equipos() {
  const { repos } = useSesion();
  const equipos = useEquipos();
  const [ed, setEd] = useState<(Omit<Equipo, 'id'> & { id?: string }) | null>(null);
  const [filtro, setFiltro] = useState('');
  const guardar = useAccion(async (e: Omit<Equipo, 'id'> & { id?: string }) => repos.equipos.guardar({ ...e, codigo: e.codigo.trim(), ahorrativo: e.ahorrativo?.trim() || null }));
  const lista = (equipos.data ?? []).filter((e) => !filtro || [e.codigo, e.ahorrativo, e.familia, e.modelo].some((x) => x?.toLowerCase().includes(filtro.toLowerCase())));
  const campo = (k: keyof typeof equipoVacio, t: string) => (
    <div><label className="etiqueta" htmlFor={`eq-${k}`}>{t}</label><input id={`eq-${k}`} className="campo" value={String(ed?.[k] ?? '')} onChange={(x) => setEd({ ...ed!, [k]: x.target.value })} /></div>
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><input className="campo max-w-xs" placeholder="Buscar equipo…" value={filtro} onChange={(e) => setFiltro(e.target.value)} /><button className="btn-pri" onClick={() => setEd({ ...equipoVacio })}>+ Equipo</button></div>
      {ed && (
        <form className="tarjeta grid gap-3 md:grid-cols-4" onSubmit={(e: FormEvent) => { e.preventDefault(); guardar.mutate(ed, { onSuccess: () => setEd(null) }); }}>
          {campo('codigo', 'Código (45-86)')}{campo('ahorrativo', 'Ahorrativo (A01)')}{campo('familia', 'Familia')}{campo('marca', 'Marca')}
          {campo('modelo', 'Modelo')}{campo('serie', 'Serie')}{campo('ubicacion', 'Ubicación')}
          <div className="flex items-end gap-2"><label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={ed.activo} onChange={(x) => setEd({ ...ed, activo: x.target.checked })} /> Activo</label></div>
          <div className="md:col-span-4 flex gap-2"><button className="btn-pri">Guardar</button><button type="button" className="btn" onClick={() => setEd(null)}>Cancelar</button></div>
          <div className="md:col-span-4"><Aviso error={guardar.error} /></div>
        </form>
      )}
      <div className="tarjeta overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Código</th><th>Ahorrativo</th><th>Familia</th><th>Marca</th><th>Modelo</th><th>Ubicación</th><th>Activo</th><th /></tr></thead>
          <tbody>{lista.map((e) => (
            <tr key={e.id} className="border-t border-slate-100"><td className="px-3 py-1.5 font-semibold">{e.codigo}</td><td>{e.ahorrativo}</td><td>{e.familia}</td><td>{e.marca}</td><td>{e.modelo}</td><td>{e.ubicacion}</td><td>{e.activo ? 'Sí' : 'No'}</td>
              <td><button className="text-marca-600 hover:underline" onClick={() => setEd({ ...e })}>Editar</button></td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function Usuarios() {
  const { repos, demo } = useSesion();
  const perfiles = usePerfiles();
  const [nuevo, setNuevo] = useState({ usuario: '', nombre: '', correo: '', rol: 'responsable' as Rol, hhSemana: '0', clave: '' });
  const crear = useAccion(async () => repos.perfiles.crear({ usuario: nuevo.usuario.trim().toLowerCase(), nombre: nuevo.nombre.trim(), correo: nuevo.correo.trim() || null, rol: nuevo.rol, hhSemana: Number(nuevo.hhSemana) || 0, activo: true }, nuevo.clave));
  const guardar = useAccion(async (p: Perfil) => repos.perfiles.guardar(p));
  return (
    <div className="space-y-3">
      <form className="tarjeta grid gap-3 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); crear.mutate(undefined, { onSuccess: () => setNuevo({ usuario: '', nombre: '', correo: '', rol: 'responsable', hhSemana: '0', clave: '' }) }); }}>
        <div><label className="etiqueta" htmlFor="u-usuario">Usuario</label><input id="u-usuario" className="campo" value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value })} required pattern="[a-zA-Z0-9._-]+" /></div>
        <div className="md:col-span-2"><label className="etiqueta" htmlFor="u-nombre">Nombre</label><input id="u-nombre" className="campo" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} required /></div>
        <div><label className="etiqueta" htmlFor="u-rol">Rol</label><select id="u-rol" className="campo" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
        <div><label className="etiqueta" htmlFor="u-hh">HH / semana</label><input id="u-hh" className="campo" inputMode="decimal" value={nuevo.hhSemana} onChange={(e) => setNuevo({ ...nuevo, hhSemana: e.target.value })} /></div>
        <div><label className="etiqueta" htmlFor="u-clave">Contraseña inicial</label><input id="u-clave" className="campo" type="text" minLength={8} value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })} required /></div>
        <div className="md:col-span-6 flex items-center gap-3"><button className="btn-pri" disabled={crear.isPending}>Crear usuario</button>
          <span className="text-xs text-slate-500">Entrará con el usuario (sin @) y esta contraseña.{demo && ' En demostración no se crea en Supabase.'}</span></div>
        <div className="md:col-span-6"><Aviso error={crear.error ?? guardar.error} /></div>
      </form>
      <div className="tarjeta overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Usuario</th><th>Nombre</th><th>Rol</th><th>HH / semana</th><th>Activo</th></tr></thead>
          <tbody>{(perfiles.data ?? []).map((p) => (
            <tr key={p.id} className="border-t border-slate-100">
              <td className="px-3 py-1.5 font-semibold">{p.usuario}</td><td>{p.nombre}</td>
              <td><select className="campo w-36" value={p.rol} onChange={(e) => guardar.mutate({ ...p, rol: e.target.value as Rol })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
              <td><input className="campo w-24" defaultValue={p.hhSemana} onBlur={(e) => Number(e.target.value) !== p.hhSemana && guardar.mutate({ ...p, hhSemana: Number(e.target.value) || 0 })} /></td>
              <td><input type="checkbox" checked={p.activo} onChange={(e) => guardar.mutate({ ...p, activo: e.target.checked })} /></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

const ETIQUETAS: Record<keyof Parametros, string> = {
  tipoCambio: 'Tipo de cambio C$/USD', factorTiempoEfectivo: 'Factor tiempo efectivo (0–1)', diasParaIniciar: 'Días para iniciar (por defecto)',
  diasEstimadosDef: 'Días estimados (por defecto)', hhPorDia: 'HH por día (si no se estiman HH)',
};

function ParametrosForm() {
  const { repos } = useSesion();
  const q = useParametros();
  const [v, setV] = useState<Parametros | null>(null);
  const actual = v ?? q.data;
  const guardar = useAccion(async (p: Parametros) => repos.parametros.guardar(p));
  if (!actual) return null;
  return (
    <form className="tarjeta grid max-w-xl gap-3" onSubmit={(e) => { e.preventDefault(); guardar.mutate(actual, { onSuccess: () => setV(null) }); }}>
      {(Object.keys(CLAVES_PARAMETRO) as (keyof Parametros)[]).map((k) => (
        <div key={k} className="grid grid-cols-2 items-center gap-2"><label htmlFor={`par-${k}`} className="text-sm">{ETIQUETAS[k]}</label>
          <input id={`par-${k}`} className="campo" inputMode="decimal" value={actual[k]} onChange={(e) => setV({ ...actual, [k]: Number(e.target.value) })} /></div>
      ))}
      <div><button className="btn-pri" disabled={!v}>Guardar parámetros</button></div>
      <Aviso error={guardar.error} />
    </form>
  );
}

function Importar() {
  const { repos } = useSesion();
  const [datos, setDatos] = useState<DatosV17 | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [res, setRes] = useState<ResumenImportacion | null>(null);
  const importar = useAccion(async (d: DatosV17) => (await modImport()).importarV17(repos, d));
  const leer = async (f: File | undefined) => {
    if (!f) return;
    setError(null); setDatos(null); setRes(null); setLeyendo(true);
    try { setDatos(await (await modImport()).leerV17(await f.arrayBuffer())); } catch (e) { setError(e); } finally { setLeyendo(false); }
  };
  return (
    <div className="tarjeta space-y-3">
      <p className="text-sm text-slate-600">Sube tu <b>FORMATO_BKL_V17</b> (.xlsx o .xlsm). Se cargan los equipos, BKL (con su número), tareas, repuestos y SC. Los BKL que ya existan en la app no se tocan. Crea antes los usuarios de los responsables para que queden asignados.</p>
      <input type="file" accept=".xlsx,.xlsm" onChange={(e) => leer(e.target.files?.[0])} />
      {leyendo && <p className="text-sm text-slate-500">Leyendo libro…</p>}
      <Aviso error={error ?? importar.error} />
      {datos && !res && (
        <div className="space-y-2 text-sm">
          <p>Encontrado: <b>{datos.equipos.length}</b> equipos, <b>{datos.bkls.length}</b> BKL, <b>{datos.bkls.reduce((s, b) => s + b.tareas.length, 0)}</b> tareas, <b>{datos.bkls.reduce((s, b) => s + b.repuestos.length, 0)}</b> repuestos, <b>{datos.scs.length}</b> SC.</p>
          {datos.errores.length > 0 && <ul className="list-disc pl-5 text-amber-700">{datos.errores.map((x, i) => <li key={i}>{x}</li>)}</ul>}
          <button className="btn-pri" disabled={importar.isPending} onClick={() => importar.mutate(datos, { onSuccess: setRes })}>{importar.isPending ? 'Importando…' : 'Importar'}</button>
        </div>
      )}
      {res && (
        <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900">
          <p>Listo: {res.equipos} equipos, {res.bkls} BKL nuevos, {res.scs} SC.</p>
          {res.avisos.length > 0 && <ul className="mt-2 list-disc pl-5 text-amber-800">{res.avisos.map((x, i) => <li key={i}>{x}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
