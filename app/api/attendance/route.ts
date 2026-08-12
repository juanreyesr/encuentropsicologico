import { currentUser } from "../../../lib/auth";
import { accountModules, isEventOrganizer, loadEventControls } from "../../../lib/event-controls";
import { supabaseServerFetch } from "../../../lib/supabase-server";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const ORGANIZER_FILTER = "event_roles=cs.%7Borganizer%7D";

async function context() {
  const user = await currentUser();
  if (!user) return null;
  const [controls, organizer] = await Promise.all([loadEventControls(), isEventOrganizer(user.id)]);
  return { user, controls, organizer, modules: accountModules(controls, organizer) };
}

export async function GET() {
  const state = await context();
  if (!state) return Response.json({ error: "Inicia sesión para verificar asistencia." }, { status: 401 });
  const registrationResponse = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id,modality,status,attendance_verified_at&user_id=eq.${encodeURIComponent(state.user.id)}&limit=1`);
  const [registration] = registrationResponse.ok ? await registrationResponse.json() as Array<{ id: number; modality: string; status: string; attendance_verified_at?: string | null }> : [];
  return Response.json({
    enabled: state.modules.attendance.enabled,
    preview: state.modules.attendance.preview,
    organizer: state.organizer,
    kiosk: state.modules.kiosk.enabled,
    selfCheckin: state.modules.selfCheckin.enabled,
    organizersOnly: state.controls.attendanceOrganizersOnly,
    registration: registration ?? null,
  });
}

async function markAttendance(registration: { id: number; user_id?: string | null; name: string; modality: string; attendance_verified_at?: string | null }, method: "kiosk" | "virtual_self", verifierId?: string) {
  if (registration.attendance_verified_at) return { alreadyVerified: true, name: registration.name, modality: registration.modality };
  const now = new Date().toISOString();
  const update = await supabaseServerFetch(`encuentro_psicologico_registrations?id=eq.${registration.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ attendance_verified_at: now, attendance_verification_method: method, attendance_verified_by: verifierId ?? null }) });
  if (!update.ok) throw new Error("No fue posible guardar la asistencia.");
  if (registration.user_id) await supabaseServerFetch(`encuentro_psicologico_certificates?user_id=eq.${encodeURIComponent(registration.user_id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ attendance_confirmed: true, updated_at: now }) });
  return { alreadyVerified: false, name: registration.name, modality: registration.modality };
}

export async function POST(request: Request) {
  const state = await context();
  if (!state) return Response.json({ error: "Inicia sesión para verificar asistencia." }, { status: 401 });
  if (!state.modules.attendance.enabled) {
    return Response.json({ error: state.controls.attendanceEnabled ? "La verificación de asistencia está abierta solo para el equipo organizador." : "La verificación de asistencia aún no está habilitada." }, { status: 403 });
  }
  const body = await request.json() as { action?: string; phone?: string };

  if (body.action === "virtual") {
    if (!state.modules.selfCheckin.enabled) return Response.json({ error: "La autoconfirmación de participantes virtuales está suspendida." }, { status: 403 });
    const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id,user_id,name,modality,attendance_verified_at&user_id=eq.${encodeURIComponent(state.user.id)}&modality=eq.virtual&status=eq.confirmed&limit=1`);
    if (!response.ok) return Response.json({ error: "No encontramos una inscripción virtual confirmada en esta cuenta." }, { status: 404 });
    const [registration] = await response.json() as Array<{ id: number; user_id: string; name: string; modality: string; attendance_verified_at?: string | null }>;
    if (!registration) return Response.json({ error: "No encontramos una inscripción virtual confirmada en esta cuenta." }, { status: 404 });
    try { return Response.json({ ok: true, ...(await markAttendance(registration, "virtual_self")) }); }
    catch { return Response.json({ error: "No fue posible registrar tu asistencia." }, { status: 503 }); }
  }

  if (body.action === "kiosk") {
    if (!state.organizer) return Response.json({ error: "Solo organizadores asignados pueden usar el modo kiosko." }, { status: 403 });
    if (!state.modules.kiosk.enabled) return Response.json({ error: "El modo kiosko está suspendido por la organización." }, { status: 403 });
    const phone = digits(body.phone);
    if (phone.length < 8) return Response.json({ error: "Ingresa un número de teléfono válido." }, { status: 400 });
    // Mientras la verificación esté abierta solo para la organización, el kiosko
    // encuentra únicamente a organizadores: así su asistencia queda registrada
    // desde el montaje sin tocar la de los participantes.
    const restricted = state.controls.attendanceOrganizersOnly ? `&${ORGANIZER_FILTER}` : "";
    const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id,user_id,name,modality,attendance_verified_at&phone=eq.${encodeURIComponent(phone)}&modality=eq.presencial&status=eq.confirmed${restricted}&limit=1`);
    if (!response.ok) return Response.json({ error: "No fue posible buscar la inscripción." }, { status: 503 });
    const [registration] = await response.json() as Array<{ id: number; user_id: string; name: string; modality: string; attendance_verified_at?: string | null }>;
    if (!registration) return Response.json({ error: restricted ? "Mientras la verificación esté abierta solo para la organización, únicamente puedes verificar a organizadores con inscripción presencial confirmada." : "No encontramos una inscripción presencial confirmada con ese número." }, { status: 404 });
    try { return Response.json({ ok: true, ...(await markAttendance(registration, "kiosk", state.user.id)) }); }
    catch { return Response.json({ error: "No fue posible registrar la asistencia." }, { status: 503 }); }
  }
  return Response.json({ error: "Acción de verificación no reconocida." }, { status: 400 });
}
