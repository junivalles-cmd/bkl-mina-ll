// Supabase Edge Function: crea un usuario (Auth) y su perfil. Solo la puede usar un admin activo.
// La llave secreta (service role) la pone Supabase en el entorno; nunca va al navegador.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ROLES = ['admin', 'planner', 'responsable', 'supervisor', 'almacen', 'compras', 'jefatura'];
const DOMINIO = 'bkl-mina-ll.app';

const responder = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const secreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, secreta, { auth: { persistSession: false } });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: quien } = await admin.auth.getUser(token);
  if (!quien.user) return responder({ error: 'Sesión no válida' }, 401);
  const { data: yo } = await admin.from('perfil').select('rol, activo').eq('id', quien.user.id).maybeSingle();
  if (!yo || !yo.activo || yo.rol !== 'admin') return responder({ error: 'Solo un administrador puede crear usuarios.' }, 403);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return responder({ error: 'Datos inválidos' }, 400); }
  const usuario = String(b.usuario ?? '').trim().toLowerCase();
  const nombre = String(b.nombre ?? '').trim();
  const rol = String(b.rol ?? 'responsable');
  const clave = String(b.clave ?? '');
  const hh = Number(b.hh_semana ?? 0) || 0;
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) return responder({ error: 'Usuario: 3 a 40 letras, números, punto o guion, sin espacios.' }, 400);
  if (!nombre) return responder({ error: 'Falta el nombre.' }, 400);
  if (!ROLES.includes(rol)) return responder({ error: 'Rol no válido.' }, 400);
  if (clave.length < 8) return responder({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);

  const { data: creado, error } = await admin.auth.admin.createUser({
    email: `${usuario}@${DOMINIO}`, password: clave, email_confirm: true, user_metadata: { nombre, usuario },
  });
  if (error || !creado.user) {
    const msg = /already|registered|exists/i.test(error?.message ?? '') ? 'Ese usuario ya existe.' : error?.message ?? 'No se pudo crear';
    return responder({ error: msg }, 400);
  }
  const { error: e2 } = await admin.from('perfil').insert({
    id: creado.user.id, usuario, nombre, correo: b.correo ? String(b.correo) : null, rol, hh_semana: hh, activo: true,
  });
  if (e2) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return responder({ error: e2.message }, 400);
  }
  return responder({ ok: true, id: creado.user.id });
});
