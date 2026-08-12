-- Ensayo de la verificación de asistencia antes del día del evento.
-- Con el modo de pruebas activo la verificación queda visible y operativa
-- únicamente para las personas con el rol "organizer"; el resto de inscritos
-- no ve el módulo ni puede confirmar su presencia.
alter table public.encuentro_psicologico_event_settings
  add column if not exists attendance_verification_organizers_only boolean not null default false;

-- Marca las asistencias registradas durante el ensayo para poder borrarlas
-- sin tocar los registros reales del 15 de agosto.
alter table public.encuentro_psicologico_registrations
  add column if not exists attendance_verified_in_test boolean not null default false;

create index if not exists encuentro_psicologico_registrations_attendance_test_idx
  on public.encuentro_psicologico_registrations (attendance_verified_in_test)
  where attendance_verified_in_test;
