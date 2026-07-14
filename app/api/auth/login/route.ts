import { signIn } from "../../../../lib/auth";
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string };
    if (!email || !password) return Response.json({ error: "Completa correo y contraseña." }, { status: 400 });
    const user = await signIn(email.trim().toLowerCase(), password);
    if (!user) return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
    const admin = user.app_metadata?.encuentro_psicologico_role === "admin";
    return Response.json({ ok: true, destination: admin ? "/admin" : "/mi-cuenta" });
  } catch (error) {
    console.error("Auth login unavailable", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "El acceso está temporalmente sin conexión. Revisa la configuración de Supabase en Vercel." }, { status: 503 });
  }
}
