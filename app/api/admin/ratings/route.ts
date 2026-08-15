import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type Question = { id: number; program_item_id: number; speaker_rating: number; event_rating: number; is_favorite: boolean; answered_at: string | null; asker_user_id: string; wants_future_event: boolean | null; future_topic: string | null; created_at: string };
type ProgramItem = { id: number; title: string; start_time: string; end_time: string; display_order: number };
type Speaker = { name: string; speaker_program_item_id: number | null };

const EMPTY_DISTRIBUTION = [0, 0, 0, 0, 0];

function summarize(values: number[]) {
  const distribution = [...EMPTY_DISTRIBUTION];
  values.forEach(value => { if (value >= 1 && value <= 5) distribution[value - 1] += 1; });
  const count = values.length;
  const average = count ? Math.round((values.reduce((total, value) => total + value, 0) / count) * 10) / 10 : null;
  return { average, count, distribution };
}

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [questionsResponse, programResponse, speakersResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_speaker_questions?select=id,program_item_id,speaker_rating,event_rating,is_favorite,answered_at,asker_user_id,wants_future_event,future_topic,created_at&order=created_at.desc"),
    supabaseServerFetch("encuentro_psicologico_program?select=id,title,start_time,end_time,display_order&order=display_order.asc"),
    supabaseServerFetch("encuentro_psicologico_registrations?select=name,speaker_program_item_id&event_roles=cs.%7Bspeaker%7D&speaker_program_item_id=not.is.null"),
  ]);
  if (!questionsResponse.ok) return Response.json({ error: "No se pudieron cargar las valoraciones." }, { status: 503 });
  const questions = await questionsResponse.json() as Question[];
  const program = programResponse.ok ? await programResponse.json() as ProgramItem[] : [];
  const speakers = speakersResponse.ok ? await speakersResponse.json() as Speaker[] : [];
  const speakerByProgram = new Map(speakers.map(item => [item.speaker_program_item_id as number, item.name]));

  const byProgram = program
    .filter(item => speakerByProgram.has(item.id) || questions.some(question => question.program_item_id === item.id))
    .map(item => {
      const items = questions.filter(question => question.program_item_id === item.id);
      return {
        id: item.id,
        title: item.title,
        timeLabel: item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : "",
        speakerName: speakerByProgram.get(item.id) ?? "Sin ponente asignado",
        answered: items.filter(question => question.answered_at).length,
        favorites: items.filter(question => question.is_favorite).length,
        lastAt: items[0]?.created_at ?? null,
        ...summarize(items.map(question => question.speaker_rating)),
      };
    });

  // Interés en repetir la actividad: una respuesta por persona, la más reciente,
  // aunque haya enviado varias preguntas.
  const latestByPerson = new Map<string, boolean>();
  [...questions].reverse().forEach(question => {
    if (typeof question.wants_future_event === "boolean") latestByPerson.set(question.asker_user_id, question.wants_future_event);
  });
  const answers = [...latestByPerson.values()];
  const topics = questions
    .filter(question => question.future_topic && question.future_topic.trim())
    .map(question => ({ id: question.id, text: question.future_topic as string, createdAt: question.created_at }))
    .slice(0, 40);

  return Response.json({
    updatedAt: new Date().toISOString(),
    future: {
      answered: answers.length,
      yes: answers.filter(Boolean).length,
      no: answers.filter(value => !value).length,
      topics,
    },
    totals: {
      questions: questions.length,
      answered: questions.filter(question => question.answered_at).length,
      favorites: questions.filter(question => question.is_favorite).length,
      participants: new Set(questions.map(question => question.asker_user_id)).size,
      lastAt: questions[0]?.created_at ?? null,
    },
    event: summarize(questions.map(question => question.event_rating)),
    speakers: byProgram,
    recent: questions.slice(0, 8).map(question => ({
      id: question.id,
      title: program.find(item => item.id === question.program_item_id)?.title ?? "Conferencia",
      speakerName: speakerByProgram.get(question.program_item_id) ?? "Ponente",
      speakerRating: question.speaker_rating,
      eventRating: question.event_rating,
      createdAt: question.created_at,
    })),
  });
}
