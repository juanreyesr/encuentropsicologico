import { env } from "cloudflare:workers";

export async function POST(request: Request) {
  const data = await request.json() as Record<string, string>;
  if (!data.name || !data.email || !data.phone || !data.modality) return Response.json({ error: "Faltan datos requeridos" }, { status: 400 });
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS registrations (id INTEGER PRIMARY KEY AUTOINCREMENT, modality TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, attendee_type TEXT NOT NULL, profession TEXT, license TEXT, institution TEXT, country TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await env.DB.prepare(`INSERT INTO registrations (modality,name,email,phone,attendee_type,profession,license,institution,country) VALUES (?,?,?,?,?,?,?,?,?)`).bind(data.modality, data.name, data.email, data.phone, data.attendeeType || "general", data.profession || null, data.license || null, data.institution || null, data.country || "Guatemala").run();
  return Response.json({ ok: true });
}
