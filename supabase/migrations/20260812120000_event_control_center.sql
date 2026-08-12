-- Centro de control del evento.
-- Cada función que vive el día de la jornada (asistencia, kiosko, preguntas,
-- diplomas, materiales y biblioteca) queda detrás de un interruptor propio para
-- que la organización pueda abrirla o suspenderla en cualquier momento.
alter table public.encuentro_psicologico_event_settings
  add column if not exists attendance_verification_organizers_only boolean not null default false,
  add column if not exists attendance_kiosk_enabled boolean not null default true,
  add column if not exists attendance_self_checkin_enabled boolean not null default true,
  add column if not exists certificates_enabled boolean not null default true,
  add column if not exists materials_mode text not null default 'auto',
  add column if not exists library_enabled boolean not null default true,
  add column if not exists organizer_preview_enabled boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'encuentro_psicologico_event_settings_materials_mode_check') then
    alter table public.encuentro_psicologico_event_settings
      add constraint encuentro_psicologico_event_settings_materials_mode_check
      check (materials_mode in ('auto', 'open', 'closed'));
  end if;
end $$;

-- Diplomas diferenciados por función dentro de la actividad: además del
-- profesional y el general, el equipo organizador y los ponentes reciben un
-- reconocimiento con su propio título y texto.
alter table public.encuentro_psicologico_certificate_settings
  add column if not exists speaker_title text not null default 'Diploma de reconocimiento a ponente',
  add column if not exists speaker_body text not null default 'Por compartir su experiencia clínica como ponente de la jornada y aportar al crecimiento profesional de la comunidad.',
  add column if not exists organizer_title text not null default 'Diploma de reconocimiento al equipo organizador',
  add column if not exists organizer_body text not null default 'Por su dedicación y trabajo en la organización de la jornada clínica, que hizo posible este encuentro.';

alter table public.encuentro_psicologico_certificates
  drop constraint if exists encuentro_psicologico_certificates_type_check;

alter table public.encuentro_psicologico_certificates
  add constraint encuentro_psicologico_certificates_type_check
  check (certificate_type in ('professional', 'general', 'speaker', 'organizer'));
