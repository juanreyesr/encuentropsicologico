const projectUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

function configuration() {
  if (!projectUrl || !secretKey) {
    throw new Error("Falta configurar SUPABASE_URL y SUPABASE_SECRET_KEY en el servidor.");
  }
  return { projectUrl: projectUrl.replace(/\/$/, ""), secretKey };
}

export function supabaseServerConfiguration() { return configuration(); }

export async function supabaseServerFetch(path: string, init: RequestInit = {}) {
  const { projectUrl, secretKey } = configuration();
  return fetch(`${projectUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}
