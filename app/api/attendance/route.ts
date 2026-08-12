import { currentUser } from "../../../lib/auth";
import { supabaseServerFetch } from "../../../lib/supabase-server";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const ORGANIZER_FILTER = "event_roles=cs.%7Borganizer%7D";

type EventSettings = { attendance_verification_enabled: boolean; attendance_verification_organizers_only: boolean };

async function settings(): Promise<EventSettings | null> {
  const response = await supabaseServerFetch("encuentro_psicologico_event_settings?select=attendance_verification_enabled,attendance_verification_organizers_only&id=eq.true&limit=1");
  if (!response.ok) return null;
  const [result] = await response.json() as EventSettings[];
  return result ?? { attendance_verification_enabled: false, attendance_verification_organizers_only: false };
}

async function isOrganizer(userId: string) {
  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id&user_id=eq.${encodeURIComponent(userId)}&${ORGANIZER_FILTER}&status=eq.confirmed&limit=1`);
  if (!response.ok) return false;
  return (await response.json() as unknown[]).length > 0;
}

/**
 * Durante el ensayo previo al evento la verificación existe solo para la
 * organización: quien no tenga el rol no ve el módulo ni puede confirmarse.
 */
function availability(eventSettings: EventSettings | null, organizer: boolean) {
  const testMode = Boolean(eventSettings?.attendance_verification_organizers_only);
  const enabled = Boolean(eventSettings?.attendance_verification_enabled) && (!testMode || organizer);
  return { enabled, testMode };
}

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Inicia sesión para verificar asistencia." }, { status: 401 });
  const [eventSettings, organizer] = await Promise.all([settings(), isOrganizer(user.id)]);
  const { enabled, testMode } = availability(eventSettings, organizer);
  const registrationResponse = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id,modality,status,attendance_verified_at&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
  const [registration] = registrationResponse.ok ? await registrationResponse.json() as Array<{ id: number; modality: string; status: string; attendance_verified_at?: string | null }> : [];
  return Response.json({ enabled, testMode: enabled && testMode, organizer, registration: registration ?? null });
}

async function markAttendance(registration: { id: number; user_id?: string | null; name: string; modality: string; attendance_verified_at?: string | null }, method: "kiosk" | "virtual_self", options: { testMode: boolean; verifierId?: string }) {
  if (registration.attendance_verified_at) return { alreadyVerified: true, name: registration.name, modality: registration.modality };
  const now = new Date().toISOString();
  const update = await supabaseServerFetch(`encuentro_psicologico_registrations?id=eq.${registration.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ attendance_verified_at: now, attendance_verification_method: method, attendance_verified_by: options.verifierId ?? null, attendance_verified_in_test: options.testMode }) });
  if (!update.ok) throw new Error("No fue posible guardar la asistencia.");
  // Un ensayo nunca habilita diplomas: la constancia se libera solo con la
  // verificación real del día del evento.
  if (registration.user_id && !options.testMode) await supabaseServerFetch(`encuentro_psicologico_certificates?user_id=eq.${encodeURIComponent(registration.user_id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ attendance_confirmed: true, updated_at: now }) });
  return { alreadyVerified: false, name: registration.name, modality: registration.modality };
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Inicia sesión para verificar asistencia." }, { status: 401 });
  const [eventSettings, organizer] = await Promise.all([settings(), isOrganizer(user.id)]);
  const { enabled, testMode } = availability(eventSettings, organizer);
  if (!enabled) return Response.json({ error: eventSettings?.attendance_verification_enabled ? "La verificación de asistencia está en modo de pruebas para el equipo organizador." : "La verificación de asistencia aún no está habilitada." }, { status: 403 });
  const body = await request.json() as { action?: string; phone?: string };

  if (body.action === "virtual") {
    const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id,user_id,name,modality,attendance_verified_at&user_id=eq.${encodeURIComponent(user.id)}&modality=eq.virtual&status=eq.confirmed&limit=1`);
    if (!response.ok) return Response.json({ error: "No encontramos una inscripción virtual confirmada en esta cuenta." }, { status: 404 });
    const [registration] = await response.json() as Array<{ id: number; user_id: string; name: string; modality: string; attendance_verified_at?: string | null }>;
    if (!registration) return Response.json({ error: "No encontramos una inscripción virtual confirmada en esta cuenta." }, { status: 404 });
    try { return Response.json({ ok: true, testMode, ...(await markAttendance(registration, "virtual_self", { testMode })) }); }
    catch { return Response.json({ error: "No fue posible registrar tu asistencia." }, { status: 503 }); }
  }

  if (body.action === "kiosk") {
    if (!organizer) return Response.json({ error: "Solo organizadores asignados pueden usar el modo kiosko." }, { status: 403 });
    const phone = digits(body.phone);
    if (phone.length < 8) return Response.json({ error: "Ingresa un número de teléfono válido." }, { status: 400 });
    // En modo de pruebas el kiosko solo encuentra a la propia organización, así
    // ningún participante queda marcado como presente antes del evento.
    const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id,user_id,name,modality,attendance_verified_at&phone=eq.${encodeURIComponent(phone)}&modality=eq.presencial&status=eq.confirmed${testMode ? `&${ORGANIZER_FILTER}` : ""}&limit=1`);
    if (!response.ok) return Response.json({ error: "No fue posible buscar la inscripción." }, { status: 503 });
    const [registration] = await response.json() as Array<{ id: number; user_id: string; name: string; modality: string; attendance_verified_at?: string | null }>;
    if (!registration) return Response.json({ error: testMode ? "En modo de pruebas solo puedes verificar a organizadores con inscripción presencial confirmada." : "No encontramos una inscripción presencial confirmada con ese número." }, { status: 404 });
    try { return Response.json({ ok: true, testMode, ...(await markAttendance(registration, "kiosk", { testMode, verifierId: user.id })) }); }
    catch { return Response.json({ error: "No fue posible registrar la asistencia." }, { status: 503 }); }
  }
  return Response.json({ error: "Acción de verificación no reconocida." }, { status: 400 });
}
