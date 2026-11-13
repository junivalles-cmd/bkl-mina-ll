# Sistema de Gestión de BKL – Mina La Libertad · Diseño técnico

Fecha: 2026-11-12 · Autor del pedido: Junior Valles (CONEQUISA, Mantenimiento Open Pit)
Diseño funcional previo: documento "Sistema de Gestión de BKL – Mina La Libertad (diseño)" (artifact) y el libro FORMATO_BKL_V17 (Excel + macros), cuyas reglas son la referencia de negocio.

## 1. Intención y por qué

Hoy los BKL (backlog de mantenimiento: trabajos pendientes de un equipo) se planifican en un libro Excel con macros (V17). Funciona, pero lo usa una sola persona, se rompe con copias, no lo ven en el celular los responsables de ejecución y cada mejora exige rehacer el archivo.

Se construye una **app web independiente y completa**: base de datos relacional propia, capas de código con clases de dominio, varios usuarios con roles y pantallas separadas. Debe conservar al pie de la letra la lógica ya validada en el V17 (sección 8).

Éxito = el planner crea, programa, congela e imprime los BKL solo en la app; Jean Carlos Soza y Gelber Cabrera los ejecutan y cierran desde el celular; jefatura ve costos, backlog y cumplimiento sin pedir un Excel.

## 2. Objetivos, no objetivos, anti-objetivos

**Objetivos**
1. Ciclo completo del BKL: crear → repuestos → SC → programar → congelar semana → ejecutar → cerrar.
2. Repuestos escritos a mano o **pegados desde Excel** (copiar filas, pegar en una tabla de la app).
3. Solicitudes de compra (SC V-####) generadas desde los repuestos POR PEDIR, con Ref. BKL.
4. Semana congelada con cumplimiento (HH) y trabajo que irrumpe.
5. HH estimadas y reales; costo USD por BKL, semana y mes; backlog en semanas de cuadrilla; carga por responsable.
6. Hoja guía imprimible del BKL (formato V16/V17 aprobado).
7. Usable en el celular, instalable (PWA).

**No objetivos (por ahora)**
- Conexión con Dynamics GP o con el inventario consolidado (los repuestos se ingresan a mano).
- Mantenimiento preventivo por horómetro, checklists de operador, inspecciones (otra app ya existe).
- Aprobaciones de compra dentro de la app (compras solo registra el avance).

**Anti-objetivos (sería un fracaso aunque funcione)**
- Que un BKL pueda programarse o congelarse con repuestos incompletos.
- Que alguien pueda escribir a mano un valor calculado (estado, costo, situación, HH, cumplimiento).
- Que un responsable pueda cambiar fechas, repuestos o costos.
- Una app de un solo archivo sin capas, sin pruebas o sin relaciones reales en la base.

## 3. Restricciones

- **Base de datos propia** (proyecto Supabase nuevo), separada de Inspecciones de Flota.
- Idioma de la interfaz: español. Zona horaria: America/Managua. Moneda: USD, con tipo de cambio C$ configurable (36.62 hoy).
- Semana = semana ISO (lunes a domingo), igual que `WEEKNUM(fecha,21)` del V17.
- Hosting sin servidor propio: GitHub Pages (front) + Supabase (base, usuarios, archivos, funciones).
- Código en GitHub, repo `bkl-mina-ll` (lo crea Junior), mantenible por Claude Code o Codex.

## 4. Enfoques considerados

| Enfoque | Cambia | Decisión |
| --- | --- | --- |
| **A. React + TypeScript (Vite) + Supabase** | SPA en capas con clases de dominio; PostgreSQL con llaves foráneas, RLS y vistas; GitHub Pages; funciones de Supabase para tareas programadas | **Elegido por Junior.** App completa y relacional sin servidor que mantener; reutiliza lo que ya conoce de Supabase |
| B. Next.js + Supabase | Agrega servidor propio (render, API) | Más piezas y hosting en Vercel sin necesidad real a este volumen |
| C. Python FastAPI (ORM) + PostgreSQL + React | Servidor Python permanente | El más caro de mantener y alojar |

## 5. Usuarios y roles

| Rol | Puede |
| --- | --- |
| `admin` | Todo, incluidos usuarios, equipos, parámetros e importación |
| `planner` | Crear/editar BKL, tareas, repuestos; generar SC; congelar semana; reprogramar; cerrar/cancelar |
| `responsable` | Ver sus BKL; marcar tareas; registrar inicio real, fin real, HH reales, hallazgos y fotos |
| `supervisor` | Ver programa y BKL; registrar inicio/fin real |
| `almacen` | Ver repuestos; marcar DISPONIBLE y "kit listo" |
| `compras` | Ver y actualizar SC (DRQ, OC, fechas, estado) |
| `jefatura` | Solo lectura de todo y tableros |

Los permisos se aplican **en la base** (Row Level Security), no solo ocultando botones.

## 6. Modelo de datos (PostgreSQL)

Convenciones: llaves `id uuid` (salvo donde se indica), `created_at/updated_at timestamptz`, nombres en español sin tildes, enums de Postgres para estados.

| Tabla | Columnas principales | Relaciones / restricciones |
| --- | --- | --- |
| `perfil` | id (= auth.users.id), usuario, nombre, correo, rol, hh_semana numeric, activo | rol ∈ enum `rol_usuario` |
| `equipo` | id, codigo text (texto "15-59"), ahorrativo text, familia, marca, modelo, serie, ubicacion, criticidad (A/B/C), activo | `codigo` único; `ahorrativo` único cuando no es nulo |
| `parametro` | clave text PK, valor numeric, descripcion | tipo_cambio, factor_tiempo_efectivo (0.5), dias_para_iniciar (6), dias_estimados_def (1), hh_por_dia (8) |
| `bkl` | id, numero int (secuencia; se muestra `BKL-001`), equipo_id, actividad, sistema, prioridad (A/B/C), responsable_id, planner_id, hh_estimadas, dias_estimados, fecha_ingreso, inicio_programado, inicio_original, inicio_real, fin_real, hh_reales, ejecutado_por, horometro, no_ot, observaciones, estado_manual (null / pendiente_repuestos / cerrado / cancelado) | FK equipo, perfil×2; CHECK: `estado_manual='cerrado'` exige fin_real, ejecutado_por y hh_reales; fin_real ≥ inicio_real |
| `bkl_tarea` | id, bkl_id, orden, descripcion, hecha bool, observacion | FK bkl ON DELETE CASCADE; único (bkl_id, orden) |
| `bkl_repuesto` | id, bkl_id, tarea_orden int null, codigo_gp, numero_parte, descripcion, cantidad (>0), almacen, ubicacion, precio_usd (≥0), stock (disponible/pedir), solicitud_id null, kit_listo bool | FK bkl CASCADE, FK solicitud_compra |
| `solicitud_compra` | id, numero int único (consecutivo propio de la app, se muestra `SCB-0001`), numero_maestro text null (el V-#### que le dé el maestro, se anota después), fecha, equipo_id, prioridad (emergencia/critica/normal), proveedor, estado (solicitada, cotizada, aprobada, oc_emitida, en_transito, recibida, cancelada), drq, no_oc, fecha_estimada, fecha_recibida, observaciones | FK equipo |
| `solicitud_bkl` | solicitud_id, bkl_id | PK compuesta; una SC puede cubrir varios BKL del mismo equipo (Ref. BKL) |
| `semana_congelada` | id, anio, semana, congelada_en, congelada_por | único (anio, semana) |
| `semana_item` | semana_id, bkl_id, responsable_id, hh_plan, costo_usd | PK (semana_id, bkl_id); valores copiados al congelar (foto) |
| `bkl_evento` | id, bkl_id, tipo (creado, reprogramado, congelado, inicio, fin, cerrado, cancelado, sc), detalle jsonb, usuario_id, fecha | auditoría; cuenta reprogramaciones |
| `adjunto` | id, bkl_id, tipo (foto/pdf), ruta (Storage), subido_por | FK bkl CASCADE |

**Vistas** (los cálculos viven aquí, nadie los escribe):
- `v_bkl`: todo `bkl` + equipo + `costo_usd`, `hh` (hh_estimadas o dias×hh_por_dia), `por_pedir`, `en_sc`, `estado_repuestos`, `estado`, `situacion`, `fin_programado`, `dias_abierto`, `dias_reprog`, `reprogramaciones`, `puntaje`, `anio/semana/mes` del plan, `congelado`.
- `v_semana`: por (anio, semana): HH congeladas, HH cumplidas, % cumplimiento, HH que irrumpieron, BKL congelados, costo de la semana.
- `v_carga_responsable`: HH programadas por responsable y semana vs capacidad neta.
- `v_backlog`: HH abiertas, semanas de backlog, semanas listas para programar.

Las mismas reglas se implementan **también** en las clases TypeScript (sección 7) para validar antes de guardar y para mostrar al instante; pruebas automáticas comprueban que vista y clase dan el mismo resultado sobre los mismos datos.

## 7. Arquitectura del código

```
src/
  dominio/            clases puras, sin red: Bkl, Tarea, Repuesto, SolicitudCompra,
                      SemanaCongelada, Equipo, Parametros, Capacidad, Backlog, reglas comunes
  datos/              interfaces de repositorio + implementación Supabase + implementación en memoria (pruebas)
  servicios/          casos de uso: CrearBkl, PegarRepuestos, GenerarSc, CongelarSemana,
                      RegistrarEjecucion, CerrarBkl, Reprogramar, ImportarV17
  ui/                 React: rutas, pantallas, componentes, hooks (TanStack Query)
  ui/imprimir/        hoja guía del BKL y SC en formato imprimible
supabase/
  migrations/         SQL versionado: tablas, enums, FKs, vistas, RLS, funciones
  functions/          tareas programadas (recordatorio jueves, resumen lunes, pendientes viernes)
tests/                unitarias del dominio, de servicios con repos en memoria, y de SQL con PGlite
```

**Clases de dominio clave**
- `Bkl`: `estado()`, `situacion(hoy)`, `costoUsd()`, `hh()`, `finProgramado()`, `repuestosCompletos()`, `puedeProgramarse()`, `puedeCongelarse()`, `reprogramar(nuevaFecha)`, `registrarInicio()`, `registrarFin()`, `cerrar()`, `cancelar()`, `puntaje(hoy)`. Lanza `ReglaNegocioError` cuando una acción viola una regla.
- `Repuesto`: `total()`, `estado(sc?)` → DISPONIBLE / POR PEDIR / `SC V-0165 · APROBADA` / RECIBIDO.
- `SolicitudCompra`: `numeroTexto()` (`SCB-` + 4 dígitos), `avanzar(estado)`, `recibir(fecha)`.
- `SemanaCongelada`: `static congelar(anio, semana, bkls)` (solo BKL de esa semana, no cancelados, repuestos completos; devuelve también los excluidos con motivo), `cumplimiento(bkls)`, `hhIrrumpieron(bkls)`.
- `Capacidad`: `netaSemanal(perfil, parametros)`, `carga(responsable, semana, bkls)`.
- `Backlog`: `semanasTotal()`, `semanasListas()`.
- `PegadoExcel`: convierte texto pegado (TSV) en filas de repuesto validadas, con errores por fila.

**Tecnología**: Vite 5, React 18, TypeScript estricto, React Router, TanStack Query, Zod, Tailwind, supabase-js v2, Vitest + Testing Library, PGlite (Postgres en memoria para probar migraciones y vistas), vite-plugin-pwa, ExcelJS (importar V17, exportar SC).

## 8. Reglas de negocio (iguales al V17)

1. **Número BKL**: consecutivo; formato `BKL-` + 3 dígitos (crece a 4 si pasa de 999). Los BKL importados del V17 conservan su número.
2. **Fechas por defecto**: fecha_ingreso = hoy; inicio_programado = ingreso + `dias_para_iniciar`; inicio_original = inicio_programado al crear; dias_estimados = 1.
3. **HH** = hh_estimadas, o dias_estimados × `hh_por_dia` (8) si está vacía.
4. **Fin programado** = inicio_programado + max(1, dias) − 1.
5. **Repuesto**: total = cantidad × precio_usd. stock vacío al pegar: con almacén → DISPONIBLE, sin almacén → PEDIR.
6. **Estado del repuesto**: DISPONIBLE si stock=disponible; si pedir: sin SC → POR PEDIR; SC recibida → RECIBIDO (SCB-####); SC cancelada → POR PEDIR; otro → `SCB-#### · <estado>`.
7. **Estado de repuestos del BKL**: SIN REPUESTOS / FALTA PEDIR n / EN ESPERA: n EN SC / COMPLETOS.
8. **Estado del BKL** (calculado): estado_manual cerrado/cancelado manda; fin_real → EJECUTADO; inicio_real → EN EJECUCIÓN; repuestos por pedir o en SC, o estado_manual pendiente_repuestos → PENDIENTE REPUESTOS; con inicio_programado → PROGRAMADO; si no → LISTO PARA PROGRAMAR.
9. **Situación** (vs hoy): CANCELADO; EJECUTADO o EJECUTADO CON RETRASO (fin_real > inicio_original + dias − 1); RETRASADO / RETRASADO – REPUESTOS (fin programado < hoy y no ejecutado); EN EJECUCIÓN; ESPERA REPUESTOS; PENDIENTE.
10. **No se programa sin repuestos**: no se puede fijar/cambiar inicio_programado a una semana congelada ni congelar un BKL con repuestos incompletos.
11. **Congelar semana**: foto de los BKL cuya semana de plan = la elegida, no cancelados y con repuestos completos (SIN REPUESTOS o COMPLETOS); guarda hh_plan, costo y responsable. Volver a congelar reemplaza la foto (pide confirmación). Los excluidos se informan con su motivo.
12. **Cumplimiento semanal** = HH de ítems congelados con fin_real ≤ domingo de esa semana ÷ HH congeladas. Meta 40 %–90 %.
13. **Irrumpe** = BKL con fin_real en la semana que no estaba en la foto de esa semana; se suman sus HH reales (o estimadas).
14. **Capacidad neta** = hh_semana del responsable × factor_tiempo_efectivo. Carga = HH programadas de la semana ÷ capacidad (rojo > 100 %, ámbar > 85 %).
15. **Backlog (semanas)** = HH de BKL abiertos ÷ suma de capacidades netas; "listas" = solo PROGRAMADO o LISTO PARA PROGRAMAR. Metas 4–6 y 2–4.
16. **Puntaje** (solo abiertos) = prioridad (A 50, B 30, C 10) + min(60, días abierto)/2 + (−10 si PENDIENTE REPUESTOS, +10 si no).
17. **Cerrar** exige fin_real, ejecutado_por y hh_reales. **Cancelar** se permite en cualquier estado abierto. Reprogramar cambia inicio_programado, nunca inicio_original, y registra un evento.
18. **SC**: se genera con los repuestos PEDIR sin SC de uno o varios BKL **del mismo equipo**; prioridad desde el BKL (A→EMERGENCIA, B→CRITICA, C→NORMAL); estado inicial SOLICITADA; se vincula en `solicitud_bkl`.
19. **Costo**: suma de totales de repuestos del BKL; costo de semana = suma de BKL con semana de plan = la semana; C$ = USD × tipo_cambio.

## 9. Pantallas (rutas)

| Ruta | Quién | Contenido |
| --- | --- | --- |
| `/entrar` | todos | usuario y contraseña |
| `/backlog` | planner, jefatura | lista filtrable (estado, responsable, equipo, prioridad), orden por puntaje, totales HH y costo |
| `/bkl/nuevo` | planner | equipo (busca por código o ahorrativo, muestra modelo/familia), actividad, sistema, prioridad, responsable, HH, días, fechas, tareas (hasta 20), repuestos (tabla editable + **Pegar desde Excel**) |
| `/bkl/:numero` | según rol | detalle con pestañas: Datos, Tareas, Repuestos, SC, Ejecución, Historial; botones Reprogramar, Generar SC, Cerrar, Cancelar, Imprimir |
| `/bkl/:numero/imprimir` | planner | hoja guía (formato V17: equipo, trabajo y tareas con casilla, repuestos con P. UND y total, cierre, firmas) |
| `/semana` | planner, supervisor, jefatura | semana elegida: resumen (HH congeladas, cumplimiento, irrumpió, costo), carga por responsable, BKL de la semana y del mes con costo, botón **Congelar semana** |
| `/mis-trabajos` | responsable | BKL de su semana en tarjetas; tareas con casilla; Iniciar / Terminar; HH reales; fotos |
| `/compras` | compras, planner | SC con estado, BKL vinculados, DRQ, OC, fechas; imprimir/exportar SC |
| `/almacen` | almacén | repuestos por BKL; marcar disponible y kit listo |
| `/tableros` | planner, jefatura | backlog en semanas, cumplimiento por semana, costo por mes/equipo, días esperando repuestos |
| `/admin` | admin | usuarios y roles, equipos, parámetros, **Importar FORMATO_BKL_V17** |

Boceto de `/bkl/nuevo`:

```
EQUIPO [15-59 ▾]  Back Hoe · CAT 416F2 · Volcán     PRIORIDAD [B ▾]  RESPONSABLE [Jean Carlos ▾]
ACTIVIDAD [______________________________]  SISTEMA [____________]
HH [ 4 ]  DÍAS [ 1 ]  INICIO [12/11/2026]  (fin 12/11/2026)
TAREAS   1 [__________________________]  + agregar
REPUESTOS  [Pegar desde Excel]  [+ fila]
 Cód.GP | No. parte | Descripción | Cant | Tarea | Almacén | Ubicación | P.Und USD | Stock
 81380  | 4364440   | TAPON       |  2   |  1    | NIMAC   | C1-2A3    | 18.05     | DISPONIBLE
                                                     Total USD 9,010.00   [GUARDAR BKL]
```

Orden de columnas para pegar: Cód. GP, No. parte, Descripción, Cant., Tarea, Almacén, Ubicación, P. Und USD, Stock (las 9 del formulario V17); se aceptan menos columnas desde la izquierda.

## 10. Integraciones

- **Importar V17** (una vez): lee BD BKL, BD TAREAS, BD REPUESTOS, PEDIDOS SC, SEMANA CONGELADA y EQUIPOS del libro y los carga respetando números.
- **SC hacia el maestro**: la app numera las SC con su propio consecutivo `SCB-####` (independiente del V-#### del maestro) y exporta cada SC en Excel con las columnas de BASEDEDATOS del maestro (SOLICITUD, EQUIPO, FECHA SC, JUSTIFICACION, Descripcion, CODIGO GP, SISTEMA, COMPONENTE, DESCRIPCION, UND MEDIDA, N° DE PARTE, CANTIDAD, REF. BKL) para pegarlas allí, más una vista imprimible. El V-#### que el maestro asigne se anota en `numero_maestro` para trazabilidad.
- **Correos**: funciones programadas de Supabase envían el recordatorio del jueves, el resumen del lunes y los pendientes del viernes (fase 4).

## 11. Seguridad

RLS en todas las tablas por rol (sección 5); el responsable solo actualiza columnas de ejecución de sus BKL (mediante función `registrar_ejecucion` con SECURITY DEFINER y validaciones). La llave secreta de Supabase nunca va al código del front.

## 12. Fases de entrega

1. **Base y BKL**: repo, migraciones, dominio + pruebas, login/roles, equipos, crear/editar BKL con tareas y repuestos (pegar desde Excel), backlog, hoja guía, importar V17.
2. **Compras**: SC desde repuestos, pantalla de compras y almacén, exportación al maestro.
3. **Semana y ejecución**: congelar, cumplimiento, carga, Mis trabajos (móvil, fotos, sin señal).
4. **Tableros y correos**.

Cada fase termina usable, con pruebas en verde y publicada.

## 13. Decisiones tomadas por mí (corregibles)

- Hoja guía e impresión con HTML + CSS de impresión (no librería PDF): más fácil de mantener; el navegador guarda como PDF.
- Modo sin señal solo en `/mis-trabajos` (lo que necesita el taller); el resto requiere conexión.
- Hasta 20 tareas por BKL (el V17 imprimía 6); la hoja guía crece.
- Vistas SQL como fuente de verdad de los cálculos + clases TS espejo con pruebas cruzadas.
- `hh_por_dia` = 8 y `factor_tiempo_efectivo` = 0.5 como parámetros editables.
- Rutas con `HashRouter` (`/#/backlog`) para que GitHub Pages sirva todas las pantallas sin configuración de servidor.
- Alta de usuarios desde `/admin` mediante una función de Supabase con la llave secreta del lado del servidor (el front nunca la tiene).
- Sin señal en `/mis-trabajos`: lo capturado se guarda en el celular y se envía al volver la conexión; si dos personas tocaron el mismo campo, gana el último y queda en el historial.

## 14. Lo que queda al constructor

Estructura interna de componentes, estilos visuales dentro de la paleta CONEQUISA (azul #1F3A5F, dorado #B8892B), nombres de funciones auxiliares, mensajes de error, orden de las migraciones.

## 15. Preguntas resueltas

1. **SC y el maestro** (12/11/2026, Junior): la SC de la app lleva **otro consecutivo** (`SCB-####`), independiente del V-#### del maestro; el V-#### se registra aparte.
2. **Supabase**: proyecto `jhybnsdbiufberseierg` con llave publicable. Desde el entorno de construcción no hay acceso de red a Supabase: las migraciones se entregan como un SQL único para el editor SQL de Supabase y se prueban localmente con PGlite.
