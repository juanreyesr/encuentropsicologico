import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";
import type { EventSpeaker } from "../../../../lib/event";

const fields = "id,name,professional_title,talk_title,talk_time,program_item_id,bio,photo_url,video_url,contact_email,contact_phone,contact_website,display_order,is_published";
const allowed = ["name", "professional_title", "talk_title", "talk_time", "program_item_id", "bio", "photo_url", "video_url", "contact_email", "contact_phone", "contact_website", "display_order", "is_published"] as const;

function clean(input: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in input)) continue;
    if (key === "program_item_id") result[key] = input[key] ? Number(input[key]) : null;
    else if (key === "display_order") result[key] = Number(input[key]) || 0;
    else if (key === "is_published") result[key] = Boolean(input[key]);
    else result[key] = input[key];
  }
  return result;
}

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const response = await supabaseServerFetch(`encuentro_psicologico_speakers?select=${fields}&order=display_order.asc,id.asc`);
  if (!response.ok) return Response.json({ error: "No se pudieron cargar los ponentes." }, { status: 503 });
  return Response.json({ speakers: await response.json() as EventSpeaker[] });
}

export async function POST(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const data = clean(await request.json());
  if (typeof data.name !== "string" || data.name.trim().length < 2) return Response.json({ error: "Escribe el nombre del ponente." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_speakers?select=${fields}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) });
  if (!response.ok) return Response.json({ error: "No se pudo crear el ponente." }, { status: 503 });
  return Response.json({ speaker: (await response.json() as EventSpeaker[])[0] });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ error: "Ponente inválido." }, { status: 400 });
  const data = { ...clean(body), updated_at: new Date().toISOString() };
  const response = await supabaseServerFetch(`encuentro_psicologico_speakers?id=eq.${id}&select=${fields}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar el ponente." }, { status: 503 });
  return Response.json({ speaker: (await response.json() as EventSpeaker[])[0] });
}

export async function DELETE(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Ponente inválido." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_speakers?id=eq.${id}`, { method: "DELETE" });
  if (!response.ok) return Response.json({ error: "No se pudo eliminar el ponente." }, { status: 503 });
  return Response.json({ ok: true });
}
