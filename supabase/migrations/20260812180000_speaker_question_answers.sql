-- El ponente puede responder directamente a quien le escribió: la respuesta
-- viaja con la pregunta y solo la ve quien la hizo.
alter table public.encuentro_psicologico_speaker_questions
  add column if not exists answer text,
  add column if not exists answered_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'encuentro_psicologico_speaker_questions_answer_length') then
    alter table public.encuentro_psicologico_speaker_questions
      add constraint encuentro_psicologico_speaker_questions_answer_length
      check (answer is null or char_length(trim(answer)) between 2 and 1400);
  end if;
end $$;

create index if not exists encuentro_psicologico_speaker_questions_answered_idx
  on public.encuentro_psicologico_speaker_questions (answered_at)
  where answered_at is not null;
