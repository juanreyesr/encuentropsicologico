import { supabaseServerFetch } from "../../../lib/supabase-server";
export const dynamic = "force-dynamic";
export async function GET() {
  const response = await supabaseServerFetch("encuentro_psicologico_sponsors?select=id,name,description,website,logo_url,display_order&is_published=eq.true&order=display_order.asc,id.asc");
  if (!response.ok) return Response.json({ error: "No se pudieron cargar los patrocinadores." }, { status: 503 });
  return Response.json({ sponsors: await response.json() });
}
