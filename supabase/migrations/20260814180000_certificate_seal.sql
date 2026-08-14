-- Sello institucional de la firma central del diploma.
-- Se guarda aparte de las firmas para poder activarlo o retirarlo sin perder
-- la imagen cargada.
alter table public.encuentro_psicologico_certificate_settings
  add column if not exists seal_url text not null default '',
  add column if not exists seal_enabled boolean not null default false;
