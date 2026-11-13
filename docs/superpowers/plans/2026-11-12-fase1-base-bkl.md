# Fase 1 – Base y BKL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web publicada en GitHub Pages donde el planner entra con usuario, crea/edita BKL con tareas y repuestos pegados desde Excel, ve el backlog ordenado por puntaje, imprime la hoja guía e importa el FORMATO_BKL_V17.

**Architecture:** Dominio en clases TypeScript puras (`src/dominio`) que replican las reglas del V17; repositorios (`src/datos`) con implementación Supabase y en memoria; casos de uso (`src/servicios`); React en `src/ui`. Postgres en Supabase con tablas relacionadas, vista `v_bkl` y RLS; las migraciones se prueban con PGlite y se cruzan contra las clases.

**Tech Stack:** Vite 5, React 18, TypeScript estricto, React Router (HashRouter), TanStack Query, Zod, Tailwind 3, supabase-js v2, Vitest + Testing Library, PGlite, ExcelJS.

**Spec:** `docs/superpowers/specs/2026-11-12-bkl-app-design.md`

## Global Constraints

- Idioma de la interfaz: español. Zona horaria: America/Managua. Fechas en BD como `date` (`YYYY-MM-DD`); en TS como string `YYYY-MM-DD`, aritmética en UTC.
- Semana ISO (lunes–domingo). Moneda USD; C$ = USD × `tipo_cambio` (36.62).
- Parámetros por defecto: `tipo_cambio` 36.62, `factor_tiempo_efectivo` 0.5, `dias_para_iniciar` 6, `dias_estimados_def` 1, `hh_por_dia` 8.
- Número BKL: `BKL-` + 3 dígitos (4 si > 999). Número SC: `SCB-` + 4 dígitos (consecutivo propio; el V-#### del maestro va en `numero_maestro`).
- Hasta 20 tareas por BKL. Columnas de pegado: Cód. GP, No. parte, Descripción, Cant., Tarea, Almacén, Ubicación, P. Und USD, Stock.
- Base: `base: '/bkl-mina-ll/'`, HashRouter. Llave publicable en `.env.production`; la llave secreta nunca en el repo.
- Nombres de tablas y columnas en español sin tildes.

## Review Focus

1. Pegado desde Excel con encabezado, filas vacías, números con `$`, comas de miles y CRLF → se ignoran encabezados/vacías y los números se leen bien (Task 3).
2. Fechas cerca del cambio de año (29/12/2026 es semana 53 de 2026; 01/01/2027 también) → semana ISO correcta en TS y SQL (Tasks 2 y 5).
3. BKL importado del V17 con equipo escrito por ahorrativo (A01) o con código guardado como número → se resuelve al equipo correcto o se informa la fila (Task 7).
4. Cerrar un BKL sin HH reales o con fin_real antes del inicio_real → error claro, no se guarda (Tasks 4 y 5).
5. Repuesto con SC cancelada → vuelve a POR PEDIR y el BKL queda PENDIENTE REPUESTOS (Tasks 4 y 5).

---

### Task 1: Andamiaje del proyecto

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/index.css`, `.env.production`, `.gitignore`, `.github/workflows/pages.yml`, `README.md`.

- [ ] Step 1: Instalar dependencias (lista del Tech Stack) y configurar Vitest (`environment: jsdom` para `src/ui`, `node` para el resto).
- [ ] Step 2: `npm run build` y `npm test` pasan con una prueba humo `tests/humo.test.ts` (`expect(1).toBe(1)`).
- [ ] Step 3: Workflow de Pages: `npm ci && npm test && npm run build`, publica `dist/`.
- [ ] Step 4: Commit `chore: andamiaje`.

### Task 2: Fechas y parámetros

**Files:** Create `src/dominio/fechas.ts`, `src/dominio/parametros.ts`; Test `tests/dominio/fechas.test.ts`.

**Interfaces – Produces:**
- `type Fecha = string` (YYYY-MM-DD); `sumarDias(f: Fecha, n: number): Fecha`; `difDias(a: Fecha, b: Fecha): number` (a − b); `semanaIso(f: Fecha): { anio: number; semana: number }`; `domingoSemanaIso(anio: number, semana: number): Fecha`; `lunesSemanaIso(anio, semana): Fecha`; `hoyManagua(): Fecha`; `esFecha(s: string): boolean`; `aFecha(valor: unknown): Fecha | null` (acepta Date, `YYYY-MM-DD`, `dd/mm/yyyy`, serial de Excel).
- `interface Parametros { tipoCambio; factorTiempoEfectivo; diasParaIniciar; diasEstimadosDef; hhPorDia }` y `PARAMETROS_DEF`.

- [ ] Step 1: Pruebas: `semanaIso('2026-12-29')` → `{anio:2026, semana:53}`; `semanaIso('2027-01-01')` → `{2026,53}`; `semanaIso('2027-01-04')` → `{2027,1}`; `domingoSemanaIso(2026,46)` → `'2026-11-15'`; `sumarDias('2026-11-12',6)` → `'2026-11-18'`; `aFecha(46338)` → `'2026-11-12'`; `aFecha('12/11/2026')` → `'2026-11-12'`.
- [ ] Step 2: Implementar, correr, commit.

### Task 3: Repuesto y PegadoExcel

**Files:** Create `src/dominio/repuesto.ts`, `src/dominio/pegadoExcel.ts`, `src/dominio/errores.ts`; Tests `tests/dominio/repuesto.test.ts`, `tests/dominio/pegadoExcel.test.ts`.

**Interfaces – Produces:**
- `class ReglaNegocioError extends Error`.
- `type EstadoSc = 'solicitada'|'cotizada'|'aprobada'|'oc_emitida'|'en_transito'|'recibida'|'cancelada'`; `numeroScTexto(n: number): string` → `SCB-0007`.
- `interface RepuestoDatos { id?; tareaOrden: number|null; codigoGp; numeroParte; descripcion; cantidad: number; almacen; ubicacion; precioUsd: number; stock: 'disponible'|'pedir'; sc?: { numero: number; estado: EstadoSc } | null; kitListo?: boolean }`.
- `class Repuesto { constructor(d: RepuestoDatos); total(): number; porPedir(): boolean; enSc(): boolean; estadoTexto(): string }` — reglas 5–6 del spec. Estado SC en texto: SOLICITADA, COTIZADA, APROBADA, OC EMITIDA, EN TRÁNSITO.
- `PegadoExcel.parsear(texto: string): { filas: RepuestoDatos[]; errores: { fila: number; mensaje: string }[] }`.

- [ ] Step 1: Pruebas Repuesto: total 2×18.05 = 36.10; pedir sin SC → `POR PEDIR`; SC 7 aprobada → `SCB-0007 · APROBADA`; recibida → `RECIBIDO (SCB-0007)`; cancelada → `POR PEDIR` y `porPedir()` true.
- [ ] Step 2: Pruebas pegado: 2 filas TSV con CRLF; fila de encabezado (`Cód. GP\tNo. parte…`) ignorada; fila vacía ignorada; `$1,234.50` → 1234.5; stock vacío con almacén → disponible, sin almacén → pedir; cantidad 0 o texto → error `Fila 2: cantidad inválida`; solo 4 columnas aceptadas (resto vacío, precio 0); falta No. parte y descripción → error.
- [ ] Step 3: Implementar, correr, commit.

### Task 4: Clase Bkl

**Files:** Create `src/dominio/bkl.ts`; Test `tests/dominio/bkl.test.ts`.

**Interfaces – Consumes:** Tasks 2–3. **Produces:**
- `type Prioridad='A'|'B'|'C'`; `type EstadoManual = null|'pendiente_repuestos'|'cerrado'|'cancelado'`; `type EstadoBkl = 'CERRADO'|'CANCELADO'|'EJECUTADO'|'EN EJECUCIÓN'|'PENDIENTE REPUESTOS'|'PROGRAMADO'|'LISTO PARA PROGRAMAR'`.
- `interface Tarea { orden: number; descripcion: string; hecha: boolean; observacion?: string|null }`.
- `interface BklDatos { id?; numero?: number; equipoId: string; actividad; sistema; prioridad; responsableId: string|null; plannerId: string|null; hhEstimadas: number|null; diasEstimados: number; fechaIngreso: Fecha; inicioProgramado: Fecha|null; inicioOriginal: Fecha|null; inicioReal: Fecha|null; finReal: Fecha|null; hhReales: number|null; ejecutadoPor: string|null; horometro: number|null; noOt: string|null; observaciones: string|null; estadoManual: EstadoManual; tareas: Tarea[]; repuestos: RepuestoDatos[]; reprogramaciones?: number }`.
- `class Bkl { static nuevo(d: Partial<BklDatos> & {equipoId; actividad; prioridad}, p: Parametros, hoy: Fecha): Bkl; numeroTexto(); hh(p); finProgramado(); costoUsd(); porPedir(); enSc(); estadoRepuestos(); repuestosCompletos(); estado(); abierto(); situacion(hoy); diasAbierto(hoy); puntaje(hoy): number|null; semanaPlan(): {anio,semana}|null; validar(): void; reprogramar(f: Fecha): void; cerrar(c: {finReal; ejecutadoPor; hhReales}): void; cancelar(): void; datos(): BklDatos }`.

- [ ] Step 1: Pruebas (hoy = 2026-11-12, parámetros por defecto): `nuevo` → inicio 2026-11-18 = inicio_original, días 1, hh 8; `numeroTexto` 1 → `BKL-001`, 1234 → `BKL-1234`; fin programado con 3 días = inicio+2; estados en el orden de la regla 8; situación EJECUTADO CON RETRASO cuando fin_real > inicio_original + días − 1 aunque se reprogramó; RETRASADO – REPUESTOS; puntaje A, 20 días, completos = 50+10+10 = 70; null si ejecutado; `cerrar` sin hhReales lanza `ReglaNegocioError`; fin_real < inicio_real lanza; `reprogramar` no cambia inicio_original y suma reprogramaciones; `validar` con 21 tareas lanza; cancelar un cerrado lanza.
- [ ] Step 2: Implementar, correr, commit.

### Task 5: Migraciones SQL y prueba cruzada

**Files:** Create `supabase/migrations/0001_esquema.sql`, `0002_vistas.sql`, `0003_seguridad.sql`, `supabase/aplicar_todo.sql` (generado por `scripts/unir-migraciones.mjs`), `tests/sql/pglite.ts` (stub de `auth.uid()`/`auth.users`/roles), `tests/sql/esquema.test.ts`, `tests/sql/cruzada.test.ts`.

**Produces:** tablas, enums y FKs de la sección 6 (todas); secuencias `bkl_numero_seq`, `sc_numero_seq`; `parametro` con los 5 valores; vista `v_bkl` (`numero_texto, estado, estado_repuestos, situacion, fin_programado, hh, costo_usd, por_pedir, en_sc, dias_abierto, puntaje, anio, semana, mes`) usando `current_date` en zona America/Managua mediante función `hoy()`; función `es_rol(text[])`; RLS: lectura para autenticados activos; escritura de bkl/tareas/repuestos/equipo para admin y planner; parametro y perfil solo admin; trigger `bkl_evento` al crear/reprogramar/cerrar/cancelar.

- [ ] Step 1: Prueba esquema: aplicar las 3 migraciones en PGlite sin error; CHECK de cierre rechaza `estado_manual='cerrado'` sin hh_reales; `cantidad = 0` rechazada; código de equipo duplicado rechazado.
- [ ] Step 2: Prueba cruzada: 8 BKL de ejemplo (cubren cada estado y situación, SC cancelada, semana 53) insertados en PGlite y construidos como `Bkl`; para cada uno `v_bkl.estado/estado_repuestos/situacion/fin_programado/hh/costo_usd/puntaje/semana` = método de la clase (hoy fijado con `set app.hoy = '2026-11-12'`).
- [ ] Step 3: Implementar, correr, generar `aplicar_todo.sql`, commit.

### Task 6: Repositorios y servicios

**Files:** Create `src/datos/tipos.ts`, `src/datos/memoria.ts`, `src/datos/supabase.ts`, `src/datos/cliente.ts`, `src/servicios/bklServicio.ts`; Test `tests/servicios/bklServicio.test.ts`.

**Produces:**
- `interface Repos { equipos: { listar(): Promise<Equipo[]>; guardar(e: Equipo): Promise<Equipo> }; perfiles: { listar(): Promise<Perfil[]> }; parametros: { obtener(): Promise<Parametros>; guardar(p): Promise<void> }; bkls: { listar(): Promise<Bkl[]>; obtener(numero: number): Promise<Bkl|null>; guardar(b: Bkl): Promise<number> /* devuelve numero */ } }`.
- `interface Equipo { id; codigo; ahorrativo|null; familia; marca; modelo; serie|null; ubicacion; criticidad: Prioridad|null; activo }`; `interface Perfil { id; usuario; nombre; rol: Rol; hhSemana: number; activo }`.
- `class BklServicio(repos, hoy: () => Fecha) { crear(entrada), actualizar(numero, cambios), reprogramar(numero, fecha), cerrar(numero, c), cancelar(numero), backlog(filtro): Promise<Bkl[]> /* abiertos por puntaje desc */ }`; `buscarEquipo(equipos, texto)` resuelve código o ahorrativo (sin distinguir mayúsculas; `15-59`, `1559`, `A01`).

- [ ] Step 1: Pruebas con repos en memoria: crear asigna número consecutivo y fechas por defecto; crear con equipo inexistente lanza; backlog ordena por puntaje; cerrar persiste.
- [ ] Step 2: Implementar (Supabase: lectura con `select('*, bkl_tarea(*), bkl_repuesto(*, solicitud_compra(numero, estado))')`; guardar = upsert bkl + reemplazo de tareas y repuestos), correr, commit.

### Task 7: Importar FORMATO_BKL_V17

**Files:** Create `src/servicios/importarV17.ts`; Test `tests/servicios/importarV17.test.ts` con `tests/fixtures/FORMATO_BKL_V17.xlsx`.

**Produces:** `leerV17(buf: ArrayBuffer): Promise<{ equipos: Equipo[]; bkls: BklDatos[]; scs: {numeroMaestro; fecha; estado; proveedor; noOc; bklNumeros: number[]}[]; errores: string[] }>` y `importarV17(repos, datos)`. Hojas: EQUIPOS (A:G), BD BKL (fila 6 encabezados, desde fila 7), BD TAREAS, BD REPUESTOS, PEDIDOS SC. Los BKL conservan su número; responsables por nombre contra perfiles (si no existe, null + aviso).

- [ ] Step 1: Prueba con el V17 de ejemplo: 3 tareas y ≥ 5 repuestos de BKL-001; equipo `05-18` con ahorrativo `T01`; código numérico 518 con formato → `05-18`.
- [ ] Step 2: Implementar, correr, commit.

### Task 8: Interfaz

**Files:** `src/ui/App.tsx`, `src/ui/sesion.tsx`, `src/ui/Diseno.tsx`, `src/ui/paginas/{Entrar,Backlog,BklNuevo,BklDetalle,Imprimir,Admin}.tsx`, `src/ui/componentes/{TablaRepuestos,EditorTareas,SelectorEquipo,Insignia}.tsx`; Test `tests/ui/TablaRepuestos.test.tsx`.

- [ ] Step 1: Prueba: pegar TSV en `TablaRepuestos` agrega filas y muestra el total `USD 36.10`; errores de pegado visibles por fila.
- [ ] Step 2: Rutas `/entrar`, `/backlog`, `/bkl/nuevo`, `/bkl/:numero` (editar, reprogramar, cerrar, cancelar, imprimir), `/bkl/:numero/imprimir` (hoja guía A4 con `@media print`), `/admin` (equipos, parámetros, importar V17). Usuario sin `@` → `usuario@bkl-mina-ll.app`.
- [ ] Step 3: `npm run build` limpio; revisar visualmente con modo demo (`?demo=1` usa repos en memoria con datos de ejemplo); commit.

### Task 9: Función de alta de usuarios y entrega

**Files:** `supabase/functions/crear-usuario/index.ts`, `docs/INSTALAR.md`.

- [ ] Step 1: Edge function: verifica que quien llama es admin (`perfil.rol='admin'`), crea usuario con `auth.admin.createUser` y su `perfil`. Primer admin: instrucciones SQL en INSTALAR.md.
- [ ] Step 2: Pruebas completas en verde, build, push a `main`, Pages activo.
