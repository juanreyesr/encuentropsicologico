import { isEventAdmin } from "../../../../lib/admin";
import { supabaseServerConfiguration } from "../../../../lib/supabase-server";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);

export async function POST(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const requestedPurpose = String(form.get("purpose") ?? "speaker");
  const purpose = requestedPurpose === "certificate" || requestedPurpose === "sponsor" ? requestedPurpose : "speaker";
  if (!(file instanceof File)) return Response.json({ error: "Selecciona un archivo." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return Response.json({ error: "Formato no permitido. Usa JPG, PNG, WebP, MP4 o WebM." }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return Response.json({ error: "El archivo supera el máximo de 50 MB." }, { status: 400 });
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  if ((purpose === "certificate" || purpose === "sponsor") && !file.type.startsWith("image/")) return Response.json({ error: "Para este uso solo se permiten imágenes." }, { status: 400 });
  const directory = purpose === "certificate" ? "certificates" : purpose === "sponsor" ? "sponsors" : "speakers";
  const path = `${directory}/${crypto.randomUUID()}.${extension}`;
  const { projectUrl, secretKey } = supabaseServerConfiguration();
  const response = await fetch(`${projectUrl}/storage/v1/object/encuentro-psicologico-media/${path}`, { method: "POST", headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}`, "Content-Type": file.type, "x-upsert": "false" }, body: await file.arrayBuffer() });
  if (!response.ok) return Response.json({ error: "No se pudo cargar el archivo." }, { status: 503 });
  return Response.json({ url: `${projectUrl}/storage/v1/object/public/encuentro-psicologico-media/${path}` });
}
