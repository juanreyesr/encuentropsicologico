import { isEventAdmin } from "../../../../lib/admin";
import { type EventProgramItem } from "../../../../lib/event";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

const fields = "id,start_time,end_time,type,title,description,details,display_order,is_published";
const allowed = ["start_time", "end_time", "type", "title", "description", "details", "display_order", "is_published"] as const;

function clean(input: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in input)) continue;
    if (key === "display_order") result[key] = Number(input[key]) || 0;
    else if (key === "is_published") result[key] = Boolean(input[key]);
    else result[key] = String(input[key] ?? "").trim();
  }
  return result;
}

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const response = await supabaseServerFetch(`encuentro_psicologico_program?select=${fields}&order=display_order.asc,id.asc`);
  if (!response.ok) return Response.json({ error: "No se pudo cargar el programa." }, { status: 503 });
  return Response.json({ program: await response.json() as EventProgramItem[] });
}

export async function POST(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const data = clean(await request.json());
  if (typeof data.title !== "string" || data.title.length < 2) return Response.json({ error: "Escribe el nombre del bloque." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_program?select=${fields}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) });
  if (!response.ok) return Response.json({ error: "No se pudo crear el bloque." }, { status: 503 });
  return Response.json({ item: (await response.json() as EventProgramItem[])[0] });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ error: "Bloque inválido." }, { status: 400 });
  const data = { ...clean(body), updated_at: new Date().toISOString() };
  const response = await supabaseServerFetch(`encuentro_psicologico_program?id=eq.${id}&select=${fields}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(data) });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar el bloque." }, { status: 503 });
  return Response.json({ item: (await response.json() as EventProgramItem[])[0] });
}

export async function DELETE(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Bloque inválido." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_program?id=eq.${id}`, { method: "DELETE" });
  if (!response.ok) return Response.json({ error: "No se pudo eliminar el bloque." }, { status: 503 });
  return Response.json({ ok: true });
}
