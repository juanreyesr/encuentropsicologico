import { isEventAdmin } from "../../../../../lib/admin";
import type { CertificateType } from "../../../../../lib/certificate-template";
import { supabaseServerFetch } from "../../../../../lib/supabase-server";

const SETTINGS_COLUMNS = "event_name,event_date,event_place,professional_title,general_title,speaker_title,organizer_title,professional_body,general_body,speaker_body,organizer_body,signatures,sponsor_logos";

type Registration = { id: number; user_id: string; attendee_type: string; event_roles: string[] | null };

/**
 * La función dentro de la actividad manda sobre el perfil de inscripción: quien
 * expuso recibe el diploma de ponente y quien organizó, el de la organización.
 */
function typeForRegistration(registration: Registration): CertificateType {
  const roles = registration.event_roles ?? [];
  if (roles.includes("speaker")) return "speaker";
  if (roles.includes("organizer")) return "organizer";
  return registration.attendee_type === "professional" ? "professional" : "general";
}

export async function POST() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [settingsResponse, registrationsResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_certificate_settings?select=${SETTINGS_COLUMNS}&id=eq.true&limit=1`),
    supabaseServerFetch("encuentro_psicologico_registrations?select=id,user_id,attendee_type,event_roles&status=eq.confirmed&user_id=not.is.null&attendance_verified_at=not.is.null"),
  ]);
  if (!settingsResponse.ok || !registrationsResponse.ok) return Response.json({ error: "No se pudieron preparar los diplomas." }, { status: 503 });
  const [settings] = await settingsResponse.json() as Array<Record<string, unknown>>;
  const registrations = await registrationsResponse.json() as Registration[];
  const now = new Date().toISOString();
  const rows = registrations.map(registration => ({
    user_id: registration.user_id,
    certificate_number: `ECP-2026-${String(registration.id).padStart(5, "0")}`,
    certificate_type: typeForRegistration(registration),
    attendance_confirmed: true,
    issued_at: now,
    updated_at: now,
    template_snapshot: settings ?? {},
  }));
  if (!rows.length) return Response.json({ ok: true, generated: 0, message: "Aún no hay asistencias verificadas. Activa y completa el control de asistencia antes de emitir diplomas." });
  const response = await supabaseServerFetch("encuentro_psicologico_certificates?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
  if (!response.ok) return Response.json({ error: "No se pudieron emitir los diplomas." }, { status: 503 });
  const byType = rows.reduce<Record<string, number>>((total, row) => ({ ...total, [row.certificate_type]: (total[row.certificate_type] ?? 0) + 1 }), {});
  return Response.json({ ok: true, generated: rows.length, byType });
}
