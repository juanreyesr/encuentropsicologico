import { createParticipant, findAuthUserIdByEmail, signIn, startParticipantSession } from "../../../../lib/auth";

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export async function POST(request: Request) {
 try {
  const data = await request.json() as { email?: string; phone?: string; name?: string };
  const email = data.email?.trim().toLowerCase();
  const phone = digits(data.phone);
  if (!email || !phone || !data.name || phone.length < 8) return Response.json({ error: "Ingresa un correo, nombre y teléfono válidos." }, { status: 400 });
  let user = await signIn(email, phone);
  if (!user) {
    const created = await createParticipant(email, phone, { full_name: data.name, phone });
    if (created) {
      user = { id: created.id, email, app_metadata: { encuentro_psicologico_role: "participant" }, eventOnly: true };
      await startParticipantSession(user);
    }
    else {
      const existingUserId = await findAuthUserIdByEmail(email);
      if (!existingUserId) return Response.json({ error: "No se pudo crear la cuenta de participante." }, { status: 503 });
      user = { id: existingUserId, email, app_metadata: { encuentro_psicologico_role: "participant" }, eventOnly: true };
      await startParticipantSession(user);
    }
  }
  if (!user) return Response.json({ error: "No se pudo iniciar la sesión creada." }, { status: 503 });
  return Response.json({ ok: true, user: { email: user.email } });
 } catch (error) {
  console.error("Auth registration unavailable", error instanceof Error ? error.message : "unknown");
  return Response.json({ error: "La creación de cuentas está temporalmente sin conexión. Revisa Supabase en Vercel." }, { status: 503 });
 }
}
