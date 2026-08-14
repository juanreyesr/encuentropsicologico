-- Segundo sello del diploma.
-- `seal_url` / `seal_enabled` son el sello derecho, que monta sobre la mitad
-- derecha de la firma central; el nuevo par es el sello izquierdo, que se
-- coloca entre la firma izquierda y la central.
alter table public.encuentro_psicologico_certificate_settings
  add column if not exists seal_left_url text not null default '',
  add column if not exists seal_left_enabled boolean not null default false;
