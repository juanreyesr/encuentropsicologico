import { isEventAdmin } from "../../../../lib/admin";
import { COMMUNITY_BUCKET, communityStorageFetch } from "../../../../lib/community-resources";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type CommunityResource = { id: number; owner_user_id: string; category_id: number; title: string; description: string | null; source_author: string | null; rights_basis: string; responsibility_accepted_at: string; storage_path: string; original_filename: string; mime_type: string; size_bytes: number; status: string; moderation_reason: string | null; created_at: string };

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [resourcesResponse, categoriesResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_community_resources?select=id,owner_user_id,category_id,title,description,source_author,rights_basis,responsibility_accepted_at,storage_path,original_filename,mime_type,size_bytes,status,moderation_reason,created_at&status=neq.removed&order=created_at.desc"),
    supabaseServerFetch("encuentro_psicologico_community_categories?select=id,name,slug,is_default,is_active&order=name.asc"),
  ]);
  if (!resourcesResponse.ok || !categoriesResponse.ok) return Response.json({ error: "No se pudo cargar la biblioteca." }, { status: 503 });
  const resources = await resourcesResponse.json() as CommunityResource[];
  const categories = await categoriesResponse.json() as Array<{ id: number; name: string }>;
  const ownerIds = [...new Set(resources.map(item => item.owner_user_id))];
  const profilesResponse = ownerIds.length ? await supabaseServerFetch(`encuentro_psicologico_profiles?select=user_id,full_name&user_id=in.(${ownerIds.map(encodeURIComponent).join(",")})`) : null;
  const profiles = profilesResponse?.ok ? await profilesResponse.json() as Array<{ user_id: string; full_name: string }> : [];
  const categoryNames = new Map(categories.map(item => [item.id, item.name]));
  const profileNames = new Map(profiles.map(item => [item.user_id, item.full_name]));
  return Response.json({
    resources: resources.map(item => ({ ...item, category_name: categoryNames.get(item.category_id) ?? "Sin categoría", contributor_name: profileNames.get(item.owner_user_id) ?? "Participante" })),
    metrics: {
      pending: resources.filter(item => item.status === "pending").length,
      approved: resources.filter(item => item.status === "approved").length,
      rejected: resources.filter(item => item.status === "rejected").length,
    },
  });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as { id?: number; status?: string; reason?: string };
  const id = Number(body.id);
  if (!Number.isInteger(id) || !["approved", "rejected", "pending"].includes(body.status ?? "")) return Response.json({ error: "Datos inválidos." }, { status: 400 });
  const response = await supabaseServerFetch(`encuentro_psicologico_community_resources?id=eq.${id}&select=id,status,approved_at,moderation_reason`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: body.status, moderation_reason: body.reason?.trim() || null, approved_at: body.status === "approved" ? new Date().toISOString() : null, removed_at: null }),
  });
  if (!response.ok) return Response.json({ error: "No se pudo actualizar el recurso." }, { status: 503 });
  const [resource] = await response.json();
  return Response.json({ resource });
}

export async function DELETE(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "Recurso inválido." }, { status: 400 });
  const resourceResponse = await supabaseServerFetch(`encuentro_psicologico_community_resources?select=id,storage_path&id=eq.${id}&limit=1`);
  const [resource] = resourceResponse.ok ? await resourceResponse.json() as Array<{ id: number; storage_path: string }> : [];
  if (!resource) return Response.json({ error: "Recurso no encontrado." }, { status: 404 });
  const storageResponse = await communityStorageFetch(`object/${COMMUNITY_BUCKET}/${resource.storage_path}`, { method: "DELETE" });
  if (!storageResponse.ok && storageResponse.status !== 404) return Response.json({ error: "No se pudo borrar el archivo." }, { status: 503 });
  const updateResponse = await supabaseServerFetch(`encuentro_psicologico_community_resources?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "removed", removed_at: new Date().toISOString(), moderation_reason: "Retirado por la administración" }),
  });
  if (!updateResponse.ok) return Response.json({ error: "El archivo se borró, pero no se pudo actualizar el registro." }, { status: 503 });
  return Response.json({ ok: true });
}
