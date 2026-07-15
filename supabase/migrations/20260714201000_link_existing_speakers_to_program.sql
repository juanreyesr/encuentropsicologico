update public.encuentro_psicologico_speakers speaker
set program_item_id = program.id,
    talk_time = program.start_time || '–' || program.end_time,
    updated_at = now()
from public.encuentro_psicologico_program program
where speaker.program_item_id is null
  and regexp_replace(coalesce(speaker.talk_time, ''), '[^0-9:]', '', 'g') = program.start_time || program.end_time;
