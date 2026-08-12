import { randomUUID } from "crypto";
import { currentUser } from "../../../../lib/auth";
import {
  safeSpeakerMaterialFilename,
  SPEAKER_MATERIALS_BUCKET,
  SPEAKER_MATERIALS_MAX_SIZE,
  SPEAKER_MATERIAL_TYPES,
  speakerMaterialReleaseAt,
  speakerMaterialStorageFetch,
} from "../../../../lib/event-materials";
import { loadEventControls } from "../../../../lib/event-controls";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type Registration = {
  status: string;
  event_roles: string[];
  speaker_program_item_id: number | null;
  attendance_verified_at: string | null;
};
type ProgramItem = { id: number; title: string; start_time: string; end_time: string; display_order: number };
type Material = {
  id: number;
  owner_user_id: string;
  program_item_id: number;
  title: string;
  description: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
};

const PRIVATE_RESPONSE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

async function accountContext() {
  const user = await currentUser({ refresh: false });
  if (!user) return null;
  const registrationResponse = await supabaseServerFetch(`encuentro_psicologico_registrations?select=status,event_roles,speaker_program_item_id,attendance_verified_at&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
  const [registration] = registrationResponse.ok ? await registrationResponse.json() as Registration[] : [];
  const isAdmin = user.app_metadata?.encuentro_psicologico_role === "admin";
  if (!registration && !isAdmin) return null;
  return { user, registration: registration ?? null, isAdmin };
}

function isSpeaker(registration: Registration | null) {
  return Boolean(registration?.event_roles?.includes("speaker") && registration.speaker_program_item_id);
}

function publicMaterial(material: Material) {
  return {
    id: material.id,
    title: material.title,
    description: material.description,
    originalFilename: material.original_filename,
    mimeType: material.mime_type,
    sizeBytes: material.size_bytes,
    createdAt: material.created_at,
    updatedAt: material.updated_at,
    downloadUrl: `/api/account/event-materials/${material.id}/download`,
  };
}

export async function GET() {
  const context = await accountContext();
  if (!context) return Response.json({ error: "Inicia sesión como participante para acceder a los materiales." }, { status: 401, headers: PRIVATE_RESPONSE });

  const [controls, programResponse, materialsResponse] = await Promise.all([
    loadEventControls(),
    supabaseServerFetch("encuentro_psicologico_program?select=id,title,start_time,end_time,display_order&is_published=eq.true&order=display_order.asc"),
    supabaseServerFetch("encuentro_psicologico_speaker_materials?select=id,owner_user_id,program_item_id,title,description,storage_path,original_filename,mime_type,size_bytes,created_at,updated_at&order=created_at.asc"),
  ]);
  if (controls.materialsMode === "closed" && !context.isAdmin) return Response.json({ error: "Los materiales están suspendidos por la organización en este momento." }, { status: 403, headers: PRIVATE_RESPONSE });
  if (!programResponse.ok || !materialsResponse.ok) return Response.json({ error: "No se pudieron cargar los materiales del encuentro." }, { status: 503, headers: PRIVATE_RESPONSE });

  const program = await programResponse.json() as ProgramItem[];
  const materials = await materialsResponse.json() as Material[];
  const now = Date.now();
  const attendanceConfirmed = Boolean(context.registration?.attendance_verified_at);
  const assignedProgram = program.find(item => item.id === context.registration?.speaker_program_item_id) ?? null;
  const speaker = isSpeaker(context.registration);

  const talks = program.map(item => {
    const talkMaterials = materials.filter(material => material.program_item_id === item.id);
    const releaseAt = speakerMaterialReleaseAt(item.end_time);
    // "Abierto ahora" adelanta la entrega automática cuando la organización lo decide.
    const available = attendanceConfirmed && (controls.materialsMode === "open" || now >= releaseAt.getTime());
    return {
      id: item.id,
      title: item.title,
      startTime: item.start_time,
      endTime: item.end_time,
      materialCount: talkMaterials.length,
      available,
      releaseAt: releaseAt.toISOString(),
      materials: available ? talkMaterials.map(publicMaterial) : [],
    };
  }).filter(item => item.materialCount > 0);

  const myMaterials = speaker
    ? materials.filter(material => material.owner_user_id === context.user.id && material.program_item_id === context.registration?.speaker_program_item_id).map(publicMaterial)
    : [];

  return Response.json({
    attendanceConfirmed,
    speaker: speaker && assignedProgram ? {
      programItemId: assignedProgram.id,
      talkTitle: assignedProgram.title,
      startTime: assignedProgram.start_time,
      endTime: assignedProgram.end_time,
    } : null,
    myMaterials,
    talks,
  }, { headers: PRIVATE_RESPONSE });
}

export async function POST(request: Request) {
  const context = await accountContext();
  if (!context || !isSpeaker(context.registration)) return Response.json({ error: "Solo los ponentes con una conferencia asignada pueden subir materiales." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();

  if (title.length < 3 || title.length > 160) return Response.json({ error: "Escribe un título de entre 3 y 160 caracteres." }, { status: 400 });
  if (description.length > 800) return Response.json({ error: "La descripción no puede superar 800 caracteres." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Selecciona el archivo que deseas compartir." }, { status: 400 });
  if (file.size > SPEAKER_MATERIALS_MAX_SIZE) return Response.json({ error: "El archivo supera el máximo de 25 MB." }, { status: 413 });
  if (!SPEAKER_MATERIAL_TYPES[file.type]) return Response.json({ error: "Formato no permitido. Usa PDF, Word, PowerPoint, Excel, JPG o PNG." }, { status: 415 });

  const filename = safeSpeakerMaterialFilename(file.name);
  const programItemId = context.registration!.speaker_program_item_id!;
  const storagePath = `${context.user.id}/${programItemId}/${randomUUID()}-${filename}`;
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const uploadResponse = await speakerMaterialStorageFetch(`object/${SPEAKER_MATERIALS_BUCKET}/${encodedPath}`, {
    method: "POST",
    headers: { "Content-Type": file.type, "x-upsert": "false" },
    body: await file.arrayBuffer(),
  });
  if (!uploadResponse.ok) return Response.json({ error: "No se pudo cargar el archivo. Intenta nuevamente." }, { status: 503 });

  const materialResponse = await supabaseServerFetch("encuentro_psicologico_speaker_materials?select=id,owner_user_id,program_item_id,title,description,storage_path,original_filename,mime_type,size_bytes,created_at,updated_at", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      owner_user_id: context.user.id,
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
  return Response.json({ material: publicMaterial(material) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await accountContext();
  if (!context || !isSpeaker(context.registration)) return Response.json({ error: "No tienes permiso para editar materiales." }, { status: 403 });
  const input = await request.json() as { id?: number; title?: string; description?: string };
  const id = Number(input.id);
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Material inválido." }, { status: 400 });
  if (title.length < 3 || title.length > 160) return Response.json({ error: "Escribe un título de entre 3 y 160 caracteres." }, { status: 400 });
  if (description.length > 800) return Response.json({ error: "La descripción no puede superar 800 caracteres." }, { status: 400 });

  const response = await supabaseServerFetch(`encuentro_psicologico_speaker_materials?id=eq.${id}&owner_user_id=eq.${encodeURIComponent(context.user.id)}&program_item_id=eq.${context.registration!.speaker_program_item_id}&select=id,owner_user_id,program_item_id,title,description,storage_path,original_filename,mime_type,size_bytes,created_at,updated_at`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ title, description: description || null, updated_at: new Date().toISOString() }),
  });
  const [material] = response.ok ? await response.json() as Material[] : [];
  if (!material) return Response.json({ error: "No se encontró el material o no te pertenece." }, { status: 404 });
  return Response.json({ material: publicMaterial(material) });
}

export async function DELETE(request: Request) {
  const context = await accountContext();
  if (!context || !isSpeaker(context.registration)) return Response.json({ error: "No tienes permiso para eliminar materiales." }, { status: 403 });
  const input = await request.json() as { id?: number };
  const id = Number(input.id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Material inválido." }, { status: 400 });

  const lookupResponse = await supabaseServerFetch(`encuentro_psicologico_speaker_materials?select=id,storage_path&id=eq.${id}&owner_user_id=eq.${encodeURIComponent(context.user.id)}&program_item_id=eq.${context.registration!.speaker_program_item_id}&limit=1`);
  const [material] = lookupResponse.ok ? await lookupResponse.json() as Array<{ id: number; storage_path: string }> : [];
  if (!material) return Response.json({ error: "No se encontró el material o no te pertenece." }, { status: 404 });
  const encodedPath = material.storage_path.split("/").map(encodeURIComponent).join("/");
  const storageResponse = await speakerMaterialStorageFetch(`object/${SPEAKER_MATERIALS_BUCKET}/${encodedPath}`, { method: "DELETE" });
  if (!storageResponse.ok && storageResponse.status !== 404) return Response.json({ error: "No se pudo eliminar el archivo." }, { status: 503 });
  const deleteResponse = await supabaseServerFetch(`encuentro_psicologico_speaker_materials?id=eq.${id}&owner_user_id=eq.${encodeURIComponent(context.user.id)}`, { method: "DELETE" });
  if (!deleteResponse.ok) return Response.json({ error: "No se pudo eliminar el registro del material." }, { status: 503 });
  return Response.json({ ok: true });
}
