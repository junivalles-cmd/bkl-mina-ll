# BKL · Mina La Libertad

Sistema de gestión del backlog (BKL) de mantenimiento de CONEQUISA en Mina La Libertad: BKL con tareas y repuestos (pegados desde Excel), backlog priorizado por puntaje, hoja guía imprimible e importación del FORMATO_BKL_V17.

- **Diseño:** `docs/superpowers/specs/2026-11-12-bkl-app-design.md`
- **Plan fase 1:** `docs/superpowers/plans/2026-11-12-fase1-base-bkl.md`
- **Instalar:** `docs/INSTALAR.md`

## Desarrollo
```bash
npm install
npm test        # dominio, SQL (PGlite) y UI
npm run dev     # http://localhost:5173/bkl-mina-ll/  ("Ver demostración" funciona sin Supabase)
npm run sql     # regenera supabase/aplicar_todo.sql desde las migraciones
```

## Estructura
- `src/dominio` clases y reglas (Bkl, Repuesto, PegadoExcel, fechas ISO)
- `src/datos` repositorios Supabase y en memoria
- `src/servicios` casos de uso (BklServicio, importarV17)
- `src/ui` pantallas React
- `supabase/migrations` esquema, vista `v_bkl`, RLS · `supabase/functions` funciones
