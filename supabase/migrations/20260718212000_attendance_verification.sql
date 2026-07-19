-- Attendance is recorded per event registration so certificates can be issued
-- only to people who were actually present, regardless of modality.
alter table public.encuentro_psicologico_registrations
  add column if not exists attendance_verified_at timestamptz,
  add column if not exists attendance_verification_method text,
  add column if not exists attendance_verified_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'encuentro_psicologico_registrations_attendance_method_check') then
    alter table public.encuentro_psicologico_registrations
      add constraint encuentro_psicologico_registrations_attendance_method_check
      check (attendance_verification_method is null or attendance_verification_method in ('kiosk', 'virtual_self'));
  end if;
end $$;

alter table public.encuentro_psicologico_event_settings
  add column if not exists attendance_verification_enabled boolean not null default false;

create index if not exists encuentro_psicologico_registrations_attendance_idx
  on public.encuentro_psicologico_registrations (attendance_verified_at)
  where attendance_verified_at is not null;
