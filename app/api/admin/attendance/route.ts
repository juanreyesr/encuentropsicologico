import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

const SETTINGS_COLUMNS = "attendance_verification_enabled,attendance_verification_organizers_only,updated_at";

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [settingsResponse, registrationsResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_event_settings?select=${SETTINGS_COLUMNS}&id=eq.true&limit=1`),
    supabaseServerFetch("encuentro_psicologico_registrations?select=id,modality,attendance_verified_at,attendance_verified_in_test&status=eq.confirmed"),
  ]);
  if (!settingsResponse.ok) return Response.json({ error: "No se pudo cargar el control de asistencia." }, { status: 503 });
  const [settings] = await settingsResponse.json() as Array<{ attendance_verification_enabled: boolean; attendance_verification_organizers_only: boolean; updated_at: string }>;
  const registrations = registrationsResponse.ok ? await registrationsResponse.json() as Array<{ modality: string; attendance_verified_at: string | null; attendance_verified_in_test?: boolean }> : [];
  const verified = registrations.filter(item => item.attendance_verified_at);
  const tests = verified.filter(item => item.attendance_verified_in_test);
  return Response.json({
    settings: settings ?? { attendance_verification_enabled: false, attendance_verification_organizers_only: false },
    metrics: {
      verified: verified.length - tests.length,
      presencial: verified.filter(item => item.modality === "presencial" && !item.attendance_verified_in_test).length,
      virtual: verified.filter(item => item.modality === "virtual" && !item.attendance_verified_in_test).length,
      pending: registrations.length - verified.length,
      tests: tests.length,
    },
  });
}

// Borra únicamente lo registrado durante el ensayo: los diplomas nunca se
// habilitan en modo de pruebas, así que no hay nada más que revertir.
async function clearTestVerifications() {
  const response = await supabaseServerFetch("encuentro_psicologico_registrations?attendance_verified_in_test=is.true", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ attendance_verified_at: null, attendance_verification_method: null, attendance_verified_by: null, attendance_verified_in_test: false }) });
  if (!response.ok) return null;
  return (await response.json() as unknown[]).length;
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as { attendanceEnabled?: boolean; organizersOnly?: boolean; action?: string };

  if (body.action === "clearTests") {
    const cleared = await clearTestVerifications();
    if (cleared === null) return Response.json({ error: "No se pudieron borrar las verificaciones de prueba." }, { status: 503 });
    return Response.json({ ok: true, cleared });
  }

  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.attendanceEnabled === "boolean") changes.attendance_verification_enabled = body.attendanceEnabled;
  if (typeof body.organizersOnly === "boolean") changes.attendance_verification_organizers_only = body.organizersOnly;
  const response = await supabaseServerFetch("encuentro_psicologico_event_settings?id=eq.true", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(changes) });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar la verificación de asistencia." }, { status: 503 });
  return Response.json({ settings: (await response.json())[0] });
}
