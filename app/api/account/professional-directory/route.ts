import { currentUser } from "../../../../lib/auth";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type DirectoryBody = {
  professionalNetworkOptIn?: boolean;
  share_enabled?: boolean;
  profession?: string;
  specialty?: string;
  address?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function directoryPayload(body: DirectoryBody, userId: string) {
  return {
    user_id: userId,
    share_enabled: Boolean(body.share_enabled),
    profession: text(body.profession),
    specialty: text(body.specialty),
    address: text(body.address),
    email: text(body.email).toLowerCase(),
    whatsapp: digits(body.whatsapp),
    website: text(body.website),
    instagram: text(body.instagram),
    updated_at: new Date().toISOString(),
  };
}

export async function GET() {
  const user = await currentUser({ refresh: false });
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [profileResponse, directoryResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_profiles?select=professional_network_opt_in&user_id=eq.${encodeURIComponent(user.id)}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_professional_directory?select=share_enabled,profession,specialty,address,email,whatsapp,website,instagram&user_id=eq.${encodeURIComponent(user.id)}&limit=1`),
  ]);
  if (!profileResponse.ok || !directoryResponse.ok) return Response.json({ error: "No se pudo cargar la red profesional." }, { status: 503 });
  const [profile] = await profileResponse.json() as Array<{ professional_network_opt_in: boolean }>;
  const [directory] = await directoryResponse.json() as Array<Record<string, unknown>>;
  return Response.json({ professionalNetworkOptIn: Boolean(profile?.professional_network_opt_in), directory: directory ?? null });
}

export async function PATCH(request: Request) {
  const user = await currentUser({ refresh: false });
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as DirectoryBody;
  const professionalNetworkOptIn = Boolean(body.professionalNetworkOptIn);
  const payload = directoryPayload(body, user.id);

  const [profileResponse, registrationResponse, directoryResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ professional_network_opt_in: professionalNetworkOptIn, updated_at: new Date().toISOString() }),
    }),
    supabaseServerFetch(`encuentro_psicologico_registrations?user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ professional_network_opt_in: professionalNetworkOptIn }),
    }),
    supabaseServerFetch("encuentro_psicologico_professional_directory?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload),
    }),
  ]);

  if (!profileResponse.ok || !registrationResponse.ok || !directoryResponse.ok) {
    return Response.json({ error: "No se pudo guardar la red profesional." }, { status: 503 });
  }
  const [directory] = await directoryResponse.json() as Array<Record<string, unknown>>;
  return Response.json({ professionalNetworkOptIn, directory });
}
