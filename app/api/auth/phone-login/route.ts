import { startParticipantSession } from "../../../../lib/auth";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function POST(request: Request) {
  const { phone, email } = await request.json() as { phone?: string; email?: string };
  const normalizedPhone = digits(phone);
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedPhone.length < 8 || !normalizedEmail) return Response.json({ error: "Ingresa el correo registrado." }, { status: 400 });

  const response = await supabaseServerFetch("rpc/encuentro_psicologico_auth_user_id_by_phone_email", {
    method: "POST",
    body: JSON.stringify({ p_phone: normalizedPhone, p_email: normalizedEmail }),
  });
  if (!response.ok) return Response.json({ error: "No fue posible validar el acceso." }, { status: 503 });

  const userId = await response.json() as string | null;
  if (!userId) return Response.json({ error: "Ese correo no coincide con el teléfono inscrito." }, { status: 401 });

  await startParticipantSession({ id: userId, email: normalizedEmail, app_metadata: { encuentro_psicologico_role: "participant" }, eventOnly: true });
  return Response.json({ ok: true, destination: "/mi-cuenta" });
}
