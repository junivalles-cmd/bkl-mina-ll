-- BKL Mina La Libertad · esquema base
-- Fecha "de hoy" en Managua (las pruebas la fijan con: set app.hoy = 'YYYY-MM-DD').
create or replace function public.hoy() returns date
language sql stable as $$
  select coalesce(nullif(current_setting('app.hoy', true), '')::date,
                  (now() at time zone 'America/Managua')::date)
$$;

create type public.rol_usuario as enum ('admin','planner','responsable','supervisor','almacen','compras','jefatura');
create type public.prioridad as enum ('A','B','C');
create type public.estado_manual as enum ('pendiente_repuestos','cerrado','cancelado');
create type public.stock_rep as enum ('disponible','pedir');
create type public.estado_sc as enum ('solicitada','cotizada','aprobada','oc_emitida','en_transito','recibida','cancelada');
create type public.prioridad_sc as enum ('emergencia','critica','normal');
create type public.tipo_evento as enum ('creado','reprogramado','congelado','inicio','fin','cerrado','cancelado','reabierto','sc');

create or replace function public.tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create table public.perfil (
  id uuid primary key references auth.users(id) on delete cascade,
  usuario text not null unique,
  nombre text not null,
  correo text,
  rol public.rol_usuario not null default 'responsable',
  hh_semana numeric(6,1) not null default 0 check (hh_semana >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (btrim(codigo) <> ''),
  ahorrativo text unique,
  familia text not null default '',
  marca text not null default '',
  modelo text not null default '',
  serie text,
  ubicacion text not null default '',
  criticidad public.prioridad,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parametro (
  clave text primary key,
  valor numeric not null,
  descripcion text not null default ''
);
insert into public.parametro (clave, valor, descripcion) values
  ('tipo_cambio', 36.62, 'Tipo de cambio C$ por USD'),
  ('factor_tiempo_efectivo', 0.5, 'Fracción de las HH semanales disponible para BKL'),
  ('dias_para_iniciar', 6, 'Días desde el ingreso hasta el inicio programado por defecto'),
  ('dias_estimados_def', 1, 'Días estimados por defecto'),
  ('hh_por_dia', 8, 'HH por día cuando no se estiman HH');

create sequence public.bkl_numero_seq;
create sequence public.sc_numero_seq;

create table public.bkl (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique default nextval('public.bkl_numero_seq') check (numero > 0),
  equipo_id uuid not null references public.equipo(id),
  actividad text not null check (btrim(actividad) <> ''),
  sistema text not null default '',
  prioridad public.prioridad not null,
  responsable_id uuid references public.perfil(id),
  planner_id uuid references public.perfil(id),
  hh_estimadas numeric(8,1) check (hh_estimadas >= 0),
  dias_estimados numeric(5,1) not null default 1 check (dias_estimados >= 0),
  tecnicos integer check (tecnicos >= 0),
  fecha_ingreso date not null default public.hoy(),
  inicio_programado date,
  inicio_original date,
  inicio_real date,
  fin_real date,
  hh_reales numeric(8,1) check (hh_reales >= 0),
  ejecutado_por text,
  horometro numeric(10,1),
  no_ot text,
  observaciones text,
  estado_manual public.estado_manual,
  reprogramaciones integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bkl_cierre_completo check (estado_manual is distinct from 'cerrado'
    or (fin_real is not null and coalesce(btrim(ejecutado_por), '') <> '' and hh_reales is not null)),
  constraint bkl_fechas_reales check (fin_real is null or inicio_real is null or fin_real >= inicio_real)
);
create index on public.bkl (equipo_id);
create index on public.bkl (inicio_programado);
create index on public.bkl (responsable_id);

create table public.bkl_tarea (
  id uuid primary key default gen_random_uuid(),
  bkl_id uuid not null references public.bkl(id) on delete cascade,
  orden integer not null check (orden between 1 and 20),
  descripcion text not null check (btrim(descripcion) <> ''),
  hecha boolean not null default false,
  observacion text,
  unique (bkl_id, orden)
);

create table public.solicitud_compra (
  id uuid primary key default gen_random_uuid(),
  numero integer not null unique default nextval('public.sc_numero_seq') check (numero > 0),
  numero_maestro text,
  fecha date not null default public.hoy(),
  equipo_id uuid not null references public.equipo(id),
  prioridad public.prioridad_sc not null default 'normal',
  proveedor text,
  estado public.estado_sc not null default 'solicitada',
  drq text,
  no_oc text,
  fecha_estimada date,
  fecha_recibida date,
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bkl_repuesto (
  id uuid primary key default gen_random_uuid(),
  bkl_id uuid not null references public.bkl(id) on delete cascade,
  orden integer not null default 1,
  tarea_orden integer check (tarea_orden between 1 and 20),
  codigo_gp text not null default '',
  numero_parte text not null default '',
  descripcion text not null default '',
  cantidad numeric(10,2) not null check (cantidad > 0),
  almacen text not null default '',
  ubicacion text not null default '',
  precio_usd numeric(12,2) not null default 0 check (precio_usd >= 0),
  stock public.stock_rep not null default 'disponible',
  solicitud_id uuid references public.solicitud_compra(id) on delete set null,
  kit_listo boolean not null default false,
  check (btrim(numero_parte) <> '' or btrim(descripcion) <> '')
);
create index on public.bkl_repuesto (bkl_id);
create index on public.bkl_repuesto (solicitud_id);

create table public.solicitud_bkl (
  solicitud_id uuid not null references public.solicitud_compra(id) on delete cascade,
  bkl_id uuid not null references public.bkl(id) on delete cascade,
  primary key (solicitud_id, bkl_id)
);

create table public.semana_congelada (
  id uuid primary key default gen_random_uuid(),
  anio integer not null,
  semana integer not null check (semana between 1 and 53),
  congelada_en timestamptz not null default now(),
  congelada_por uuid default auth.uid(),
  unique (anio, semana)
);

create table public.semana_item (
  semana_id uuid not null references public.semana_congelada(id) on delete cascade,
  bkl_id uuid not null references public.bkl(id) on delete cascade,
  responsable_id uuid references public.perfil(id),
  hh_plan numeric(8,1) not null default 0,
  costo_usd numeric(12,2) not null default 0,
  primary key (semana_id, bkl_id)
);

create table public.bkl_evento (
  id bigint generated always as identity primary key,
  bkl_id uuid not null references public.bkl(id) on delete cascade,
  tipo public.tipo_evento not null,
  detalle jsonb not null default '{}'::jsonb,
  usuario_id uuid default auth.uid() references public.perfil(id) on delete set null,
  fecha timestamptz not null default now()
);
create index on public.bkl_evento (bkl_id);

create table public.adjunto (
  id uuid primary key default gen_random_uuid(),
  bkl_id uuid not null references public.bkl(id) on delete cascade,
  tipo text not null check (tipo in ('foto','pdf')),
  ruta text not null,
  subido_por uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create trigger perfil_updated before update on public.perfil for each row execute function public.tocar_updated_at();
create trigger equipo_updated before update on public.equipo for each row execute function public.tocar_updated_at();
create trigger bkl_updated before update on public.bkl for each row execute function public.tocar_updated_at();
create trigger sc_updated before update on public.solicitud_compra for each row execute function public.tocar_updated_at();

-- Historial automático y conteo de reprogramaciones (la BD es la fuente).
create or replace function public.bkl_historial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into bkl_evento (bkl_id, tipo, detalle) values (new.id, 'creado', jsonb_build_object('inicio', new.inicio_programado));
    return new;
  end if;
  if new.inicio_programado is distinct from old.inicio_programado and old.inicio_programado is not null then
    insert into bkl_evento (bkl_id, tipo, detalle)
      values (new.id, 'reprogramado', jsonb_build_object('de', old.inicio_programado, 'a', new.inicio_programado));
  end if;
  if new.inicio_real is not null and old.inicio_real is null then
    insert into bkl_evento (bkl_id, tipo, detalle) values (new.id, 'inicio', jsonb_build_object('fecha', new.inicio_real));
  end if;
  if new.fin_real is not null and old.fin_real is null then
    insert into bkl_evento (bkl_id, tipo, detalle) values (new.id, 'fin', jsonb_build_object('fecha', new.fin_real, 'hh', new.hh_reales));
  end if;
  if new.estado_manual is distinct from old.estado_manual then
    if new.estado_manual = 'cerrado' then
      insert into bkl_evento (bkl_id, tipo) values (new.id, 'cerrado');
    elsif new.estado_manual = 'cancelado' then
      insert into bkl_evento (bkl_id, tipo) values (new.id, 'cancelado');
    elsif old.estado_manual in ('cerrado','cancelado') then
      insert into bkl_evento (bkl_id, tipo) values (new.id, 'reabierto');
    end if;
  end if;
  return new;
end $$;

create or replace function public.bkl_contar_reprog() returns trigger language plpgsql as $$
begin
  if new.inicio_programado is distinct from old.inicio_programado and old.inicio_programado is not null then
    new.reprogramaciones := old.reprogramaciones + 1;
  else
    new.reprogramaciones := old.reprogramaciones;
  end if;
  return new;
end $$;

create trigger bkl_reprog before update on public.bkl for each row execute function public.bkl_contar_reprog();
create trigger bkl_hist after insert or update on public.bkl for each row execute function public.bkl_historial();

-- Guarda un BKL completo (cabecera + tareas + repuestos) en una sola transacción.
-- Claves del JSON en snake_case, iguales a las columnas. Devuelve el número del BKL.
create or replace function public.guardar_bkl(d jsonb) returns integer
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
  v_num integer;
begin
  if nullif(d->>'id', '') is null then
    insert into bkl (numero, equipo_id, actividad, sistema, prioridad, responsable_id, planner_id, hh_estimadas,
      dias_estimados, tecnicos, fecha_ingreso, inicio_programado, inicio_original, inicio_real, fin_real, hh_reales,
      ejecutado_por, horometro, no_ot, observaciones, estado_manual)
    values (coalesce((d->>'numero')::int, nextval('bkl_numero_seq')::int), (d->>'equipo_id')::uuid, d->>'actividad',
      coalesce(d->>'sistema', ''), (d->>'prioridad')::prioridad, nullif(d->>'responsable_id', '')::uuid,
      nullif(d->>'planner_id', '')::uuid, (d->>'hh_estimadas')::numeric, coalesce((d->>'dias_estimados')::numeric, 1),
      (d->>'tecnicos')::int, coalesce((d->>'fecha_ingreso')::date, hoy()), (d->>'inicio_programado')::date,
      coalesce((d->>'inicio_original')::date, (d->>'inicio_programado')::date), (d->>'inicio_real')::date,
      (d->>'fin_real')::date, (d->>'hh_reales')::numeric, d->>'ejecutado_por', (d->>'horometro')::numeric,
      d->>'no_ot', d->>'observaciones', nullif(d->>'estado_manual', '')::estado_manual)
    returning id, numero into v_id, v_num;
    if d ? 'numero' and d->>'numero' is not null then
      perform setval('bkl_numero_seq', greatest((select max(numero) from bkl), 1));
    end if;
  else
    update bkl set equipo_id = (d->>'equipo_id')::uuid, actividad = d->>'actividad', sistema = coalesce(d->>'sistema', ''),
      prioridad = (d->>'prioridad')::prioridad, responsable_id = nullif(d->>'responsable_id', '')::uuid,
      planner_id = nullif(d->>'planner_id', '')::uuid, hh_estimadas = (d->>'hh_estimadas')::numeric,
      dias_estimados = coalesce((d->>'dias_estimados')::numeric, 1), tecnicos = (d->>'tecnicos')::int,
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
