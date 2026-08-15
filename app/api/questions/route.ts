import { currentUser } from "../../../lib/auth";
import { loadEventControls } from "../../../lib/event-controls";
import { supabaseServerFetch } from "../../../lib/supabase-server";

type Program = { id: number; start_time: string; end_time: string; type: string; title: string };
type Assignment = { user_id: string; name: string; speaker_program_item_id: number | null; event_roles: string[] | null };
type StoredQuestion = { id: number; asker_user_id: string; speaker_user_id: string; program_item_id: number; question: string; speaker_rating: number; event_rating: number; is_favorite: boolean; answer: string | null; answered_at: string | null; wants_future_event: boolean | null; future_topic: string | null; created_at: string };

const QUESTION_COLUMNS = "id,asker_user_id,speaker_user_id,program_item_id,question,speaker_rating,event_rating,is_favorite,answer,answered_at,wants_future_event,future_topic,created_at";

function hasSpeakerRole(assignment: Assignment) { return (assignment.event_roles ?? []).includes("speaker") && Number.isInteger(assignment.speaker_program_item_id); }
function score(value: unknown) { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 5; }

async function askerNames(ids: string[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<string, string>();
  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=user_id,name&user_id=in.(${unique.map(encodeURIComponent).join(",")})`);
  if (!response.ok) return new Map<string, string>();
  const rows = await response.json() as Array<{ user_id: string; name: string }>;
  return new Map(rows.map(row => [row.user_id, row.name]));
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Inicia sesión para usar las preguntas." }, { status: 401 });
  const [controls, assignmentsResponse, programResponse] = await Promise.all([
    loadEventControls(),
    supabaseServerFetch("encuentro_psicologico_registrations?select=user_id,name,speaker_program_item_id,event_roles&event_roles=cs.%7Bspeaker%7D&speaker_program_item_id=not.is.null"),
    supabaseServerFetch("encuentro_psicologico_program?select=id,start_time,end_time,type,title&is_published=eq.true&order=display_order.asc"),
  ]);
  if (!assignmentsResponse.ok || !programResponse.ok) return Response.json({ error: "No se pudo cargar el espacio de preguntas." }, { status: 503 });
  const assignments = (await assignmentsResponse.json() as Assignment[]).filter(hasSpeakerRole);
  const program = await programResponse.json() as Program[];
  // Cada conferencia se ofrece con el nombre de quien la imparte, para que la
  // pregunta se dirija a una persona y no solo a un bloque del programa.
  const availableProgram = program.flatMap(item => {
    const assignment = assignments.find(entry => entry.speaker_program_item_id === item.id);
    return assignment ? [{ ...item, speakerName: assignment.name }] : [];
  });
  const mine = assignments.filter(item => item.user_id === user.id).map(item => item.speaker_program_item_id as number);

  // La bandeja se arma con las preguntas que ya llevan el nombre de la persona,
  // sin depender de que siga asignada a una conferencia en el panel: quien
  // recibió preguntas las sigue viendo y respondiendo siempre.
  const [inboxResponse, askedResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_speaker_questions?select=${QUESTION_COLUMNS}&speaker_user_id=eq.${encodeURIComponent(user.id)}&order=is_favorite.desc,created_at.asc`),
    supabaseServerFetch(`encuentro_psicologico_speaker_questions?select=${QUESTION_COLUMNS}&asker_user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`),
  ]);
  const inboxRows = inboxResponse.ok ? await inboxResponse.json() as StoredQuestion[] : [];
  const askedRows = askedResponse.ok ? await askedResponse.json() as StoredQuestion[] : [];
  const names = await askerNames(inboxRows.map(row => row.asker_user_id));
  const speakerNameById = new Map(assignments.map(item => [item.speaker_program_item_id as number, item.name]));

  return Response.json({
    enabled: controls.questionsEnabled,
    programs: availableProgram,
    // Los títulos de todo el programa, para nombrar bien cada pregunta aunque
    // su conferencia ya no aparezca en la lista para preguntar.
    programTitles: Object.fromEntries(program.map(item => [item.id, item.title])),
    assignedProgramIds: mine,
    inbox: inboxRows.map(row => ({ ...row, askerName: names.get(row.asker_user_id) ?? "Participante" })),
    asked: askedRows.map(row => ({ ...row, speakerName: speakerNameById.get(row.program_item_id) ?? "Ponente" })),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Inicia sesión para enviar una pregunta." }, { status: 401 });
  const body = await request.json() as { programItemId?: number; question?: string; speakerRating?: number; eventRating?: number; wantsFutureEvent?: boolean | null; futureTopic?: string };
  const question = String(body.question ?? "").trim();
  const programItemId = Number(body.programItemId);
  if (!Number.isInteger(programItemId) || question.length < 5 || question.length > 1400) return Response.json({ error: "Escribe una pregunta de entre 5 y 1,400 caracteres y selecciona una conferencia." }, { status: 400 });
  const [controls, assignmentResponse] = await Promise.all([
    loadEventControls(),
    supabaseServerFetch(`encuentro_psicologico_registrations?select=user_id,name,event_roles,speaker_program_item_id&speaker_program_item_id=eq.${programItemId}&event_roles=cs.%7Bspeaker%7D&limit=1`),
  ]);
  if (!controls.questionsEnabled) return Response.json({ error: "Las preguntas todavía no están habilitadas." }, { status: 403 });
  const [assignment] = assignmentResponse.ok ? await assignmentResponse.json() as Assignment[] : [];
  if (!assignment || !hasSpeakerRole(assignment)) return Response.json({ error: "Esta conferencia aún no tiene un ponente habilitado para recibir preguntas." }, { status: 400 });
  const futureTopic = body.wantsFutureEvent === true ? String(body.futureTopic ?? "").trim().slice(0, 600) || null : null;
  const response = await supabaseServerFetch("encuentro_psicologico_speaker_questions?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ asker_user_id: user.id, speaker_user_id: assignment.user_id, program_item_id: programItemId, question, speaker_rating: score(body.speakerRating), event_rating: score(body.eventRating), wants_future_event: typeof body.wantsFutureEvent === "boolean" ? body.wantsFutureEvent : null, future_topic: futureTopic }) });
  if (!response.ok) return Response.json({ error: "No se pudo enviar la pregunta." }, { status: 503 });
  return Response.json({ ok: true, question: (await response.json())[0] });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const { id, favorite, answer } = await request.json() as { id?: number; favorite?: boolean; answer?: string };
  if (!Number.isInteger(Number(id))) return Response.json({ error: "Pregunta inválida." }, { status: 400 });

  const changes: Record<string, unknown> = {};
  if (typeof favorite === "boolean") {
    changes.is_favorite = favorite;
    changes.favorited_at = favorite ? new Date().toISOString() : null;
  }
  // La respuesta directa la escribe el ponente; vaciarla retira lo enviado.
  if (typeof answer === "string") {
    const text = answer.trim();
    if (text && (text.length < 2 || text.length > 1400)) return Response.json({ error: "La respuesta debe tener entre 2 y 1,400 caracteres." }, { status: 400 });
    changes.answer = text || null;
    changes.answered_at = text ? new Date().toISOString() : null;
  }
  if (!Object.keys(changes).length) return Response.json({ error: "No se recibió ningún cambio." }, { status: 400 });

  const response = await supabaseServerFetch(`encuentro_psicologico_speaker_questions?id=eq.${Number(id)}&speaker_user_id=eq.${encodeURIComponent(user.id)}&select=${QUESTION_COLUMNS}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(changes) });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar la pregunta." }, { status: 503 });
  const [question] = await response.json() as StoredQuestion[];
  if (!question) return Response.json({ error: "No tienes permiso para editar esta pregunta." }, { status: 403 });
  return Response.json({ ok: true, question });
}
