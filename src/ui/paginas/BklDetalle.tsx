import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fechaCorta } from '../../dominio/fechas';
import { textoOrigen } from '../../dominio/bkl';
import { PARAMETROS_DEF } from '../../dominio/parametros';
import { useAccion, useBkl, useEquipos, useEventos, useParametros, usePerfiles } from '../consultas';
import { useSesion } from '../contexto';
import { Aviso, Cargando } from '../componentes/Aviso';
import { Insignia } from '../componentes/Insignia';
import { TablaRepuestos } from '../componentes/TablaRepuestos';
import { dinero, horas } from '../formato';

const TEXTO_EVENTO: Record<string, string> = { creado: 'Creado', reprogramado: 'Reprogramado', inicio: 'Inicio real', fin: 'Fin real', cerrado: 'Cerrado', cancelado: 'Cancelado', reabierto: 'Reabierto', congelado: 'Congelado', sc: 'Solicitud de compra' };

export function BklDetalle() {
  const numero = Number(useParams().numero);
  const { servicio, hoy, puede } = useSesion();
  const q = useBkl(numero);
  const equipos = useEquipos();
  const perfiles = usePerfiles();
  const eventos = useEventos(numero);
  const p = useParametros().data ?? PARAMETROS_DEF;
  const [panel, setPanel] = useState<'' | 'reprog' | 'cerrar'>('');
  const [nueva, setNueva] = useState('');
  const [cierre, setCierre] = useState({ inicioReal: '', finReal: hoy, ejecutadoPor: '', hhReales: '' });

  const reprog = useAccion(() => servicio.reprogramar(numero, nueva));
  const cerrar = useAccion(() => servicio.cerrar(numero, { inicioReal: cierre.inicioReal || null, finReal: cierre.finReal || null, ejecutadoPor: cierre.ejecutadoPor, hhReales: cierre.hhReales === '' ? null : Number(cierre.hhReales) }));
  const cancelar = useAccion(() => servicio.cancelar(numero));
  const reabrir = useAccion(() => servicio.reabrir(numero));
  const error = reprog.error ?? cerrar.error ?? cancelar.error ?? reabrir.error;

  if (q.isLoading) return <Cargando />;
  const b = q.data;
  if (!b) return <Aviso error={q.error ?? 'No existe ese BKL.'} />;
  const d = b.d;
  const e = equipos.data?.find((x) => x.id === d.equipoId);
  const nombre = (id: string | null) => perfiles.data?.find((x) => x.id === id)?.nombre ?? '—';
  const editor = puede('admin', 'planner');
  const abierto = b.abierto() || b.estado() === 'EJECUTADO';
  const dato = (et: string, v: React.ReactNode) => <div><div className="etiqueta">{et}</div><div className="text-sm">{v || '—'}</div></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/backlog" className="text-sm text-marca-600 hover:underline">← Backlog</Link>
        <h1 className="text-xl font-bold">{b.numeroTexto()}</h1>
        <Insignia texto={d.prioridad} /><Insignia texto={b.estado()} /><Insignia texto={b.situacion(hoy)} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Link to={`/bkl/${numero}/imprimir`} className="btn">🖨 Hoja guía</Link>
          {editor && abierto && <Link to={`/bkl/${numero}/editar`} className="btn">Editar</Link>}
          {editor && b.abierto() && <button className="btn" onClick={() => { setNueva(d.inicioProgramado ?? hoy); setPanel(panel === 'reprog' ? '' : 'reprog'); }}>Reprogramar</button>}
          {editor && abierto && <button className="btn" onClick={() => { setCierre({ inicioReal: d.inicioReal ?? '', finReal: d.finReal ?? hoy, ejecutadoPor: d.ejecutadoPor ?? nombre(d.responsableId).replace('—', ''), hhReales: d.hhReales?.toString() ?? '' }); setPanel(panel === 'cerrar' ? '' : 'cerrar'); }}>Cerrar</button>}
          {editor && b.abierto() && <button className="btn-peligro" onClick={() => confirm(`¿Cancelar ${b.numeroTexto()}?`) && cancelar.mutate(undefined)}>Cancelar BKL</button>}
          {editor && !abierto && <button className="btn" onClick={() => reabrir.mutate(undefined)}>Reabrir</button>}
        </div>
      </div>
      <Aviso error={error} />

      {panel === 'reprog' && (
        <div className="tarjeta flex flex-wrap items-end gap-3">
          <div><label className="etiqueta" htmlFor="nueva">Nuevo inicio</label><input id="nueva" type="date" className="campo" value={nueva} onChange={(ev) => setNueva(ev.target.value)} /></div>
          <button className="btn-pri" onClick={() => reprog.mutate(undefined, { onSuccess: () => setPanel('') })}>Guardar</button>
          <span className="text-xs text-slate-500">El inicio original ({fechaCorta(d.inicioOriginal)}) no cambia; la reprogramación queda en el historial.</span>
        </div>
      )}
      {panel === 'cerrar' && (
        <div className="tarjeta grid gap-3 md:grid-cols-5">
          <div><label className="etiqueta" htmlFor="ini-real">Inicio real</label><input id="ini-real" type="date" className="campo" value={cierre.inicioReal} onChange={(ev) => setCierre({ ...cierre, inicioReal: ev.target.value })} /></div>
          <div><label className="etiqueta" htmlFor="fin-real">Fin real</label><input id="fin-real" type="date" className="campo" value={cierre.finReal} onChange={(ev) => setCierre({ ...cierre, finReal: ev.target.value })} /></div>
          <div><label className="etiqueta" htmlFor="ejec">Ejecutado por</label><input id="ejec" className="campo" value={cierre.ejecutadoPor} onChange={(ev) => setCierre({ ...cierre, ejecutadoPor: ev.target.value })} /></div>
          <div><label className="etiqueta" htmlFor="hh-reales">HH reales</label><input id="hh-reales" className="campo" inputMode="decimal" value={cierre.hhReales} onChange={(ev) => setCierre({ ...cierre, hhReales: ev.target.value })} /></div>
          <div className="flex items-end"><button className="btn-pri" onClick={() => cerrar.mutate(undefined, { onSuccess: () => setPanel('') })}>Cerrar BKL</button></div>
        </div>
      )}

      <section className="tarjeta grid gap-4 md:grid-cols-4">
        <div className="md:col-span-4"><div className="etiqueta">Actividad</div><div className="text-lg font-semibold">{d.actividad}</div></div>
        {dato('Equipo', e && `${e.codigo}${e.ahorrativo ? ' · ' + e.ahorrativo : ''} — ${e.familia} ${e.marca} ${e.modelo}`)}
        {dato('Ubicación', e?.ubicacion)}
        {dato('Origen', [textoOrigen(d.origen), d.origenRef].filter(Boolean).join(' · '))}
        {dato('Sistema', d.sistema)}
        {dato('No. OT', d.noOt)}
        {dato('Responsable', nombre(d.responsableId))}
        {dato('Planner', nombre(d.plannerId))}
        {dato('Técnicos', d.tecnicos)}
        {dato('Horómetro', d.horometro)}
        {dato('Ingreso', `${fechaCorta(d.fechaIngreso)} · ${b.diasAbierto(hoy)} días`)}
        {dato('Inicio programado', `${fechaCorta(d.inicioProgramado)} → ${fechaCorta(b.finProgramado())}`)}
        {dato('Inicio original', `${fechaCorta(d.inicioOriginal)}${d.reprogramaciones ? ` · ${d.reprogramaciones} reprog.` : ''}`)}
        {dato('HH estimadas', `${horas(b.hh(p))} · ${d.diasEstimados} día(s)`)}
        {dato('Real', d.finReal ? `${fechaCorta(d.inicioReal)} → ${fechaCorta(d.finReal)} · ${d.hhReales ?? '—'} HH · ${d.ejecutadoPor ?? ''}` : d.inicioReal ? `Iniciado ${fechaCorta(d.inicioReal)}` : '')}
        {dato('Costo', `USD ${dinero(b.costoUsd())} · C$ ${dinero(b.costoUsd() * p.tipoCambio)}`)}
        {dato('Repuestos', b.estadoRepuestos())}
        {dato('Puntaje', b.puntaje(hoy))}
        {d.observaciones && <div className="md:col-span-4">{dato('Observaciones', d.observaciones)}</div>}
      </section>

      <section className="tarjeta">
        <h2 className="mb-2 font-semibold">Tareas</h2>
        {d.tareas.length ? <ol className="list-decimal space-y-1 pl-6 text-sm">{d.tareas.map((t) => <li key={t.orden}>{t.descripcion}</li>)}</ol> : <p className="text-sm text-slate-400">Sin tareas</p>}
      </section>
      <section className="tarjeta"><h2 className="mb-2 font-semibold">Repuestos</h2><TablaRepuestos valor={d.repuestos} tareas={d.tareas.map((t) => t.orden)} /></section>
      <section className="tarjeta">
        <h2 className="mb-2 font-semibold">Historial</h2>
        <ul className="space-y-1 text-sm">
          {(eventos.data ?? []).map((ev, i) => (
            <li key={i} className="flex gap-3"><span className="w-48 shrink-0 text-slate-500">{new Date(ev.fecha).toLocaleString('es-NI')}</span><b>{TEXTO_EVENTO[ev.tipo] ?? ev.tipo}</b>
              <span className="text-slate-600">{ev.tipo === 'reprogramado' ? `${fechaCorta(String(ev.detalle.de))} → ${fechaCorta(String(ev.detalle.a))}` : ''}</span>
              <span className="text-slate-400">{ev.usuario ?? ''}</span></li>
          ))}
          {!eventos.data?.length && <li className="text-slate-400">Sin eventos</li>}
        </ul>
      </section>
    </div>
  );
}
