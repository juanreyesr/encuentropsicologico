import { getChatGPTUser } from "../../../chatgpt-auth";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

async function authorized() { return Boolean(await getChatGPTUser()); }

export async function GET() {
  if (!await authorized()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const response = await supabaseServerFetch("encuentro_psicologico_content?select=payload,updated_at&id=eq.site&limit=1");
  if (!response.ok) return Response.json({ error: "No se pudo cargar el contenido" }, { status: 503 });
  const [row] = await response.json() as Array<{ payload: Record<string, unknown>; updated_at: string }>;
  return Response.json(row ? { ...row.payload, updatedAt: row.updated_at } : {});
}

export async function POST(request: Request) {
  if (!await authorized()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const payload = await request.json();
  const response = await supabaseServerFetch("encuentro_psicologico_content?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: "site", payload, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) return Response.json({ error: "No se pudo guardar el contenido" }, { status: 503 });
  return Response.json({ ok: true });
}
