import { currentUser } from "../../../../../../lib/auth";
import { SPEAKER_MATERIALS_BUCKET, speakerMaterialReleaseAt, speakerMaterialStorageFetch } from "../../../../../../lib/event-materials";
import { supabaseServerFetch } from "../../../../../../lib/supabase-server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser({ refresh: false });
  if (!user) return new Response("Inicia sesión para descargar este material.", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Material inválido.", { status: 400 });

  const materialResponse = await supabaseServerFetch(`encuentro_psicologico_speaker_materials?select=id,owner_user_id,program_item_id,storage_path,original_filename,mime_type&id=eq.${id}&limit=1`);
  const [material] = materialResponse.ok ? await materialResponse.json() as Array<{ id: number; owner_user_id: string; program_item_id: number; storage_path: string; original_filename: string; mime_type: string }> : [];
  if (!material) return new Response("Material no encontrado.", { status: 404 });

  const isAdmin = user.app_metadata?.encuentro_psicologico_role === "admin";
  const isOwner = material.owner_user_id === user.id;
  if (!isAdmin && !isOwner) {
    const [registrationResponse, programResponse] = await Promise.all([
      supabaseServerFetch(`encuentro_psicologico_registrations?select=status,attendance_verified_at&user_id=eq.${encodeURIComponent(user.id)}&status=eq.confirmed&limit=1`),
      supabaseServerFetch(`encuentro_psicologico_program?select=end_time&id=eq.${material.program_item_id}&is_published=eq.true&limit=1`),
    ]);
    const [registration] = registrationResponse.ok ? await registrationResponse.json() as Array<{ status: string; attendance_verified_at: string | null }> : [];
    const [program] = programResponse.ok ? await programResponse.json() as Array<{ end_time: string }> : [];
    if (!registration?.attendance_verified_at) return new Response("Debes confirmar tu asistencia el día del evento para acceder a los materiales.", { status: 403 });
    if (!program || Date.now() < speakerMaterialReleaseAt(program.end_time).getTime()) return new Response("Este material se habilitará después de la ponencia.", { status: 403 });
  }

  const encodedPath = material.storage_path.split("/").map(encodeURIComponent).join("/");
  const fileResponse = await speakerMaterialStorageFetch(`object/${SPEAKER_MATERIALS_BUCKET}/${encodedPath}`);
  if (!fileResponse.ok || !fileResponse.body) return new Response("No se pudo abrir el archivo.", { status: 503 });
  const safeName = material.original_filename.replace(/[\r\n"\\]/g, "-");
  return new Response(fileResponse.body, {
    headers: {
      "Content-Type": material.mime_type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(material.original_filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
