import { currentUser } from "../../../../lib/auth";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const { name } = await request.json() as { name?: string };
  const cleanName = name?.trim();
  if (!cleanName || cleanName.length < 3) return Response.json({ error: "Escribe un nombre válido." }, { status: 400 });

  const [profileResponse, registrationsResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_profiles?user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ full_name: cleanName, updated_at: new Date().toISOString() }) }),
    supabaseServerFetch(`encuentro_psicologico_registrations?user_id=eq.${encodeURIComponent(user.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ name: cleanName }) }),
  ]);

  if (!profileResponse.ok || !registrationsResponse.ok) return Response.json({ error: "No se pudo actualizar el nombre." }, { status: 503 });
  return Response.json({ ok: true, name: cleanName });
}
