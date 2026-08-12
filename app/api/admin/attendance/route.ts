import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [settingsResponse, registrationsResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_event_settings?select=attendance_verification_enabled,attendance_verification_organizers_only,updated_at&id=eq.true&limit=1"),
    supabaseServerFetch("encuentro_psicologico_registrations?select=id,modality,attendance_verified_at&status=eq.confirmed"),
  ]);
  if (!settingsResponse.ok) return Response.json({ error: "No se pudo cargar el control de asistencia." }, { status: 503 });
  const [settings] = await settingsResponse.json() as Array<{ attendance_verification_enabled: boolean; attendance_verification_organizers_only: boolean; updated_at: string }>;
  const registrations = registrationsResponse.ok ? await registrationsResponse.json() as Array<{ modality: string; attendance_verified_at: string | null }> : [];
  const verified = registrations.filter(item => item.attendance_verified_at);
  return Response.json({
    settings: settings ?? { attendance_verification_enabled: false, attendance_verification_organizers_only: false },
    metrics: { verified: verified.length, presencial: verified.filter(item => item.modality === "presencial").length, virtual: verified.filter(item => item.modality === "virtual").length, pending: registrations.length - verified.length },
  });
}
