import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBkls, useEquipos, useParametros, usePerfiles } from '../consultas';
import { useSesion } from '../contexto';
import { Insignia } from '../componentes/Insignia';
import { Aviso, Cargando } from '../componentes/Aviso';
import { dinero, horas } from '../formato';
import { fechaCorta } from '../../dominio/fechas';
import { PARAMETROS_DEF } from '../../dominio/parametros';
import { ORIGENES, textoOrigen, type EstadoBkl } from '../../dominio/bkl';

const ESTADOS: EstadoBkl[] = ['LISTO PARA PROGRAMAR', 'PROGRAMADO', 'PENDIENTE REPUESTOS', 'EN EJECUCIÓN', 'EJECUTADO', 'CERRADO', 'CANCELADO'];

export function Backlog() {
  const { hoy, puede } = useSesion();
  const bkls = useBkls();
  const equipos = useEquipos();
  const perfiles = usePerfiles();
  const p = useParametros().data ?? PARAMETROS_DEF;
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState('ABIERTOS');
  const [resp, setResp] = useState('');
  const [prio, setPrio] = useState('');
  const [origen, setOrigen] = useState('');

  const eqPorId = useMemo(() => new Map((equipos.data ?? []).map((e) => [e.id, e])), [equipos.data]);
  const pPorId = useMemo(() => new Map((perfiles.data ?? []).map((x) => [x.id, x])), [perfiles.data]);

  const filas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return (bkls.data ?? [])
      .filter((b) => (estado === 'ABIERTOS' ? b.abierto() : estado === 'TODOS' ? true : b.estado() === estado))
      .filter((b) => !resp || b.d.responsableId === resp)
      .filter((b) => !prio || b.d.prioridad === prio)
      .filter((b) => !origen || (origen === 'SIN' ? !b.d.origen : b.d.origen === origen))
      .filter((b) => {
        if (!t) return true;
        const e = eqPorId.get(b.d.equipoId);
        return [b.numeroTexto(), b.d.actividad, b.d.sistema, e?.codigo, e?.ahorrativo, e?.modelo, e?.familia].some((x) => x?.toLowerCase().includes(t));
      })
      .sort((a, b) => (b.puntaje(hoy) ?? -1) - (a.puntaje(hoy) ?? -1) || (b.d.numero ?? 0) - (a.d.numero ?? 0));
  }, [bkls.data, texto, estado, resp, prio, origen, eqPorId, hoy]);

  const totHh = filas.reduce((s, b) => s + b.hh(p), 0);
  const totCosto = filas.reduce((s, b) => s + b.costoUsd(), 0);
  const responsables = (perfiles.data ?? []).filter((x) => x.rol === 'responsable' || x.hhSemana > 0);

  if (bkls.isLoading) return <Cargando />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <h1 className="mr-auto text-xl font-bold text-slate-900">Backlog</h1>
        {puede('admin', 'planner') && <Link to="/bkl/nuevo" className="btn-pri">+ Nuevo BKL</Link>}
      </div>
      <Aviso error={bkls.error} />
      <div className="tarjeta flex flex-wrap gap-3">
        <div className="min-w-[220px] flex-1"><label className="etiqueta" htmlFor="buscar">Buscar</label><input id="buscar" className="campo" placeholder="BKL, equipo, ahorrativo, actividad…" value={texto} onChange={(e) => setTexto(e.target.value)} /></div>
        <div><label className="etiqueta" htmlFor="f-estado">Estado</label>
          <select id="f-estado" className="campo" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="ABIERTOS">Abiertos</option><option value="TODOS">Todos</option>
            {ESTADOS.map((x) => <option key={x}>{x}</option>)}
          </select></div>
        <div><label className="etiqueta" htmlFor="f-resp">Responsable</label>
          <select id="f-resp" className="campo" value={resp} onChange={(e) => setResp(e.target.value)}>
            <option value="">Todos</option>{responsables.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select></div>
        <div><label className="etiqueta" htmlFor="f-prio">Prioridad</label>
          <select id="f-prio" className="campo" value={prio} onChange={(e) => setPrio(e.target.value)}>
            <option value="">Todas</option><option>A</option><option>B</option><option>C</option>
          </select></div>
        <div><label className="etiqueta" htmlFor="f-origen">Origen</label>
          <select id="f-origen" className="campo" value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value="">Todos</option>{ORIGENES.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}<option value="SIN">Sin origen</option>
          </select></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="tarjeta"><div className="etiqueta">BKL</div><div className="text-2xl font-bold">{filas.length}</div></div>
        <div className="tarjeta"><div className="etiqueta">HH</div><div className="text-2xl font-bold">{horas(totHh)}</div></div>
        <div className="tarjeta"><div className="etiqueta">Costo USD</div><div className="text-2xl font-bold">{dinero(totCosto)}</div></div>
      </div>
      <div className="tarjeta overflow-x-auto p-0">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr><th className="px-3 py-2">BKL</th><th>Equipo</th><th>Actividad</th><th>Prio.</th><th>Responsable</th><th>Inicio</th><th>Estado</th><th>Situación</th><th>Repuestos</th><th className="text-right">HH</th><th className="text-right">Costo USD</th><th className="px-3 text-right">Puntaje</th></tr>
          </thead>
          <tbody>
            {filas.map((b) => {
              const e = eqPorId.get(b.d.equipoId);
              return (
                <tr key={b.d.numero} className="border-t border-slate-100 hover:bg-marca-50/50">
                  <td className="whitespace-nowrap px-3 py-2 font-semibold"><Link className="text-marca-600 hover:underline" to={`/bkl/${b.d.numero}`}>{b.numeroTexto()}</Link></td>
                  <td className="whitespace-nowrap">{e?.codigo}{e?.ahorrativo ? ` · ${e.ahorrativo}` : ''}<div className="text-xs text-slate-500">{e?.modelo}</div></td>
                  <td className="max-w-xs truncate" title={b.d.actividad}>{b.d.actividad}<div className="text-xs text-slate-500">{textoOrigen(b.d.origen)}</div></td>
                  <td><Insignia texto={b.d.prioridad} /></td>
                  <td className="whitespace-nowrap">{pPorId.get(b.d.responsableId ?? '')?.nombre ?? '—'}</td>
                  <td className="whitespace-nowrap">{fechaCorta(b.d.inicioProgramado)}</td>
                  <td><Insignia texto={b.estado()} /></td>
                  <td><Insignia texto={b.situacion(hoy)} /></td>
                  <td className="whitespace-nowrap text-xs">{b.estadoRepuestos()}</td>
                  <td className="text-right tabular-nums">{horas(b.hh(p))}</td>
                  <td className="text-right tabular-nums">{dinero(b.costoUsd())}</td>
                  <td className="px-3 text-right tabular-nums">{b.puntaje(hoy) ?? ''}</td>
                </tr>
              );
            })}
            {!filas.length && <tr><td colSpan={12} className="p-6 text-center text-slate-400">No hay BKL con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
