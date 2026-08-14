import { isEventAdmin } from "../../../../lib/admin";
import { normalizeCertificateSettings, type CertificateSettings } from "../../../../lib/certificate-template";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

const fields = "event_name,event_date,event_place,professional_title,general_title,speaker_title,organizer_title,professional_body,general_body,speaker_body,organizer_body,signatures,sponsor_logos,seal_url,seal_enabled,seal_left_url,seal_left_enabled,updated_at";

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const response = await supabaseServerFetch(`encuentro_psicologico_certificate_settings?select=${fields}&id=eq.true&limit=1`);
  if (!response.ok) return Response.json({ error: "No se pudo cargar el diploma." }, { status: 503 });
  const [settings] = await response.json();
  return Response.json({ settings });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as CertificateSettings;
  const settings = {
    ...normalizeCertificateSettings(body),
    updated_at: new Date().toISOString(),
  };
  const response = await supabaseServerFetch("encuentro_psicologico_certificate_settings?id=eq.true", { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(settings) });
  if (!response.ok) return Response.json({ error: "No se pudo guardar el diploma." }, { status: 503 });
  return Response.json({ settings: (await response.json())[0] });
}
