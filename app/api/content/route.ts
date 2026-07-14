import { supabaseServerFetch } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await supabaseServerFetch("encuentro_psicologico_content?select=payload&id=eq.site&limit=1");
  if (!response.ok) return Response.json({ error: "No se pudo cargar la información." }, { status: 503 });
  const [row] = await response.json() as Array<{ payload: Record<string, unknown> }>;
  const payload = row?.payload ?? {};
  return Response.json({ title: payload.title, date: payload.date, place: payload.place, description: payload.description, live: Boolean(payload.live) });
}
