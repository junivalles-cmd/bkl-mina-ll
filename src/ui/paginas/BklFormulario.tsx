import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bkl, ORIGENES, type BklDatos, type OrigenBkl, type Prioridad, type Tarea } from '../../dominio/bkl';
import { fechaCorta, sumarDias } from '../../dominio/fechas';
import { PARAMETROS_DEF } from '../../dominio/parametros';
import type { RepuestoDatos } from '../../dominio/repuesto';
import { buscarEquipo } from '../../servicios/bklServicio';
import { useAccion, useBkl, useEquipos, useParametros, usePerfiles } from '../consultas';
import { useSesion } from '../contexto';
import { Aviso, Cargando } from '../componentes/Aviso';
import { EditorTareas } from '../componentes/EditorTareas';
import { TablaRepuestos } from '../componentes/TablaRepuestos';
import { horas } from '../formato';

interface Form {
  equipo: string; actividad: string; sistema: string; prioridad: Prioridad; origen: OrigenBkl | ''; origenRef: string; responsableId: string; plannerId: string;
  hhEstimadas: string; diasEstimados: string; tecnicos: string; fechaIngreso: string; inicioProgramado: string;
  noOt: string; horometro: string; observaciones: string; esperaRepuestos: boolean; tareas: Tarea[]; repuestos: RepuestoDatos[];
}

const n = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export function BklFormulario() {
  const { numero } = useParams();
  const editando = numero !== undefined;
  const existente = useBkl(Number(numero ?? 0));
  const { servicio, hoy, perfil } = useSesion();
  const equipos = useEquipos();
  const perfiles = usePerfiles();
  const p = useParametros().data ?? PARAMETROS_DEF;
  const ir = useNavigate();

  const [f, setF] = useState<Form>(() => ({
    equipo: '', actividad: '', sistema: '', prioridad: 'B', origen: '', origenRef: '', responsableId: '', plannerId: perfil?.id ?? '', hhEstimadas: '', diasEstimados: String(p.diasEstimadosDef),
    tecnicos: '', fechaIngreso: hoy, inicioProgramado: sumarDias(hoy, p.diasParaIniciar), noOt: '', horometro: '', observaciones: '', esperaRepuestos: false, tareas: [], repuestos: [],
  }));

  useEffect(() => {
    const b = existente.data;
    if (!editando || !b || !equipos.data) return;
    const e = equipos.data.find((x) => x.id === b.d.equipoId);
    const d = b.d;
    setF({
      equipo: e?.codigo ?? '', actividad: d.actividad, sistema: d.sistema, prioridad: d.prioridad, origen: d.origen ?? '', origenRef: d.origenRef ?? '', responsableId: d.responsableId ?? '', plannerId: d.plannerId ?? '',
      hhEstimadas: d.hhEstimadas?.toString() ?? '', diasEstimados: String(d.diasEstimados), tecnicos: d.tecnicos ?? '', fechaIngreso: d.fechaIngreso,
      inicioProgramado: d.inicioProgramado ?? '', noOt: d.noOt ?? '', horometro: d.horometro?.toString() ?? '', observaciones: d.observaciones ?? '',
      esperaRepuestos: d.estadoManual === 'pendiente_repuestos', tareas: d.tareas, repuestos: d.repuestos,
    });
  }, [editando, existente.data, equipos.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const equipo = useMemo(() => buscarEquipo(equipos.data ?? [], f.equipo), [equipos.data, f.equipo]);

  const datos = (): Partial<BklDatos> => ({
    actividad: f.actividad.trim(), sistema: f.sistema.trim(), prioridad: f.prioridad, origen: f.origen || null, origenRef: f.origenRef.trim() || null, responsableId: f.responsableId || null, plannerId: f.plannerId || null,
    hhEstimadas: n(f.hhEstimadas), diasEstimados: n(f.diasEstimados) ?? p.diasEstimadosDef, tecnicos: f.tecnicos.trim() || null, fechaIngreso: f.fechaIngreso,
    inicioProgramado: f.inicioProgramado || null, noOt: f.noOt.trim() || null, horometro: n(f.horometro), observaciones: f.observaciones.trim() || null,
    tareas: f.tareas.filter((t) => t.descripcion.trim()).map((t, i) => ({ ...t, orden: i + 1, descripcion: t.descripcion.trim() })), repuestos: f.repuestos,
  });

  const vista = useMemo(() => {
    if (!equipo) return null;
    try { return new Bkl({ ...Bkl.nuevo({ equipoId: equipo.id, actividad: 'x', prioridad: f.prioridad }, p, hoy).datos(), ...datos(), estadoManual: f.esperaRepuestos ? 'pendiente_repuestos' : null }); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, equipo, p, hoy]);

  const guardar = useAccion(async () => {
    const d = datos();
    if (!equipo) throw new Error(`No se encontró el equipo "${f.equipo}".`);
    if (editando) {
      const actual = existente.data!;
      const manual = actual.d.estadoManual === 'cerrado' || actual.d.estadoManual === 'cancelado' ? actual.d.estadoManual : f.esperaRepuestos ? 'pendiente_repuestos' : null;
      await servicio.actualizar(Number(numero), { ...d, equipoId: equipo.id, estadoManual: manual });
      return Number(numero);
    }
    return servicio.crear({ ...(d as Required<typeof d>), equipo: f.equipo, actividad: d.actividad ?? '', prioridad: f.prioridad, estadoManual: f.esperaRepuestos ? 'pendiente_repuestos' : null, tareas: d.tareas ?? [], repuestos: d.repuestos ?? [] });
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    guardar.mutate(undefined, { onSuccess: (num) => ir(`/bkl/${num}`) });
  };

  if (editando && existente.isLoading) return <Cargando />;
  if (editando && !existente.data) return <Aviso error="No existe ese BKL." />;
  const responsables = (perfiles.data ?? []).filter((x) => x.activo && (x.rol === 'responsable' || x.rol === 'supervisor'));
  const planners = (perfiles.data ?? []).filter((x) => x.activo && (x.rol === 'planner' || x.rol === 'admin'));

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold">{editando ? `Editar ${existente.data!.numeroTexto()}` : 'Nuevo BKL'}</h1>
        <button type="button" className="btn" onClick={() => ir(-1)}>Cancelar</button>
        <button className="btn-pri" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : 'Guardar BKL'}</button>
      </div>
      <Aviso error={guardar.error} />

      <section className="tarjeta grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="etiqueta" htmlFor="equipo">Equipo (código o ahorrativo)</label>
          <input id="equipo" list="lista-equipos" className="campo" value={f.equipo} onChange={(e) => set('equipo', e.target.value)} required />
          <datalist id="lista-equipos">{(equipos.data ?? []).map((e) => <option key={e.id} value={e.codigo}>{e.ahorrativo} · {e.familia} {e.modelo}</option>)}</datalist>
          <div className={`mt-1 text-xs ${equipo ? 'text-slate-600' : f.equipo ? 'text-red-600' : 'text-slate-400'}`}>
            {equipo ? `${equipo.codigo}${equipo.ahorrativo ? ' · ' + equipo.ahorrativo : ''} — ${equipo.familia} · ${equipo.marca} ${equipo.modelo} · ${equipo.ubicacion}` : f.equipo ? 'Equipo no encontrado' : 'Escribe 15-59, 1559 o R01'}
          </div>
        </div>
        <div className="md:col-span-3"><label className="etiqueta" htmlFor="actividad">Actividad</label><input id="actividad" className="campo" value={f.actividad} onChange={(e) => set('actividad', e.target.value)} required /></div>
        <div><label className="etiqueta" htmlFor="prioridad">Prioridad</label>
          <select id="prioridad" className="campo" value={f.prioridad} onChange={(e) => set('prioridad', e.target.value as Prioridad)}>
            <option value="A">A – Crítica</option><option value="B">B – Alta</option><option value="C">C – Programable</option>
          </select></div>
        <div className="md:col-span-2"><label className="etiqueta" htmlFor="origen">Origen del BKL</label>
          <select id="origen" className="campo" value={f.origen} onChange={(e) => set('origen', e.target.value as OrigenBkl | '')} required>
            <option value="">— ¿De dónde salió? —</option>{ORIGENES.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
          </select></div>
        <div className="md:col-span-2"><label className="etiqueta" htmlFor="origen-ref">No. de inspección / informe / check list</label>
          <input id="origen-ref" className="campo" placeholder="Ej. INSP-0457, IF-012, CK 13/11" value={f.origenRef} onChange={(e) => set('origenRef', e.target.value)} /></div>
        <div className="md:col-span-2" />
        <div className="md:col-span-2"><label className="etiqueta" htmlFor="sistema">Sistema / componente</label><input id="sistema" className="campo" value={f.sistema} onChange={(e) => set('sistema', e.target.value)} /></div>
        <div><label className="etiqueta" htmlFor="resp">Responsable</label>
          <select id="resp" className="campo" value={f.responsableId} onChange={(e) => set('responsableId', e.target.value)}>
            <option value="">—</option>{responsables.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select></div>
        <div><label className="etiqueta" htmlFor="planner">Planner</label>
          <select id="planner" className="campo" value={f.plannerId} onChange={(e) => set('plannerId', e.target.value)}>
            <option value="">—</option>{planners.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
          </select></div>
        <div><label className="etiqueta" htmlFor="ot">No. OT</label><input id="ot" className="campo" value={f.noOt} onChange={(e) => set('noOt', e.target.value)} /></div>
        <div><label className="etiqueta" htmlFor="horo">Horómetro</label><input id="horo" className="campo" inputMode="decimal" value={f.horometro} onChange={(e) => set('horometro', e.target.value)} /></div>
        <div><label className="etiqueta" htmlFor="hh">HH estimadas</label><input id="hh" className="campo" inputMode="decimal" placeholder={`${horas((n(f.diasEstimados) ?? 1) * p.hhPorDia)} (días × ${p.hhPorDia})`} value={f.hhEstimadas} onChange={(e) => set('hhEstimadas', e.target.value)} /></div>
        <div><label className="etiqueta" htmlFor="dias">Días estimados</label><input id="dias" className="campo" inputMode="decimal" value={f.diasEstimados} onChange={(e) => set('diasEstimados', e.target.value)} /></div>
        <div><label className="etiqueta" htmlFor="ingreso">Fecha ingreso</label><input id="ingreso" type="date" className="campo" value={f.fechaIngreso} onChange={(e) => set('fechaIngreso', e.target.value)} required /></div>
        <div><label className="etiqueta" htmlFor="inicio">Inicio programado</label><input id="inicio" type="date" className="campo" value={f.inicioProgramado} onChange={(e) => set('inicioProgramado', e.target.value)} />
          <div className="mt-1 text-xs text-slate-500">{vista?.finProgramado() ? `Fin ${fechaCorta(vista.finProgramado())}` : 'Sin programar'}</div></div>
        <div className="md:col-span-2"><label className="etiqueta" htmlFor="tecnicos">Técnicos</label><input id="tecnicos" className="campo" value={f.tecnicos} onChange={(e) => set('tecnicos', e.target.value)} /></div>
        <div className="md:col-span-2 flex items-end"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.esperaRepuestos} onChange={(e) => set('esperaRepuestos', e.target.checked)} /> Marcar en espera de repuestos</label></div>
        <div className="md:col-span-2 flex items-end gap-2 text-sm">{vista && <>Estado al guardar: <b>{vista.estado()}</b></>}</div>
        <div className="md:col-span-6"><label className="etiqueta" htmlFor="obs">Observaciones</label><textarea id="obs" className="campo" rows={2} value={f.observaciones} onChange={(e) => set('observaciones', e.target.value)} /></div>
      </section>

      <section className="tarjeta"><h2 className="mb-2 font-semibold">Tareas</h2><EditorTareas valor={f.tareas} onCambio={(t) => set('tareas', t)} /></section>
      <section className="tarjeta"><h2 className="mb-2 font-semibold">Repuestos</h2>
        <TablaRepuestos valor={f.repuestos} onCambio={(r) => set('repuestos', r)} tareas={f.tareas.map((t) => t.orden)} editable tipoCambio={p.tipoCambio} />
        {vista && <div className="mt-2 text-sm text-slate-600">Repuestos: <b>{vista.estadoRepuestos()}</b>{vista.porPedir() > 0 && ' — no se programa hasta que estén completos.'}</div>}
      </section>
    </form>
  );
}
