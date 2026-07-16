import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

const fields = "id,user_id,modality,name,email,phone,attendee_type,profession,license,institution,country,department,status,professional_network_opt_in,created_at";
const allowed = ["modality", "name", "email", "phone", "attendee_type", "profession", "license", "institution", "country", "department", "status", "professional_network_opt_in"] as const;

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function clean(input: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in input)) continue;
    if (key === "phone" || key === "license") result[key] = digits(input[key]);
    else if (key === "professional_network_opt_in") result[key] = Boolean(input[key]);
    else if (key === "email") result[key] = String(input[key] ?? "").trim().toLowerCase();
    else result[key] = String(input[key] ?? "").trim();
  }
  return result;
}

async function cleanupProfileIfEmpty(userId?: string | null) {
  if (!userId) return;
  const remainingResponse = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  if (!remainingResponse.ok) return;
  const remaining = await remainingResponse.json() as Array<{ id: number }>;
  if (remaining.length > 0) return;
  await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_profiles?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }),
    supabaseServerFetch(`encuentro_psicologico_certificates?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }),
  ]);
}

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=${fields}&order=created_at.desc`);
  if (!response.ok) return Response.json({ error: "No se pudieron cargar los inscritos." }, { status: 503 });
  return Response.json({ registrations: await response.json() });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ error: "Inscripción inválida." }, { status: 400 });
  const data = clean(body);
  if (typeof data.name === "string" && data.name.length < 3) return Response.json({ error: "Escribe un nombre válido." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?id=eq.${id}&select=${fields}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar la inscripción." }, { status: 503 });
  const [registration] = await response.json() as Array<{ user_id?: string | null; name: string; phone: string; attendee_type: string; profession?: string; license?: string; institution?: string; country: string; department?: string; professional_network_opt_in?: boolean }>;
  if (registration?.user_id) {
    await supabaseServerFetch(`encuentro_psicologico_profiles?user_id=eq.${encodeURIComponent(registration.user_id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        full_name: registration.name,
        phone: registration.phone,
        attendee_type: registration.attendee_type,
        profession: registration.profession,
        license: registration.license,
        institution: registration.institution,
        country: registration.country,
        department: registration.department,
        professional_network_opt_in: Boolean(registration.professional_network_opt_in),
        updated_at: new Date().toISOString(),
      }),
    });
  }
  return Response.json({ registration });
}

export async function DELETE(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Inscripción inválida." }, { status: 400 });
  const existingResponse = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id,user_id&id=eq.${id}&limit=1`);
  if (!existingResponse.ok) return Response.json({ error: "No se pudo leer la inscripción." }, { status: 503 });
  const [existing] = await existingResponse.json() as Array<{ id: number; user_id?: string | null }>;
  if (!existing) return Response.json({ error: "La inscripción ya no existe." }, { status: 404 });
  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?id=eq.${id}`, { method: "DELETE" });
  if (!response.ok) return Response.json({ error: "No se pudo borrar la inscripción." }, { status: 503 });
  await cleanupProfileIfEmpty(existing.user_id);
  return Response.json({ ok: true });
}
