-- Explicit deny policies document that event-operation tables are only reached
-- through authenticated server routes using the Supabase secret key.

drop policy if exists "encuentro_psicologico_certificate_settings_server_only" on public.encuentro_psicologico_certificate_settings;
create policy "encuentro_psicologico_certificate_settings_server_only"
  on public.encuentro_psicologico_certificate_settings for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "encuentro_psicologico_event_settings_server_only" on public.encuentro_psicologico_event_settings;
create policy "encuentro_psicologico_event_settings_server_only"
  on public.encuentro_psicologico_event_settings for all to anon, authenticated
  using (false) with check (false);

drop policy if exists "encuentro_psicologico_speaker_questions_server_only" on public.encuentro_psicologico_speaker_questions;
create policy "encuentro_psicologico_speaker_questions_server_only"
  on public.encuentro_psicologico_speaker_questions for all to anon, authenticated
  using (false) with check (false);
