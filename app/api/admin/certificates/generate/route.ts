import { isEventAdmin } from "../../../../../lib/admin";
import { CERTIFICATE_TYPES, type CertificateType } from "../../../../../lib/certificate-template";
import { supabaseServerFetch } from "../../../../../lib/supabase-server";

const SETTINGS_COLUMNS = "event_name,event_date,event_place,professional_title,general_title,speaker_title,organizer_title,professional_body,general_body,speaker_body,organizer_body,signatures,sponsor_logos,seal_url,seal_enabled,seal_left_url,seal_left_enabled";
const ELIGIBLE_FILTER = "status=eq.confirmed&user_id=not.is.null&attendance_verified_at=not.is.null";
const DEFAULT_BATCH = 40;
const MAX_BATCH = 100;

type Registration = { id: number; user_id: string; attendee_type: string; event_roles: string[] | null };
type Counts = Record<CertificateType, number>;

const emptyCounts = (): Counts => ({ professional: 0, general: 0, speaker: 0, organizer: 0 });

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

function totalFrom(response: Response) {
  return Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
}

async function eligibleTotal() {
  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id&${ELIGIBLE_FILTER}`, { headers: { Prefer: "count=exact", Range: "0-0" } });
  return response.ok ? totalFrom(response) : 0;
}

async function issuedCounts() {
  const response = await supabaseServerFetch("encuentro_psicologico_certificates?select=certificate_type&issued_at=not.is.null");
  if (!response.ok) return { total: 0, byType: emptyCounts() };
  const rows = await response.json() as Array<{ certificate_type: string }>;
  const byType = emptyCounts();
  rows.forEach(row => { if (CERTIFICATE_TYPES.includes(row.certificate_type as CertificateType)) byType[row.certificate_type as CertificateType] += 1; });
  return { total: rows.length, byType };
}

// El panel consulta el plan antes de emitir para saber contra cuántas personas
// se mide el avance.
export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [total, issued] = await Promise.all([eligibleTotal(), issuedCounts()]);
  return Response.json({ eligible: total, issued: issued.total, byType: issued.byType, batchSize: DEFAULT_BATCH });
}

export async function POST(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { offset?: number; limit?: number };
  const offset = Number.isInteger(body.offset) && body.offset! >= 0 ? body.offset! : 0;
  const limit = Number.isInteger(body.limit) && body.limit! > 0 ? Math.min(body.limit!, MAX_BATCH) : null;

  const [settingsResponse, registrationsResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_certificate_settings?select=${SETTINGS_COLUMNS}&id=eq.true&limit=1`),
    supabaseServerFetch(
      `encuentro_psicologico_registrations?select=id,user_id,attendee_type,event_roles&${ELIGIBLE_FILTER}&order=id.asc${limit ? `&offset=${offset}&limit=${limit}` : ""}`,
      { headers: { Prefer: "count=exact" } },
    ),
  ]);
  if (!settingsResponse.ok || !registrationsResponse.ok) return Response.json({ error: "No se pudieron preparar los diplomas." }, { status: 503 });
  const [settings] = await settingsResponse.json() as Array<Record<string, unknown>>;
  const registrations = await registrationsResponse.json() as Registration[];
  const total = totalFrom(registrationsResponse) || registrations.length;

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

  if (rows.length) {
    const response = await supabaseServerFetch("encuentro_psicologico_certificates?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    if (!response.ok) return Response.json({ error: "No se pudieron emitir los diplomas." }, { status: 503 });
  }

  const byType = emptyCounts();
  rows.forEach(row => { byType[row.certificate_type] += 1; });
  const processed = offset + rows.length;
  return Response.json({
    ok: true,
    generated: rows.length,
    processed,
    total,
    done: !limit || rows.length < limit || processed >= total,
    byType,
    message: total === 0 ? "Aún no hay asistencias verificadas. Activa y completa el control de asistencia antes de emitir diplomas." : undefined,
  });
}
