import { supabaseServerFetch } from "../../../lib/supabase-server";

/** Fotografías visibles del encuentro, para el carrusel de la página principal. */
export const dynamic = "force-dynamic";

export async function GET() {
  const response = await supabaseServerFetch("encuentro_psicologico_gallery?select=id,image_url,caption&is_published=eq.true&order=display_order.asc,id.asc");
  if (!response.ok) return Response.json({ error: "No se pudo cargar la galería." }, { status: 503 });
  return Response.json({ photos: await response.json() });
}
