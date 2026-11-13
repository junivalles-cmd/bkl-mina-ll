-- 0004 · Origen del BKL (inspección, reporte de falla, check list…) y referencia del documento de origen.
create type public.origen_bkl as enum ('inspeccion','reporte_falla','checklist','pm','predictivo','operador','otro');
alter table public.bkl add column origen public.origen_bkl, add column origen_ref text;

create or replace function public.guardar_bkl(d jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_num integer;
begin
  if nullif(d->>'id', '') is null then
    insert into bkl (numero, equipo_id, actividad, sistema, prioridad, origen, origen_ref, responsable_id, planner_id, hh_estimadas,
      dias_estimados, tecnicos, fecha_ingreso, inicio_programado, inicio_original, inicio_real, fin_real, hh_reales,
      ejecutado_por, horometro, no_ot, observaciones, estado_manual)
    values (coalesce((d->>'numero')::int, nextval('bkl_numero_seq')::int), (d->>'equipo_id')::uuid, d->>'actividad',
      coalesce(d->>'sistema', ''), (d->>'prioridad')::prioridad, nullif(d->>'origen', '')::origen_bkl,
      nullif(btrim(d->>'origen_ref'), ''), nullif(d->>'responsable_id', '')::uuid,
      nullif(d->>'planner_id', '')::uuid, (d->>'hh_estimadas')::numeric, coalesce((d->>'dias_estimados')::numeric, 1),
      d->>'tecnicos', coalesce((d->>'fecha_ingreso')::date, hoy()), (d->>'inicio_programado')::date,
      coalesce((d->>'inicio_original')::date, (d->>'inicio_programado')::date), (d->>'inicio_real')::date,
      (d->>'fin_real')::date, (d->>'hh_reales')::numeric, d->>'ejecutado_por', (d->>'horometro')::numeric,
      d->>'no_ot', d->>'observaciones', nullif(d->>'estado_manual', '')::estado_manual)
    returning id, numero into v_id, v_num;
    if d ? 'numero' and d->>'numero' is not null then
      perform setval('bkl_numero_seq', greatest((select max(numero) from bkl), 1));
    end if;
  else
    update bkl set equipo_id = (d->>'equipo_id')::uuid, actividad = d->>'actividad', sistema = coalesce(d->>'sistema', ''),
      prioridad = (d->>'prioridad')::prioridad, origen = nullif(d->>'origen', '')::origen_bkl,
      origen_ref = nullif(btrim(d->>'origen_ref'), ''), responsable_id = nullif(d->>'responsable_id', '')::uuid,
      planner_id = nullif(d->>'planner_id', '')::uuid, hh_estimadas = (d->>'hh_estimadas')::numeric,
      dias_estimados = coalesce((d->>'dias_estimados')::numeric, 1), tecnicos = d->>'tecnicos',
      fecha_ingreso = (d->>'fecha_ingreso')::date, inicio_programado = (d->>'inicio_programado')::date,
      inicio_original = coalesce((d->>'inicio_original')::date, inicio_original), inicio_real = (d->>'inicio_real')::date,
      fin_real = (d->>'fin_real')::date, hh_reales = (d->>'hh_reales')::numeric, ejecutado_por = d->>'ejecutado_por',
      horometro = (d->>'horometro')::numeric, no_ot = d->>'no_ot', observaciones = d->>'observaciones',
      estado_manual = nullif(d->>'estado_manual', '')::estado_manual
    where id = (d->>'id')::uuid
    returning id, numero into v_id, v_num;
    if v_id is null then raise exception 'BKL no encontrado'; end if;
  end if;

  delete from bkl_tarea where bkl_id = v_id;
  insert into bkl_tarea (bkl_id, orden, descripcion, hecha, observacion)
  select v_id, (t->>'orden')::int, t->>'descripcion', coalesce((t->>'hecha')::boolean, false), t->>'observacion'
  from jsonb_array_elements(coalesce(d->'tareas', '[]'::jsonb)) t;

  delete from bkl_repuesto where bkl_id = v_id;
  insert into bkl_repuesto (bkl_id, orden, tarea_orden, codigo_gp, numero_parte, descripcion, cantidad, almacen,
    ubicacion, precio_usd, stock, solicitud_id, kit_listo)
  select v_id, x.n::int, (x.r->>'tarea_orden')::int, coalesce(x.r->>'codigo_gp', ''), coalesce(x.r->>'numero_parte', ''),
    coalesce(x.r->>'descripcion', ''), (x.r->>'cantidad')::numeric, coalesce(x.r->>'almacen', ''),
    coalesce(x.r->>'ubicacion', ''), coalesce((x.r->>'precio_usd')::numeric, 0), coalesce(x.r->>'stock', 'disponible')::stock_rep,
    nullif(x.r->>'solicitud_id', '')::uuid, coalesce((x.r->>'kit_listo')::boolean, false)
  from jsonb_array_elements(coalesce(d->'repuestos', '[]'::jsonb)) with ordinality as x(r, n);

  return v_num;
end $$;

-- La vista se recrea para incluir las columnas nuevas (b.* se fija al crearla).
drop view if exists public.v_bkl;
create or replace view public.v_bkl with (security_invoker = true) as
with p as (
  select coalesce(max(valor) filter (where clave = 'hh_por_dia'), 8) as hh_dia,
         coalesce(max(valor) filter (where clave = 'tipo_cambio'), 36.62) as tc
  from public.parametro
),
r as (
  select rr.bkl_id,
         count(*) as n,
         sum(rr.cantidad * rr.precio_usd) as costo,
         count(*) filter (where rr.stock = 'pedir' and (sc.id is null or sc.estado = 'cancelada')) as por_pedir,
         count(*) filter (where rr.stock = 'pedir' and sc.id is not null and sc.estado not in ('cancelada','recibida')) as en_sc
  from public.bkl_repuesto rr
  left join public.solicitud_compra sc on sc.id = rr.solicitud_id
  group by rr.bkl_id
),
base as (
  select b.*,
         e.codigo as equipo_codigo, e.ahorrativo as equipo_ahorrativo, e.familia as equipo_familia,
         e.marca as equipo_marca, e.modelo as equipo_modelo, e.ubicacion as equipo_ubicacion,
         coalesce(r.n, 0)::int as n_repuestos,
         round(coalesce(r.costo, 0), 2) as costo_usd,
         coalesce(r.por_pedir, 0)::int as por_pedir,
         coalesce(r.en_sc, 0)::int as en_sc,
         greatest(1, b.dias_estimados) as dias_ef,
         public.hoy() as hoy,
         p.hh_dia, p.tc
  from public.bkl b
  join public.equipo e on e.id = b.equipo_id
  left join r on r.bkl_id = b.id
  cross join p
),
c1 as (
  select base.*,
    case when numero > 999 then 'BKL-' || numero else 'BKL-' || lpad(numero::text, 3, '0') end as numero_texto,
    case
      when estado_manual = 'cancelado' then 'CANCELADO'
      when estado_manual = 'cerrado' then 'CERRADO'
      when fin_real is not null then 'EJECUTADO'
      when inicio_real is not null then 'EN EJECUCIÓN'
      when por_pedir > 0 or en_sc > 0 or estado_manual = 'pendiente_repuestos' then 'PENDIENTE REPUESTOS'
      when inicio_programado is not null then 'PROGRAMADO'
      else 'LISTO PARA PROGRAMAR'
    end as estado,
    case
      when por_pedir > 0 then 'FALTA PEDIR ' || por_pedir
      when en_sc > 0 then 'EN ESPERA: ' || en_sc || ' EN SC'
      when n_repuestos = 0 then 'SIN REPUESTOS'
      else 'COMPLETOS'
    end as estado_repuestos,
    inicio_programado + floor(dias_ef - 1)::int as fin_programado,
    coalesce(hh_estimadas, dias_ef * hh_dia) as hh,
    coalesce(fin_real, hoy) - fecha_ingreso as dias_abierto,
    extract(isoyear from inicio_programado)::int as anio,
    extract(week from inicio_programado)::int as semana,
    extract(month from inicio_programado)::int as mes
  from base
)
select c1.*,
  case
    when estado = 'CANCELADO' then 'CANCELADO'
    when fin_real is not null and fin_real > coalesce(inicio_original, inicio_programado) + floor(dias_ef - 1)::int then 'EJECUTADO CON RETRASO'
    when fin_real is not null then 'EJECUTADO'
    when fin_programado < hoy and estado = 'PENDIENTE REPUESTOS' then 'RETRASADO – REPUESTOS'
    when fin_programado < hoy then 'RETRASADO'
    when estado = 'EN EJECUCIÓN' then 'EN EJECUCIÓN'
    when estado = 'PENDIENTE REPUESTOS' then 'ESPERA REPUESTOS'
    else 'PENDIENTE'
  end as situacion,
  case when estado in ('EJECUTADO','CERRADO','CANCELADO') then null
    else (case prioridad when 'A' then 50 when 'B' then 30 else 10 end)
         + least(60, greatest(0, hoy - fecha_ingreso))::numeric / 2
         + case when estado = 'PENDIENTE REPUESTOS' then -10 else 10 end
  end as puntaje,
  round(costo_usd * tc, 2) as costo_cs,
  exists (select 1 from public.semana_item si join public.semana_congelada sc on sc.id = si.semana_id
          where si.bkl_id = c1.id and sc.anio = c1.anio and sc.semana = c1.semana) as congelado
from c1;

grant select on public.v_bkl to authenticated;
