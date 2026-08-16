import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

/** Fotografías del encuentro: alta por lotes, orden, pie de foto y borrado. */
const FIELDS = "id,image_url,caption,display_order,is_published,created_at";
const MAX_BATCH = 40;

type Incoming = { image_url?: unknown; caption?: unknown; display_order?: unknown; is_published?: unknown };

const clean = (value: unknown, limit: number) => String(value ?? "").trim().slice(0, limit);

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const response = await supabaseServerFetch(`encuentro_psicologico_gallery?select=${FIELDS}&order=display_order.asc,id.asc`);
  if (!response.ok) return Response.json({ error: "No se pudo cargar la galería." }, { status: 503 });
  return Response.json({ photos: await response.json() });
}

export async function POST(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as { photos?: Incoming[] } & Incoming;
  // Se admite una foto o un lote, porque lo normal es subir varias de una vez.
  const incoming = Array.isArray(body.photos) ? body.photos.slice(0, MAX_BATCH) : [body];
  const rows = incoming
    .map(photo => ({
      image_url: clean(photo.image_url, 800),
      caption: clean(photo.caption, 220) || null,
      display_order: Number.isFinite(Number(photo.display_order)) ? Math.max(0, Number(photo.display_order)) : 0,
      is_published: photo.is_published === false ? false : true,
    }))
    .filter(photo => photo.image_url);
  if (!rows.length) return Response.json({ error: "No se recibió ninguna imagen." }, { status: 400 });

  const response = await supabaseServerFetch(`encuentro_psicologico_gallery?select=${FIELDS}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) return Response.json({ error: "No se pudieron guardar las fotografías." }, { status: 503 });
  return Response.json({ photos: await response.json() });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as { id?: unknown; order?: unknown } & Incoming;

  // Reordenar es un solo envío con la lista completa de identificadores.
  if (Array.isArray(body.order)) {
    const ids = body.order.map(Number).filter(Number.isInteger).slice(0, 200);
    const now = new Date().toISOString();
    const results = await Promise.all(ids.map((id, index) => supabaseServerFetch(`encuentro_psicologico_gallery?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ display_order: index + 1, updated_at: now }),
    })));
    if (results.some(result => !result.ok)) return Response.json({ error: "No se pudo guardar el orden." }, { status: 503 });
    return Response.json({ ok: true });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ error: "Fotografía no válida." }, { status: 400 });
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.caption !== undefined) changes.caption = clean(body.caption, 220) || null;
  if (body.is_published !== undefined) changes.is_published = Boolean(body.is_published);
  if (body.display_order !== undefined) changes.display_order = Math.max(0, Number(body.display_order) || 0);

  const response = await supabaseServerFetch(`encuentro_psicologico_gallery?id=eq.${id}&select=${FIELDS}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(changes),
  });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar la fotografía." }, { status: 503 });
  return Response.json({ photo: (await response.json())[0] });
}

export async function DELETE(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Fotografía no válida." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_gallery?id=eq.${id}`, { method: "DELETE" });
  if (!response.ok) return Response.json({ error: "No se pudo eliminar la fotografía." }, { status: 503 });
  return Response.json({ ok: true });
}
