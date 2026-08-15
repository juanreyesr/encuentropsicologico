import { isEventAdmin } from "../../../../lib/admin";
import { CERTIFICATE_TYPES, type CertificateType } from "../../../../lib/certificate-template";
import { controlsToColumns, loadEventControls, normalizeEventControls, type EventControls } from "../../../../lib/event-controls";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type RegistrationRow = { modality: string; status: string; event_roles: string[] | null; attendance_verified_at: string | null };

// Diplomas ya emitidos, separados por el modelo que le tocó a cada persona.
async function certificateMetrics(eligible: number) {
  const response = await supabaseServerFetch("encuentro_psicologico_certificates?select=certificate_type,issued_at&issued_at=not.is.null&order=issued_at.desc");
  const rows = response.ok ? await response.json() as Array<{ certificate_type: string; issued_at: string }> : [];
  const byType = Object.fromEntries(CERTIFICATE_TYPES.map(type => [type, 0])) as Record<CertificateType, number>;
  rows.forEach(row => { if (CERTIFICATE_TYPES.includes(row.certificate_type as CertificateType)) byType[row.certificate_type as CertificateType] += 1; });
  return { issued: rows.length, byType, lastIssuedAt: rows[0]?.issued_at ?? null, pending: Math.max(0, eligible - rows.length) };
}

async function metrics() {
  const [registrationsResponse, questionsResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_registrations?select=modality,status,event_roles,attendance_verified_at&status=eq.confirmed"),
    supabaseServerFetch("encuentro_psicologico_speaker_questions?select=id", { headers: { Prefer: "count=exact", Range: "0-0" } }),
  ]);
  const registrations = registrationsResponse.ok ? await registrationsResponse.json() as RegistrationRow[] : [];
  const verified = registrations.filter(item => item.attendance_verified_at);
  const organizers = registrations.filter(item => item.event_roles?.includes("organizer"));
  return {
    confirmed: registrations.length,
    verified: verified.length,
    presencial: verified.filter(item => item.modality === "presencial").length,
    virtual: verified.filter(item => item.modality === "virtual").length,
    pending: registrations.length - verified.length,
    organizers: organizers.length,
    organizersVerified: organizers.filter(item => item.attendance_verified_at).length,
    speakers: registrations.filter(item => item.event_roles?.includes("speaker")).length,
    questions: questionsResponse.ok ? Number(questionsResponse.headers.get("content-range")?.split("/")[1] ?? 0) : 0,
  };
}

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [controls, counts] = await Promise.all([loadEventControls(), metrics()]);
  const certificates = await certificateMetrics(counts.verified);
  return Response.json({ controls, metrics: counts, certificates });
}

// Suspender todo deja la jornada cerrada de inmediato sin borrar ningún dato:
// las asistencias ya verificadas y las preguntas recibidas se conservan.
const SUSPEND_ALL: Partial<EventControls> = {
  attendanceEnabled: false,
  questionsEnabled: false,
  certificatesEnabled: false,
  materialsMode: "closed",
  libraryEnabled: false,
};

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as Partial<EventControls> & { action?: string };
  const changes = controlsToColumns(body.action === "suspendAll" ? SUSPEND_ALL : body);
  if (!Object.keys(changes).length) return Response.json({ error: "No se recibió ningún cambio." }, { status: 400 });
  const response = await supabaseServerFetch("encuentro_psicologico_event_settings?id=eq.true", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar el control del evento." }, { status: 503 });
  const [row] = await response.json() as Array<Record<string, unknown>>;
  return Response.json({ controls: normalizeEventControls(row) });
}
