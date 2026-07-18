import { currentUser } from "../../../../../lib/auth";
import { COMMUNITY_BUCKET, communityStorageFetch } from "../../../../../lib/community-resources";
import { supabaseServerFetch } from "../../../../../lib/supabase-server";

type Resource = { id: number; owner_user_id: string; storage_path: string; original_filename: string; mime_type: string; status: string };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser({ refresh: false });
  if (!user) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return Response.json({ error: "Recurso inválido." }, { status: 400 });

  const response = await supabaseServerFetch(`encuentro_psicologico_community_resources?select=id,owner_user_id,storage_path,original_filename,mime_type,status&id=eq.${numericId}&limit=1`);
  const [resource] = response.ok ? await response.json() as Resource[] : [];
  const isAdmin = user.app_metadata?.encuentro_psicologico_role === "admin";
  if (!resource || (resource.status !== "approved" && !isAdmin)) return Response.json({ error: "Este recurso no está disponible." }, { status: 404 });

  if (!isAdmin && resource.owner_user_id !== user.id) {
    await supabaseServerFetch("encuentro_psicologico_community_downloads?on_conflict=resource_id,downloader_user_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ resource_id: resource.id, downloader_user_id: user.id }),
    });
  }

  const fileResponse = await communityStorageFetch(`object/authenticated/${COMMUNITY_BUCKET}/${resource.storage_path}`);
  if (!fileResponse.ok || !fileResponse.body) return Response.json({ error: "No se pudo abrir el archivo." }, { status: 503 });
  const encodedName = encodeURIComponent(resource.original_filename).replace(/'/g, "%27");
  return new Response(fileResponse.body, {
    headers: {
      "Content-Type": resource.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, no-store",
    },
  });
}
