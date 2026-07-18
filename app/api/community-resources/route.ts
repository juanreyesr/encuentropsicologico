import { currentUser } from "../../../lib/auth";
import { COMMUNITY_ALLOWED_FILES, COMMUNITY_BUCKET, COMMUNITY_MAX_FILE_SIZE, COMMUNITY_RIGHTS, communityStorageFetch, safeCommunityFilename, slugifyCommunityCategory } from "../../../lib/community-resources";
import { supabaseServerFetch } from "../../../lib/supabase-server";
import { randomUUID } from "crypto";

type Category = { id: number; name: string; slug: string; is_default: boolean };
type Resource = { id: number; owner_user_id: string; category_id: number; title: string; description: string | null; source_author: string | null; rights_basis: string; original_filename: string; mime_type: string; size_bytes: number; status: string; moderation_reason: string | null; created_at: string };

async function communityUser() {
  const user = await currentUser({ refresh: false });
  if (!user) return null;
  if (user.app_metadata?.encuentro_psicologico_role === "admin") return user;
  const profileResponse = await supabaseServerFetch(`encuentro_psicologico_profiles?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
  if (!profileResponse.ok) return null;
  const profiles = await profileResponse.json() as Array<{ user_id: string }>;
  return profiles.length ? user : null;
}
function contentRangeTotal(response: Response) {
  return Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
}

export async function GET() {
  const user = await communityUser();
  if (!user) return Response.json({ error: "Debes iniciar sesión como participante." }, { status: 401 });

  const [categoryResponse, resourceResponse, ownResponse, rewardResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_community_categories?select=id,name,slug,is_default&is_active=eq.true&order=is_default.desc,name.asc"),
    supabaseServerFetch("encuentro_psicologico_community_resources?select=id,owner_user_id,category_id,title,description,source_author,rights_basis,original_filename,mime_type,size_bytes,status,moderation_reason,created_at&status=eq.approved&order=created_at.desc"),
    supabaseServerFetch(`encuentro_psicologico_community_resources?select=id,owner_user_id,category_id,title,description,source_author,rights_basis,original_filename,mime_type,size_bytes,status,moderation_reason,created_at&owner_user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc`),
    supabaseServerFetch(`encuentro_psicologico_community_reward_events?select=id,event_type&owner_user_id=eq.${encodeURIComponent(user.id)}`, { headers: { Prefer: "count=exact" } }),
  ]);
  if (!categoryResponse.ok || !resourceResponse.ok || !ownResponse.ok || !rewardResponse.ok) return Response.json({ error: "No se pudo cargar la biblioteca comunitaria." }, { status: 503 });

  const categories = await categoryResponse.json() as Category[];
  const resources = await resourceResponse.json() as Resource[];
  const ownResources = (await ownResponse.json() as Resource[]).filter(item => item.status !== "removed");
  const rewardEvents = await rewardResponse.json() as Array<{ id: number; event_type: string }>;
  const ownerIds = [...new Set(resources.map(item => item.owner_user_id))];
  const resourceIds = resources.map(item => item.id);

  const [profilesResponse, downloadsResponse] = await Promise.all([
    ownerIds.length ? supabaseServerFetch(`encuentro_psicologico_profiles?select=user_id,full_name&user_id=in.(${ownerIds.map(encodeURIComponent).join(",")})`) : null,
    resourceIds.length ? supabaseServerFetch(`encuentro_psicologico_community_downloads?select=resource_id&resource_id=in.(${resourceIds.join(",")})`) : null,
  ]);
  const profiles = profilesResponse?.ok ? await profilesResponse.json() as Array<{ user_id: string; full_name: string }> : [];
  const downloads = downloadsResponse?.ok ? await downloadsResponse.json() as Array<{ resource_id: number }> : [];
  const names = new Map(profiles.map(item => [item.user_id, item.full_name]));
  const downloadCounts = downloads.reduce((map, item) => map.set(item.resource_id, (map.get(item.resource_id) ?? 0) + 1), new Map<number, number>());

  const groups = categories.map(category => ({
    ...category,
    resources: resources.filter(resource => resource.category_id === category.id).map(resource => ({
      ...resource,
      contributor_name: names.get(resource.owner_user_id) ?? "Participante de la comunidad",
      download_count: downloadCounts.get(resource.id) ?? 0,
    })),
  })).filter(group => group.resources.length > 0);

  return Response.json({
    availableCategories: categories,
    groups,
    myResources: ownResources,
    rewards: {
      stars: contentRangeTotal(rewardResponse) || rewardEvents.length,
      contributions: rewardEvents.filter(item => item.event_type === "contribution").length,
      usefulDownloads: rewardEvents.filter(item => item.event_type === "download").length,
    },
  });
}

export async function POST(request: Request) {
  const user = await communityUser();
  if (!user) return Response.json({ error: "Debes iniciar sesión como participante." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const sourceAuthor = String(form.get("sourceAuthor") ?? "").trim();
  const rightsBasis = String(form.get("rightsBasis") ?? "");
  const accepted = String(form.get("responsibilityAccepted") ?? "") === "true";
  let categoryId = Number(form.get("categoryId") ?? 0);

  if (!accepted) return Response.json({ error: "Debes aceptar la declaración de responsabilidad." }, { status: 400 });
  if (title.length < 3 || title.length > 160) return Response.json({ error: "Escribe un título de entre 3 y 160 caracteres." }, { status: 400 });
  if (!COMMUNITY_RIGHTS.includes(rightsBasis as typeof COMMUNITY_RIGHTS[number])) return Response.json({ error: "Indica por qué puedes compartir este recurso." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Selecciona el archivo que deseas compartir." }, { status: 400 });
  if (file.size > COMMUNITY_MAX_FILE_SIZE) return Response.json({ error: "El archivo supera el máximo de 25 MB." }, { status: 413 });
  if (!COMMUNITY_ALLOWED_FILES[file.type]) return Response.json({ error: "Formato no permitido. Usa PDF, Word, PowerPoint, Excel, JPG o PNG." }, { status: 415 });

  if (!categoryId) {
    const customCategory = String(form.get("customCategory") ?? "").trim();
    const slug = slugifyCommunityCategory(customCategory);
    if (customCategory.length < 2 || !slug) return Response.json({ error: "Escribe el nombre de la nueva categoría." }, { status: 400 });
    const categoryResponse = await supabaseServerFetch("encuentro_psicologico_community_categories?on_conflict=slug&select=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ name: customCategory.slice(0, 60), slug, is_default: false, is_active: true, created_by: user.id }),
    });
    if (!categoryResponse.ok) return Response.json({ error: "No se pudo crear la categoría." }, { status: 503 });
    const [category] = await categoryResponse.json() as Array<{ id: number }>;
    categoryId = category.id;
  } else {
    const categoryResponse = await supabaseServerFetch(`encuentro_psicologico_community_categories?select=id&id=eq.${categoryId}&is_active=eq.true&limit=1`);
    const categories = categoryResponse.ok ? await categoryResponse.json() as Array<{ id: number }> : [];
    if (!categories.length) return Response.json({ error: "Selecciona una categoría válida." }, { status: 400 });
  }

  const filename = safeCommunityFilename(file.name);
  const storagePath = `${user.id}/${randomUUID()}-${filename}`;
  const uploadResponse = await communityStorageFetch(`object/${COMMUNITY_BUCKET}/${storagePath}`, {
    method: "POST",
    headers: { "Content-Type": file.type, "x-upsert": "false" },
    body: await file.arrayBuffer(),
  });
  if (!uploadResponse.ok) return Response.json({ error: "No se pudo cargar el archivo. Intenta nuevamente." }, { status: 503 });

  const resourceResponse = await supabaseServerFetch("encuentro_psicologico_community_resources?select=id,title,status,created_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_user_id: user.id,
      category_id: categoryId,
      title,
      description: description || null,
      source_author: sourceAuthor || null,
      rights_basis: rightsBasis,
      responsibility_accepted_at: new Date().toISOString(),
      storage_path: storagePath,
      original_filename: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      status: "pending",
    }),
  });
  if (!resourceResponse.ok) {
    await communityStorageFetch(`object/${COMMUNITY_BUCKET}/${storagePath}`, { method: "DELETE" });
    return Response.json({ error: "El archivo se cargó, pero no se pudo registrar el aporte." }, { status: 503 });
  }
  const [resource] = await resourceResponse.json();
  return Response.json({ resource, message: "Tu aporte quedó en revisión." }, { status: 201 });
}
