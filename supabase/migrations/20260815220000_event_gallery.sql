-- Galería de fotografías del encuentro.
-- Las imágenes viven en el bucket de medios y aquí se guarda su orden, su pie
-- de foto y si están visibles en la página principal.
create table if not exists public.encuentro_psicologico_gallery (
  id bigint generated always as identity primary key,
  image_url text not null,
  caption text,
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.encuentro_psicologico_gallery enable row level security;
revoke all on public.encuentro_psicologico_gallery from anon, authenticated;
grant all on public.encuentro_psicologico_gallery to service_role;

create index if not exists encuentro_psicologico_gallery_public_idx
  on public.encuentro_psicologico_gallery (is_published, display_order, id);
