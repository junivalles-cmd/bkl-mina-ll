-- Seguridad por roles (RLS). Lectura: cualquier usuario activo. Escritura según rol.
create or replace function public.es_activo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfil where id = auth.uid() and activo)
$$;

create or replace function public.es_rol(roles public.rol_usuario[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfil where id = auth.uid() and activo and rol = any (roles))
$$;

alter table public.perfil enable row level security;
alter table public.equipo enable row level security;
alter table public.parametro enable row level security;
alter table public.bkl enable row level security;
alter table public.bkl_tarea enable row level security;
alter table public.bkl_repuesto enable row level security;
alter table public.solicitud_compra enable row level security;
alter table public.solicitud_bkl enable row level security;
alter table public.semana_congelada enable row level security;
alter table public.semana_item enable row level security;
alter table public.bkl_evento enable row level security;
alter table public.adjunto enable row level security;

create policy perfil_leer on public.perfil for select to authenticated using (public.es_activo() or id = auth.uid());
create policy perfil_admin on public.perfil for all to authenticated using (public.es_rol('{admin}')) with check (public.es_rol('{admin}'));

create policy parametro_leer on public.parametro for select to authenticated using (public.es_activo());
create policy parametro_admin on public.parametro for all to authenticated using (public.es_rol('{admin}')) with check (public.es_rol('{admin}'));

create policy equipo_leer on public.equipo for select to authenticated using (public.es_activo());
create policy equipo_escribir on public.equipo for all to authenticated using (public.es_rol('{admin,planner}')) with check (public.es_rol('{admin,planner}'));

create policy bkl_leer on public.bkl for select to authenticated using (public.es_activo());
create policy bkl_escribir on public.bkl for all to authenticated using (public.es_rol('{admin,planner}')) with check (public.es_rol('{admin,planner}'));

create policy tarea_leer on public.bkl_tarea for select to authenticated using (public.es_activo());
create policy tarea_escribir on public.bkl_tarea for all to authenticated using (public.es_rol('{admin,planner}')) with check (public.es_rol('{admin,planner}'));

create policy repuesto_leer on public.bkl_repuesto for select to authenticated using (public.es_activo());
create policy repuesto_escribir on public.bkl_repuesto for all to authenticated using (public.es_rol('{admin,planner}')) with check (public.es_rol('{admin,planner}'));
create policy repuesto_almacen on public.bkl_repuesto for update to authenticated using (public.es_rol('{almacen}')) with check (public.es_rol('{almacen}'));

create policy sc_leer on public.solicitud_compra for select to authenticated using (public.es_activo());
create policy sc_escribir on public.solicitud_compra for all to authenticated using (public.es_rol('{admin,planner,compras}')) with check (public.es_rol('{admin,planner,compras}'));

create policy scbkl_leer on public.solicitud_bkl for select to authenticated using (public.es_activo());
create policy scbkl_escribir on public.solicitud_bkl for all to authenticated using (public.es_rol('{admin,planner,compras}')) with check (public.es_rol('{admin,planner,compras}'));

create policy semana_leer on public.semana_congelada for select to authenticated using (public.es_activo());
create policy semana_escribir on public.semana_congelada for all to authenticated using (public.es_rol('{admin,planner}')) with check (public.es_rol('{admin,planner}'));
create policy item_leer on public.semana_item for select to authenticated using (public.es_activo());
create policy item_escribir on public.semana_item for all to authenticated using (public.es_rol('{admin,planner}')) with check (public.es_rol('{admin,planner}'));

create policy evento_leer on public.bkl_evento for select to authenticated using (public.es_activo());

create policy adjunto_leer on public.adjunto for select to authenticated using (public.es_activo());
create policy adjunto_escribir on public.adjunto for all to authenticated using (public.es_rol('{admin,planner,responsable}')) with check (public.es_rol('{admin,planner,responsable}'));

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select, update on all sequences in schema public to authenticated;
grant execute on function public.guardar_bkl(jsonb) to authenticated;
