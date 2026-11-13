# Puesta en marcha (una sola vez)

Proyecto Supabase: `jhybnsdbiufberseierg` · App: https://junivalles-cmd.github.io/bkl-mina-ll/

## 1. Base de datos
1. Supabase → **SQL Editor** → *New query*.
2. Pega todo el archivo `supabase/aplicar_todo.sql` y pulsa **Run**. Crea tablas, vistas, permisos y parámetros.

## 2. Tu usuario administrador
1. Supabase → **Authentication → Users → Add user → Create new user**.
   - Email: `jvalles@bkl-mina-ll.app` · contraseña a tu gusto · marca **Auto Confirm User**.
2. SQL Editor: pega y ejecuta `supabase/primer_admin.sql`.
3. Entra a la app con usuario **jvalles** y tu contraseña.

## 3. Función para crear usuarios desde la app
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**.
2. Nombre: **crear-usuario**. Pega `supabase/functions/crear-usuario/index.ts` y despliega (deja *Verify JWT* activado).
3. En la app: **Administración → Usuarios**. Crea a Jean Carlos Soza y Gelber Cabrera (rol *responsable*, 160 HH/semana) y a los planners.

## 4. Cargar lo que ya tienes
**Administración → Importar FORMATO_BKL_V17**: sube el libro. Se cargan equipos, BKL con su mismo número, tareas, repuestos y SC (con su V-#### como número del maestro). Hazlo después del paso 3 para que los responsables queden asignados.

## 5. Publicación
Cada `push` a `main` corre las pruebas y publica en GitHub Pages (Settings → Pages → Source: **GitHub Actions**).

## Usuarios y roles
| Rol | Puede |
| --- | --- |
| admin | todo, usuarios, parámetros, importar |
| planner | crear/editar/reprogramar/cerrar/cancelar BKL, equipos |
| responsable, supervisor, jefatura | ver (fase 3: registrar ejecución en *Mis trabajos*) |
| almacen, compras | ver (fase 2: repuestos y SC) |

El usuario se escribe sin @ (`jsoza`); internamente es `jsoza@bkl-mina-ll.app`.
