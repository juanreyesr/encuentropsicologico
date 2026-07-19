import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type Signature = { name?: string; role?: string; image_url?: string };
type Settings = {
  id?: boolean; event_name: string; event_date: string; event_place: string;
  professional_title: string; general_title: string; professional_body: string; general_body: string;
  signatures: Signature[]; sponsor_logos: string[];
};

const fields = "event_name,event_date,event_place,professional_title,general_title,professional_body,general_body,signatures,sponsor_logos,updated_at";

function cleanString(value: unknown, max = 500) { return String(value ?? "").trim().slice(0, max); }
function sanitizeSignatures(value: unknown): Signature[] {
  const entries = Array.isArray(value) ? value.slice(0, 2) : [];
  return [0, 1].map(index => {
    const entry = entries[index] && typeof entries[index] === "object" ? entries[index] as Record<string, unknown> : {};
    return { name: cleanString(entry.name, 100), role: cleanString(entry.role, 100), image_url: cleanString(entry.image_url, 800) };
  });
}

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const response = await supabaseServerFetch(`encuentro_psicologico_certificate_settings?select=${fields}&id=eq.true&limit=1`);
  if (!response.ok) return Response.json({ error: "No se pudo cargar el diploma." }, { status: 503 });
  const [settings] = await response.json();
  return Response.json({ settings });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as Partial<Settings>;
  const settings = {
    event_name: cleanString(body.event_name, 220), event_date: cleanString(body.event_date, 120), event_place: cleanString(body.event_place, 160),
    professional_title: cleanString(body.professional_title, 160), general_title: cleanString(body.general_title, 160),
    professional_body: cleanString(body.professional_body, 700), general_body: cleanString(body.general_body, 700),
    signatures: sanitizeSignatures(body.signatures),
    sponsor_logos: Array.isArray(body.sponsor_logos) ? body.sponsor_logos.map(item => cleanString(item, 800)).filter(Boolean).slice(0, 12) : [],
    updated_at: new Date().toISOString(),
  };
  if (!settings.event_name || !settings.event_date || !settings.professional_title || !settings.general_title) return Response.json({ error: "Completa el nombre, la fecha y ambos títulos." }, { status: 400 });
  const response = await supabaseServerFetch("encuentro_psicologico_certificate_settings?id=eq.true", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(settings) });
  if (!response.ok) return Response.json({ error: "No se pudo guardar el diploma." }, { status: 503 });
  return Response.json({ settings: (await response.json())[0] });
}
