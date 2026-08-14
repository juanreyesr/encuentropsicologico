import { randomUUID } from "crypto";
import { isEventAdmin } from "../../../../lib/admin";
import {
  safeSpeakerMaterialFilename,
  SPEAKER_MATERIALS_BUCKET,
  SPEAKER_MATERIALS_MAX_SIZE,
  SPEAKER_MATERIAL_TYPES,
  speakerMaterialReleaseAt,
  speakerMaterialStorageFetch,
} from "../../../../lib/event-materials";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type Material = { id: number; owner_user_id: string; program_item_id: number; title: string; description: string | null; storage_path: string; original_filename: string; mime_type: string; size_bytes: number; created_at: string; updated_at: string };
type ProgramItem = { id: number; title: string; start_time: string; end_time: string; display_order: number; is_published: boolean };
type SpeakerRegistration = { user_id: string; name: string; speaker_program_item_id: number | null };

const MATERIAL_COLUMNS = "id,owner_user_id,program_item_id,title,description,storage_path,original_filename,mime_type,size_bytes,created_at,updated_at";

async function speakersByProgram() {
  const response = await supabaseServerFetch("encuentro_psicologico_registrations?select=user_id,name,speaker_program_item_id&event_roles=cs.%7Bspeaker%7D&speaker_program_item_id=not.is.null&user_id=not.is.null");
  const rows = response.ok ? await response.json() as SpeakerRegistration[] : [];
  return new Map(rows.map(row => [row.speaker_program_item_id as number, row]));
}

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [materialsResponse, programResponse, speakers] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_speaker_materials?select=${MATERIAL_COLUMNS}&order=created_at.desc`),
    supabaseServerFetch("encuentro_psicologico_program?select=id,title,start_time,end_time,display_order,is_published&order=display_order.asc"),
    speakersByProgram(),
  ]);
  if (!materialsResponse.ok) return Response.json({ error: "No se pudieron cargar los materiales." }, { status: 503 });
  const materials = await materialsResponse.json() as Material[];
  const program = programResponse.ok ? await programResponse.json() as ProgramItem[] : [];

  const ownerIds = [...new Set(materials.map(item => item.owner_user_id))];
  const ownersResponse = ownerIds.length ? await supabaseServerFetch(`encuentro_psicologico_registrations?select=user_id,name&user_id=in.(${ownerIds.map(encodeURIComponent).join(",")})`) : null;
  const ownerNames = new Map((ownersResponse?.ok ? await ownersResponse.json() as Array<{ user_id: string; name: string }> : []).map(row => [row.user_id, row.name]));

  return Response.json({
    materials: materials.map(item => {
      const programItem = program.find(entry => entry.id === item.program_item_id);
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        originalFilename: item.original_filename,
        mimeType: item.mime_type,
        sizeBytes: item.size_bytes,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        programItemId: item.program_item_id,
        programTitle: programItem?.title ?? "Conferencia",
        ownerName: ownerNames.get(item.owner_user_id) ?? "Cuenta sin inscripción",
        releaseAt: programItem ? speakerMaterialReleaseAt(programItem.end_time).toISOString() : null,
        downloadUrl: `/api/account/event-materials/${item.id}/download`,
      };
    }),
    program: program.map(item => {
      const speaker = speakers.get(item.id);
      return {
        id: item.id,
        title: item.title,
        timeLabel: item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : "",
        isPublished: item.is_published,
        speakerName: speaker?.name ?? null,
        materialCount: materials.filter(material => material.program_item_id === item.id).length,
      };
    }),
  });
}

/**
 * La organización puede subir el material en nombre de quien expone: el archivo
 * queda a nombre del ponente asignado, así los participantes lo reciben igual
 * que si lo hubiera cargado esa persona.
 */
export async function POST(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const programItemId = Number(form.get("programItemId"));

  if (!Number.isInteger(programItemId) || programItemId < 1) return Response.json({ error: "Selecciona la conferencia a la que pertenece el material." }, { status: 400 });
  if (title.length < 3 || title.length > 160) return Response.json({ error: "Escribe un título de entre 3 y 160 caracteres." }, { status: 400 });
  if (description.length > 800) return Response.json({ error: "La descripción no puede superar 800 caracteres." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Selecciona el archivo que deseas compartir." }, { status: 400 });
  if (file.size > SPEAKER_MATERIALS_MAX_SIZE) return Response.json({ error: "El archivo supera el máximo de 25 MB." }, { status: 413 });
  if (!SPEAKER_MATERIAL_TYPES[file.type]) return Response.json({ error: "Formato no permitido. Usa PDF, Word, PowerPoint, Excel, JPG o PNG." }, { status: 415 });

  const speakers = await speakersByProgram();
  const speaker = speakers.get(programItemId);
  if (!speaker) return Response.json({ error: "Esa conferencia todavía no tiene un ponente asignado con cuenta. Asígnalo en Inscritos y vuelve a intentarlo." }, { status: 400 });

  const filename = safeSpeakerMaterialFilename(file.name);
  const storagePath = `${speaker.user_id}/${programItemId}/${randomUUID()}-${filename}`;
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const uploadResponse = await speakerMaterialStorageFetch(`object/${SPEAKER_MATERIALS_BUCKET}/${encodedPath}`, {
    method: "POST",
    headers: { "Content-Type": file.type, "x-upsert": "false" },
    body: await file.arrayBuffer(),
  });
  if (!uploadResponse.ok) return Response.json({ error: "No se pudo cargar el archivo. Intenta nuevamente." }, { status: 503 });

  const materialResponse = await supabaseServerFetch(`encuentro_psicologico_speaker_materials?select=${MATERIAL_COLUMNS}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_user_id: speaker.user_id,
      program_item_id: programItemId,
      title,
      description: description || null,
      storage_path: storagePath,
      original_filename: file.name.slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
    }),
  });
  if (!materialResponse.ok) {
    await speakerMaterialStorageFetch(`object/${SPEAKER_MATERIALS_BUCKET}/${encodedPath}`, { method: "DELETE" });
    return Response.json({ error: "El archivo se cargó, pero no se pudo registrar el material." }, { status: 503 });
  }
  const [material] = await materialResponse.json() as Material[];
  return Response.json({ ok: true, id: material.id, ownerName: speaker.name }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const input = await request.json() as { id?: number; title?: string; description?: string };
  const id = Number(input.id);
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Material inválido." }, { status: 400 });
  if (title.length < 3 || title.length > 160) return Response.json({ error: "Escribe un título de entre 3 y 160 caracteres." }, { status: 400 });
  if (description.length > 800) return Response.json({ error: "La descripción no puede superar 800 caracteres." }, { status: 400 });

  const response = await supabaseServerFetch(`encuentro_psicologico_speaker_materials?id=eq.${id}&select=id`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ title, description: description || null, updated_at: new Date().toISOString() }),
  });
  const [material] = response.ok ? await response.json() as Array<{ id: number }> : [];
  if (!material) return Response.json({ error: "No se encontró el material." }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Material inválido." }, { status: 400 });
  const lookupResponse = await supabaseServerFetch(`encuentro_psicologico_speaker_materials?select=id,storage_path&id=eq.${id}&limit=1`);
  const [material] = lookupResponse.ok ? await lookupResponse.json() as Array<{ id: number; storage_path: string }> : [];
  if (!material) return Response.json({ error: "No se encontró el material." }, { status: 404 });
  const encodedPath = material.storage_path.split("/").map(encodeURIComponent).join("/");
  const storageResponse = await speakerMaterialStorageFetch(`object/${SPEAKER_MATERIALS_BUCKET}/${encodedPath}`, { method: "DELETE" });
  if (!storageResponse.ok && storageResponse.status !== 404) return Response.json({ error: "No se pudo eliminar el archivo." }, { status: 503 });
  const deleteResponse = await supabaseServerFetch(`encuentro_psicologico_speaker_materials?id=eq.${id}`, { method: "DELETE" });
  if (!deleteResponse.ok) return Response.json({ error: "No se pudo eliminar el registro del material." }, { status: 503 });
  return Response.json({ ok: true });
}
