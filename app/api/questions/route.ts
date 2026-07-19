import { currentUser } from "../../../lib/auth";
import { supabaseServerFetch } from "../../../lib/supabase-server";

type Program = { id: number; start_time: string; end_time: string; type: string; title: string };
type Assignment = { user_id: string; speaker_program_item_id: number | null; event_roles: string[] | null };

function hasSpeakerRole(assignment: Assignment) { return (assignment.event_roles ?? []).includes("speaker") && Number.isInteger(assignment.speaker_program_item_id); }
function score(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 5; }

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Inicia sesión para usar las preguntas." }, { status: 401 });
  const [settingsResponse, assignmentsResponse, programResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_event_settings?select=questions_enabled&id=eq.true&limit=1"),
    supabaseServerFetch("encuentro_psicologico_registrations?select=user_id,speaker_program_item_id,event_roles&event_roles=cs.%7Bspeaker%7D&speaker_program_item_id=not.is.null"),
    supabaseServerFetch("encuentro_psicologico_program?select=id,start_time,end_time,type,title&is_published=eq.true&order=display_order.asc"),
  ]);
  if (!settingsResponse.ok || !assignmentsResponse.ok || !programResponse.ok) return Response.json({ error: "No se pudo cargar el espacio de preguntas." }, { status: 503 });
  const [settings] = await settingsResponse.json() as Array<{ questions_enabled: boolean }>;
  const assignments = (await assignmentsResponse.json() as Assignment[]).filter(hasSpeakerRole);
  const program = await programResponse.json() as Program[];
  const speakingAssignments = assignments.filter(item => item.speaker_program_item_id !== null);
  const availableProgram = program.filter(item => speakingAssignments.some(assignment => assignment.speaker_program_item_id === item.id));
  const mine = speakingAssignments.filter(item => item.user_id === user.id).map(item => item.speaker_program_item_id as number);
  const inboxResponse = mine.length ? await supabaseServerFetch(`encuentro_psicologico_speaker_questions?select=id,program_item_id,question,speaker_rating,event_rating,is_favorite,created_at&speaker_user_id=eq.${encodeURIComponent(user.id)}&order=is_favorite.desc,created_at.asc`) : null;
  const inbox = inboxResponse?.ok ? await inboxResponse.json() : [];
  return Response.json({ enabled: Boolean(settings?.questions_enabled), programs: availableProgram, assignedProgramIds: mine, inbox });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Inicia sesión para enviar una pregunta." }, { status: 401 });
  const body = await request.json() as { programItemId?: number; question?: string; speakerRating?: number; eventRating?: number };
  const question = String(body.question ?? "").trim();
  const programItemId = Number(body.programItemId);
  if (!Number.isInteger(programItemId) || question.length < 5 || question.length > 1400) return Response.json({ error: "Escribe una pregunta de entre 5 y 1,400 caracteres y selecciona una conferencia." }, { status: 400 });
  const [settingsResponse, assignmentResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_event_settings?select=questions_enabled&id=eq.true&limit=1"),
    supabaseServerFetch(`encuentro_psicologico_registrations?select=user_id,event_roles,speaker_program_item_id&speaker_program_item_id=eq.${programItemId}&event_roles=cs.%7Bspeaker%7D&limit=1`),
  ]);
  const [settings] = settingsResponse.ok ? await settingsResponse.json() as Array<{ questions_enabled: boolean }> : [];
  if (!settings?.questions_enabled) return Response.json({ error: "Las preguntas todavía no están habilitadas." }, { status: 403 });
  const [assignment] = assignmentResponse.ok ? await assignmentResponse.json() as Assignment[] : [];
  if (!assignment || !hasSpeakerRole(assignment)) return Response.json({ error: "Esta conferencia aún no tiene un ponente habilitado para recibir preguntas." }, { status: 400 });
  const response = await supabaseServerFetch("encuentro_psicologico_speaker_questions?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ asker_user_id: user.id, speaker_user_id: assignment.user_id, program_item_id: programItemId, question, speaker_rating: score(body.speakerRating), event_rating: score(body.eventRating) }) });
  if (!response.ok) return Response.json({ error: "No se pudo enviar la pregunta." }, { status: 503 });
  return Response.json({ ok: true, question: (await response.json())[0] });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const { id, favorite } = await request.json() as { id?: number; favorite?: boolean };
  if (!Number.isInteger(Number(id))) return Response.json({ error: "Pregunta inválida." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_speaker_questions?id=eq.${Number(id)}&speaker_user_id=eq.${encodeURIComponent(user.id)}&select=id,is_favorite`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ is_favorite: Boolean(favorite), favorited_at: favorite ? new Date().toISOString() : null }) });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar la pregunta." }, { status: 503 });
  const [question] = await response.json();
  if (!question) return Response.json({ error: "No tienes permiso para editar esta pregunta." }, { status: 403 });
  return Response.json({ ok: true, question });
}
