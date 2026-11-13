-- Ejecutar UNA vez, después de crear el usuario en Authentication > Users > Add user
-- (correo: jvalles@bkl-mina-ll.app, marcar "Auto Confirm User").
insert into public.perfil (id, usuario, nombre, rol, hh_semana)
select id, 'jvalles', 'Junior Valles', 'admin', 0
from auth.users where email = 'jvalles@bkl-mina-ll.app'
on conflict (id) do update set rol = 'admin', activo = true;
