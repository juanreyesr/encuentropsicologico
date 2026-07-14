import { createParticipant, signIn } from "../../../../lib/auth";

export async function POST(request: Request) {
  const data = await request.json() as { email?: string; phone?: string; name?: string };
  const email = data.email?.trim().toLowerCase();
  const phone = data.phone?.replace(/\s+/g, "");
  if (!email || !phone || !data.name || phone.length < 8) return Response.json({ error: "Ingresa un correo, nombre y teléfono válidos." }, { status: 400 });
  let user = await signIn(email, phone);
  if (!user) {
    const created = await createParticipant(email, phone, { full_name: data.name, phone });
    if (!created) return Response.json({ error: "Este correo ya tiene una cuenta. Inicia sesión con el teléfono utilizado originalmente." }, { status: 409 });
    user = await signIn(email, phone);
  }
  if (!user) return Response.json({ error: "No se pudo iniciar la sesión creada." }, { status: 503 });
  return Response.json({ ok: true, user: { email: user.email } });
}
