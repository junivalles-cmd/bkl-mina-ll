-- Cálculos del BKL: mismas reglas que src/dominio/bkl.ts (prueba cruzada en tests/sql).
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
