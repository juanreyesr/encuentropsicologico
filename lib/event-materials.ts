import { supabaseServerConfiguration } from "./supabase-server";

export const SPEAKER_MATERIALS_BUCKET = "encuentro-psicologico-speaker-materials";
export const SPEAKER_MATERIALS_MAX_SIZE = 25 * 1024 * 1024;
export const SPEAKER_MATERIALS_EVENT_DATE = "2026-08-15";

export const SPEAKER_MATERIAL_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

export function safeSpeakerMaterialFilename(value: string) {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-120) || "material";
}

export function speakerMaterialReleaseAt(startTime: string) {
  const normalized = /^\d{1,2}:\d{2}$/.test(startTime) ? startTime.padStart(5, "0") : "23:59";
  return new Date(`${SPEAKER_MATERIALS_EVENT_DATE}T${normalized}:00-06:00`);
}

export function speakerMaterialStorageFetch(path: string, init: RequestInit = {}) {
  const { projectUrl, secretKey } = supabaseServerConfiguration();
  return fetch(`${projectUrl}/storage/v1/${path}`, {
    ...init,
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}
