import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [settingsResponse, registrationsResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_event_settings?select=attendance_verification_enabled,updated_at&id=eq.true&limit=1"),
    supabaseServerFetch("encuentro_psicologico_registrations?select=id,modality,attendance_verified_at&status=eq.confirmed"),
  ]);
  if (!settingsResponse.ok) return Response.json({ error: "No se pudo cargar el control de asistencia." }, { status: 503 });
  const [settings] = await settingsResponse.json() as Array<{ attendance_verification_enabled: boolean; updated_at: string }>;
  const registrations = registrationsResponse.ok ? await registrationsResponse.json() as Array<{ modality: string; attendance_verified_at: string | null }> : [];
  const verified = registrations.filter(item => item.attendance_verified_at);
  return Response.json({ settings: settings ?? { attendance_verification_enabled: false }, metrics: { verified: verified.length, presencial: verified.filter(item => item.modality === "presencial").length, virtual: verified.filter(item => item.modality === "virtual").length, pending: registrations.length - verified.length } });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const { attendanceEnabled } = await request.json() as { attendanceEnabled?: boolean };
  const response = await supabaseServerFetch("encuentro_psicologico_event_settings?id=eq.true", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ attendance_verification_enabled: Boolean(attendanceEnabled), updated_at: new Date().toISOString() }) });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar la verificación de asistencia." }, { status: 503 });
  return Response.json({ settings: (await response.json())[0] });
}
