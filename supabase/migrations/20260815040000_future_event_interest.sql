-- Cierre de la encuesta: interés en repetir la actividad y, si lo hay, el tema
-- que la persona propone. Ambos son opcionales, así que se guardan nulos
-- mientras nadie los conteste.
alter table public.encuentro_psicologico_speaker_questions
  add column if not exists wants_future_event boolean,
  add column if not exists future_topic text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'encuentro_psicologico_speaker_questions_future_topic_length') then
    alter table public.encuentro_psicologico_speaker_questions
      add constraint encuentro_psicologico_speaker_questions_future_topic_length
      check (future_topic is null or char_length(trim(future_topic)) between 3 and 600);
  end if;
end $$;

create index if not exists encuentro_psicologico_speaker_questions_future_idx
  on public.encuentro_psicologico_speaker_questions (wants_future_event)
  where wants_future_event is not null;
