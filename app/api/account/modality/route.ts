import { currentUser } from "../../../../lib/auth";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Inicia sesión para actualizar tu modalidad." }, { status: 401 });
  let modality = "virtual";
  try { const body = await request.json() as { modality?: string }; modality = body.modality ?? modality; } catch { /* compatibility with the former form action */ }
  if (modality !== "presencial" && modality !== "virtual") return Response.json({ error: "Modalidad no válida." }, { status: 400 });

  const response = await supabaseServerFetch("rpc/encuentro_psicologico_change_modality", {
    method: "POST",
    body: JSON.stringify({ p_user_id: user.id, p_modality: modality }),
  });
  if (!response.ok) return Response.json({ error: "No fue posible actualizar la modalidad." }, { status: 503 });
  const result = await response.json() as { status?: string; available?: number };
  if (result.status === "full") return Response.json({ error: "El cupo presencial está lleno. Puedes mantener tu asistencia virtual y volver a intentarlo si se libera un espacio.", available: 0 }, { status: 409 });
  if (result.status === "not_found") return Response.json({ error: "No encontramos una inscripción activa." }, { status: 404 });
  return Response.json({ ok: true, ...result });
}
