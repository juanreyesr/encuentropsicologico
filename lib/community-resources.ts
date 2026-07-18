import { supabaseServerConfiguration } from "./supabase-server";

export const COMMUNITY_BUCKET = "encuentro-psicologico-community-resources";
export const COMMUNITY_MAX_FILE_SIZE = 25 * 1024 * 1024;

export const COMMUNITY_ALLOWED_FILES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

export const COMMUNITY_RIGHTS = ["own_work", "permission", "public_domain", "open_license", "legal_source"] as const;

export function slugifyCommunityCategory(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}
export function safeCommunityFilename(value: string) {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(-120) || "recurso";
}

export async function communityStorageFetch(path: string, init: RequestInit = {}) {
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
