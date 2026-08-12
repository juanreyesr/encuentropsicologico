import { currentUser } from "../../../lib/auth";
import { youtubeVideoId } from "../../../lib/event";
import { supabaseServerFetch } from "../../../lib/supabase-server";

export const dynamic = "force-dynamic";

const PRIVATE_RESPONSE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/**
 * El enlace de la transmisión solo sale de aquí para cuentas del evento: el
 * sitio público únicamente sabe si la sala está abierta.
 */
export async function GET() {
  const user = await currentUser({ refresh: false });
  const response = await supabaseServerFetch("encuentro_psicologico_content?select=payload&id=eq.site&limit=1");
  const [row] = response.ok ? await response.json() as Array<{ payload: Record<string, unknown> }> : [];
  const payload = row?.payload ?? {};
  const live = Boolean(payload.live);
  if (!user) return Response.json({ live, authenticated: false }, { headers: PRIVATE_RESPONSE });

  const isAdmin = user.app_metadata?.encuentro_psicologico_role === "admin";
  if (!isAdmin) {
    const profileResponse = await supabaseServerFetch(`encuentro_psicologico_profiles?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
    const profiles = profileResponse.ok ? await profileResponse.json() as unknown[] : [];
    if (!profiles.length) return Response.json({ live, authenticated: false }, { headers: PRIVATE_RESPONSE });
  }

  return Response.json({
    live,
    authenticated: true,
    title: String(payload.liveTitle ?? "Encuentro en vivo"),
    videoId: live ? youtubeVideoId(payload.liveUrl) : null,
  }, { headers: PRIVATE_RESPONSE });
}
