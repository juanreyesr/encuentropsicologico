import { currentUser } from "../../../lib/auth";
import { accountModules, isEventOrganizer, loadEventControls } from "../../../lib/event-controls";
import { supabaseServerFetch } from "../../../lib/supabase-server";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const ORGANIZER_FILTER = "event_roles=cs.%7Borganizer%7D";
const KIOSK_COLUMNS = "id,user_id,name,phone,modality,attendance_verified_at,attendee_type,institution,event_roles";

type KioskRegistration = {
  id: number;
  user_id: string | null;
  name: string;
  phone?: string | null;
  modality: string;
  attendance_verified_at?: string | null;
  attendee_type?: string | null;
  institution?: string | null;
  event_roles?: string[] | null;
};

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

// Mientras la verificación esté abierta solo para la organización, el kiosko
// encuentra únicamente a organizadores: así su asistencia queda registrada
// desde el montaje sin tocar la de los participantes.
// La búsqueda se hace con los últimos ocho dígitos: hay quienes se inscribieron
// escribiendo el código de país delante del número y así se encuentran igual,
// sin que la persona en la puerta tenga que adivinar cómo lo escribió.
async function findByPhone(phone: string, organizersOnly: boolean) {
  const restricted = organizersOnly ? `&${ORGANIZER_FILTER}` : "";
  const search = (filter: string) => supabaseServerFetch(`encuentro_psicologico_registrations?select=${KIOSK_COLUMNS}&${filter}&modality=eq.presencial&status=eq.confirmed${restricted}&order=id.asc&limit=6`);
  let response = await search(`phone=like.*${phone.slice(-8)}`);
  // Respaldo por número exacto: si la búsqueda por terminación no estuviera
  // disponible, la puerta sigue funcionando como antes en vez de quedarse sin
  // poder verificar a nadie.
  if (!response.ok) response = await search(`phone=eq.${encodeURIComponent(phone)}`);
  if (!response.ok) return { failed: true as const };
  return { failed: false as const, matches: await response.json() as KioskRegistration[] };
}

// Ficha que ve la persona organizadora antes de confirmar: lo justo para
// reconocer a quién tiene enfrente y distinguir entre coincidencias.
function kioskView(registration: KioskRegistration) {
  const roles = registration.event_roles ?? [];
  return {
    id: registration.id,
    name: registration.name,
    phone: registration.phone ?? null,
    modality: registration.modality,
    attendeeType: registration.attendee_type ?? null,
    institution: registration.institution ?? null,
    verifiedAt: registration.attendance_verified_at ?? null,
    alreadyVerified: Boolean(registration.attendance_verified_at),
    organizer: roles.includes("organizer"),
    speaker: roles.includes("speaker"),
  };
}

const NOT_FOUND = (restricted: boolean) => restricted
  ? "Mientras la verificación esté abierta solo para la organización, únicamente puedes verificar a organizadores con inscripción presencial confirmada."
  : "No encontramos una inscripción presencial confirmada con ese número.";

export async function POST(request: Request) {
  const state = await context();
  if (!state) return Response.json({ error: "Inicia sesión para verificar asistencia." }, { status: 401 });
  if (!state.modules.attendance.enabled) {
    return Response.json({ error: state.controls.attendanceEnabled ? "La verificación de asistencia está abierta solo para el equipo organizador." : "La verificación de asistencia aún no está habilitada." }, { status: 403 });
  }
  const body = await request.json() as { action?: string; phone?: string; registrationId?: number };

  if (body.action === "virtual") {
    if (!state.modules.selfCheckin.enabled) return Response.json({ error: "La autoconfirmación de participantes virtuales está suspendida." }, { status: 403 });
    const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id,user_id,name,modality,attendance_verified_at&user_id=eq.${encodeURIComponent(state.user.id)}&modality=eq.virtual&status=eq.confirmed&limit=1`);
    if (!response.ok) return Response.json({ error: "No encontramos una inscripción virtual confirmada en esta cuenta." }, { status: 404 });
    const [registration] = await response.json() as Array<{ id: number; user_id: string; name: string; modality: string; attendance_verified_at?: string | null }>;
    if (!registration) return Response.json({ error: "No encontramos una inscripción virtual confirmada en esta cuenta." }, { status: 404 });
    try { return Response.json({ ok: true, ...(await markAttendance(registration, "virtual_self")) }); }
    catch { return Response.json({ error: "No fue posible registrar tu asistencia." }, { status: 503 }); }
  }

  if (body.action === "lookup" || body.action === "kiosk") {
    if (!state.organizer) return Response.json({ error: "Solo organizadores asignados pueden usar el modo kiosko." }, { status: 403 });
    if (!state.modules.kiosk.enabled) return Response.json({ error: "El modo kiosko está suspendido por la organización." }, { status: 403 });
    const phone = digits(body.phone);
    if (phone.length < 8) return Response.json({ error: "Ingresa los últimos 8 dígitos del teléfono, al menos." }, { status: 400 });
    const restricted = state.controls.attendanceOrganizersOnly;
    const search = await findByPhone(phone, restricted);
    if (search.failed) return Response.json({ error: "No fue posible buscar la inscripción." }, { status: 503 });
    if (!search.matches.length) return Response.json({ error: NOT_FOUND(restricted) }, { status: 404 });

    // Consultar no escribe nada: solo muestra a quién se está por verificar. Si
    // el mismo final de número corresponde a más de una inscripción, se
    // devuelven todas para que la organización elija a la persona correcta.
    if (body.action === "lookup") return Response.json({ ok: true, matches: search.matches.map(kioskView) });

    // La confirmación exige que sea una de las fichas que se acaban de
    // encontrar, para que nunca se verifique a alguien distinto del que se vio
    // en pantalla.
    const target = body.registrationId
      ? search.matches.find(row => row.id === body.registrationId)
      : search.matches.length === 1 ? search.matches[0] : null;
    if (!target) {
      return Response.json({ error: search.matches.length > 1 ? "Ese número coincide con varias inscripciones. Consulta primero y elige a la persona." : "Los datos cambiaron desde la consulta. Vuelve a consultar el número antes de confirmar." }, { status: 409 });
    }
    try { return Response.json({ ok: true, registration: kioskView(target), ...(await markAttendance(target, "kiosk", state.user.id)) }); }
    catch { return Response.json({ error: "No fue posible registrar la asistencia." }, { status: 503 }); }
  }
  return Response.json({ error: "Acción de verificación no reconocida." }, { status: 400 });
}
