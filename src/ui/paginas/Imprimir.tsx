import { Link, useParams } from 'react-router-dom';
import { fechaCorta } from '../../dominio/fechas';
import { PARAMETROS_DEF } from '../../dominio/parametros';
import { Repuesto } from '../../dominio/repuesto';
import { useBkl, useEquipos, useParametros, usePerfiles } from '../consultas';
import { Cargando } from '../componentes/Aviso';
import { dinero, horas } from '../formato';

/** Hoja guía del BKL para el responsable (A4 vertical). Se imprime o guarda como PDF desde el navegador. */
export function Imprimir() {
  const numero = Number(useParams().numero);
  const q = useBkl(numero);
  const equipos = useEquipos();
  const perfiles = usePerfiles();
  const p = useParametros().data ?? PARAMETROS_DEF;
  if (q.isLoading || !q.data) return <Cargando />;
  const b = q.data;
  const d = b.d;
  const e = equipos.data?.find((x) => x.id === d.equipoId);
  const nombre = (id: string | null) => perfiles.data?.find((x) => x.id === id)?.nombre ?? '';
  const c = 'border border-slate-400 px-1.5 py-1';
  const et = 'bg-slate-100 text-[10px] font-bold uppercase text-slate-600';

  return (
    <div className="bg-slate-200 py-4 print:bg-white print:py-0">
      <style>{'@page { size: A4 portrait; margin: 10mm; }'}</style>
      <div className="no-imprimir mx-auto mb-3 flex max-w-[210mm] gap-2">
        <Link to={`/bkl/${numero}`} className="btn">← Volver</Link>
        <button className="btn-pri" onClick={() => window.print()}>Imprimir / guardar PDF</button>
      </div>
      <div className="mx-auto max-w-[210mm] bg-white p-[8mm] text-[11px] leading-tight text-slate-900 shadow print:max-w-none print:p-0 print:shadow-none">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={c + ' w-1/4 font-bold'}>CONEQUISA<br /><span className="font-normal">Mantenimiento Open Pit</span></td>
              <td className={c + ' text-center text-base font-bold'}>BKL – HOJA GUÍA DE TRABAJO<br /><span className="text-[11px] font-normal">Mina La Libertad</span></td>
              <td className={c + ' w-1/4 text-center'}><div className="text-[10px] text-slate-500">No. BKL</div><div className="text-xl font-bold">{b.numeroTexto()}</div></td>
            </tr>
          </tbody>
        </table>
        <table className="mt-2 w-full border-collapse">
          <tbody>
            <tr><td className={c + ' ' + et}>Equipo</td><td className={c}>{e?.codigo}{e?.ahorrativo ? ` · ${e.ahorrativo}` : ''}</td><td className={c + ' ' + et}>Familia / modelo</td><td className={c}>{e?.familia} · {e?.marca} {e?.modelo}</td><td className={c + ' ' + et}>Ubicación</td><td className={c}>{e?.ubicacion}</td></tr>
            <tr><td className={c + ' ' + et}>Prioridad</td><td className={c}>{d.prioridad}</td><td className={c + ' ' + et}>Responsable</td><td className={c}>{nombre(d.responsableId)}</td><td className={c + ' ' + et}>No. OT</td><td className={c}>{d.noOt}</td></tr>
            <tr><td className={c + ' ' + et}>Inicio prog.</td><td className={c}>{fechaCorta(d.inicioProgramado)}</td><td className={c + ' ' + et}>Fin prog.</td><td className={c}>{fechaCorta(b.finProgramado())}</td><td className={c + ' ' + et}>HH estimadas</td><td className={c}>{horas(b.hh(p))}</td></tr>
            <tr><td className={c + ' ' + et}>Sistema</td><td className={c} colSpan={3}>{d.sistema}</td><td className={c + ' ' + et}>Horómetro</td><td className={c}>{d.horometro ?? ''}</td></tr>
            <tr><td className={c + ' ' + et}>Actividad</td><td className={c + ' font-semibold'} colSpan={5}>{d.actividad}</td></tr>
          </tbody>
        </table>

        <div className="mt-3 font-bold">TAREAS</div>
        <table className="w-full border-collapse">
          <thead><tr className={et}><th className={c + ' w-8'}>#</th><th className={c + ' text-left'}>Descripción</th><th className={c + ' w-12'}>Hecho</th><th className={c + ' w-1/4 text-left'}>Observación</th></tr></thead>
          <tbody>
            {(d.tareas.length ? d.tareas : [{ orden: 1, descripcion: '', hecha: false }]).map((t) => (
              <tr key={t.orden}><td className={c + ' text-center'}>{t.orden}</td><td className={c}>{t.descripcion}</td><td className={c + ' text-center'}>☐</td><td className={c} /></tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 font-bold">REPUESTOS</div>
        <table className="w-full border-collapse">
          <thead><tr className={et}><th className={c}>Tarea</th><th className={c}>Cód. GP</th><th className={c}>No. parte</th><th className={c + ' text-left'}>Descripción</th><th className={c}>Cant.</th><th className={c}>Almacén / ubic.</th><th className={c + ' text-right'}>P. Und USD</th><th className={c + ' text-right'}>Total USD</th></tr></thead>
          <tbody>
            {d.repuestos.map((r, i) => (
              <tr key={i}><td className={c + ' text-center'}>{r.tareaOrden ?? ''}</td><td className={c}>{r.codigoGp}</td><td className={c}>{r.numeroParte}</td><td className={c}>{r.descripcion}</td><td className={c + ' text-center'}>{r.cantidad}</td><td className={c}>{r.almacen}{r.ubicacion ? ` · ${r.ubicacion}` : ''}</td><td className={c + ' text-right'}>{dinero(r.precioUsd)}</td><td className={c + ' text-right'}>{dinero(new Repuesto(r).total())}</td></tr>
            ))}
            {!d.repuestos.length && <tr><td className={c + ' text-center text-slate-400'} colSpan={8}>Sin repuestos</td></tr>}
            <tr><td className={c + ' text-right font-bold'} colSpan={7}>TOTAL USD</td><td className={c + ' text-right font-bold'}>{dinero(b.costoUsd())}</td></tr>
          </tbody>
        </table>

        <div className="mt-3 font-bold">CIERRE (lo llena el responsable)</div>
        <table className="w-full border-collapse">
          <tbody>
            <tr><td className={c + ' ' + et + ' w-1/6'}>Inicio real</td><td className={c + ' h-7'}>{fechaCorta(d.inicioReal)}</td><td className={c + ' ' + et + ' w-1/6'}>Fin real</td><td className={c}>{fechaCorta(d.finReal)}</td><td className={c + ' ' + et + ' w-1/6'}>HH reales</td><td className={c}>{d.hhReales ?? ''}</td></tr>
            <tr><td className={c + ' ' + et}>Ejecutado por</td><td className={c + ' h-7'} colSpan={5}>{d.ejecutadoPor ?? ''}</td></tr>
            <tr><td className={c + ' ' + et}>Observaciones</td><td className={c + ' h-16'} colSpan={5} /></tr>
          </tbody>
        </table>
        <table className="mt-8 w-full">
          <tbody><tr>{['Responsable', 'Supervisor', 'Planner'].map((x) => <td key={x} className="px-4 text-center"><div className="border-t border-slate-500 pt-1">{x}</div></td>)}</tr></tbody>
        </table>
      </div>
    </div>
  );
}
