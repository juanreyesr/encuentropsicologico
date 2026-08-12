import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

function issueId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as { id?: number; status?: string };
  const id = issueId(body.id);
  if (!id) return Response.json({ error: "Reporte inválido." }, { status: 400 });
  if (body.status !== "open" && body.status !== "resolved") return Response.json({ error: "Estado inválido." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_support_issues?id=eq.${id}&select=id,phone,problem,status,created_at,resolved_at`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: body.status, resolved_at: body.status === "resolved" ? new Date().toISOString() : null }),
  });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar el reporte." }, { status: 503 });
  const [issue] = await response.json() as Array<Record<string, unknown>>;
  if (!issue) return Response.json({ error: "No se encontró el reporte." }, { status: 404 });
  return Response.json({ issue });
}

export async function DELETE(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = issueId(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Reporte inválido." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_support_issues?id=eq.${id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  if (!response.ok) return Response.json({ error: "No se pudo borrar el reporte." }, { status: 503 });
  return Response.json({ ok: true });
}
