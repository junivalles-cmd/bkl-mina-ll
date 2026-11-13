// Une las migraciones en un solo archivo para pegar en el editor SQL de Supabase.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = 'supabase/migrations';
const partes = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  .map((f) => `-- ===== ${f} =====\n` + readFileSync(`${dir}/${f}`, 'utf8'));
writeFileSync('supabase/aplicar_todo.sql', '-- Generado por scripts/unir-migraciones.mjs. Pegar completo en Supabase > SQL Editor > Run.\nbegin;\n' + partes.join('\n') + '\ncommit;\n');
console.log('supabase/aplicar_todo.sql listo');
