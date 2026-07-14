import { supabaseServerFetch } from "../../../lib/supabase-server";
import type { EventSpeaker } from "../../../lib/event";

export const dynamic = "force-dynamic";

export async function GET() {
  const response = await supabaseServerFetch("encuentro_psicologico_speakers?select=id,name,professional_title,talk_title,talk_time,bio,photo_url,video_url,display_order,is_published&is_published=eq.true&order=display_order.asc,id.asc");
  if (!response.ok) return Response.json({ error: "No se pudieron cargar los ponentes." }, { status: 503 });
  return Response.json({ speakers: await response.json() as EventSpeaker[] });
}
