import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [settingsResponse, questionsResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_event_settings?select=questions_enabled,updated_at&id=eq.true&limit=1"),
    supabaseServerFetch("encuentro_psicologico_speaker_questions?select=id,program_item_id,speaker_rating,event_rating,is_favorite,created_at&order=created_at.desc"),
  ]);
  if (!settingsResponse.ok) return Response.json({ error: "No se pudo cargar el estado de preguntas." }, { status: 503 });
  const [settings] = await settingsResponse.json() as Array<{ questions_enabled: boolean; updated_at: string }>;
  const questions = questionsResponse.ok ? await questionsResponse.json() as Array<{ speaker_rating: number; event_rating: number; is_favorite: boolean }> : [];
  const average = (key: "speaker_rating" | "event_rating") => questions.length ? Math.round((questions.reduce((total, item) => total + item[key], 0) / questions.length) * 10) / 10 : null;
  return Response.json({ settings: settings ?? { questions_enabled: false }, metrics: { total: questions.length, favorites: questions.filter(item => item.is_favorite).length, speakerRating: average("speaker_rating"), eventRating: average("event_rating") } });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const { questionsEnabled } = await request.json() as { questionsEnabled?: boolean };
  const response = await supabaseServerFetch("encuentro_psicologico_event_settings?id=eq.true", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ questions_enabled: Boolean(questionsEnabled), updated_at: new Date().toISOString() }) });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar el acceso a preguntas." }, { status: 503 });
  return Response.json({ settings: (await response.json())[0] });
}
