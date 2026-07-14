import { env } from "cloudflare:workers";

const CAPACITY = 250;

export async function GET() {
  const row = await env.DB.prepare("SELECT COUNT(*) AS confirmed FROM registrations WHERE modality = 'presencial' AND status = 'confirmed'").first<{ confirmed: number }>();
  const confirmed = Number(row?.confirmed ?? 0);
  return Response.json({ capacity: CAPACITY, confirmed, available: Math.max(0, CAPACITY - confirmed), full: confirmed >= CAPACITY });
}

export async function POST(request: Request) {
  const data = await request.json() as Record<string, string | boolean>;
  if (!data.name || !data.email || !data.phone || !data.modality) return Response.json({ error: "Faltan datos requeridos" }, { status: 400 });

  const values = [data.modality, data.name, data.email, data.phone, data.attendeeType || "general", data.profession || null, data.license || null, data.institution || null, data.country || "Guatemala"];

  if (data.modality === "presencial" && !data.waitlist) {
    const result = await env.DB.prepare(`INSERT INTO registrations (modality,name,email,phone,attendee_type,profession,license,institution,country,status)
      SELECT ?,?,?,?,?,?,?,?,?, 'confirmed'
      WHERE (SELECT COUNT(*) FROM registrations WHERE modality = 'presencial' AND status = 'confirmed') < ?`).bind(...values, CAPACITY).run();
    if (!result.meta.changes) return Response.json({ full: true, available: 0 }, { status: 409 });
  } else {
    const status = data.modality === "presencial" ? "waitlist" : "confirmed";
    await env.DB.prepare("INSERT INTO registrations (modality,name,email,phone,attendee_type,profession,license,institution,country,status) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(...values, status).run();
  }

  const row = await env.DB.prepare("SELECT COUNT(*) AS confirmed FROM registrations WHERE modality = 'presencial' AND status = 'confirmed'").first<{ confirmed: number }>();
  const available = Math.max(0, CAPACITY - Number(row?.confirmed ?? 0));
  return Response.json({ ok: true, waitlisted: Boolean(data.waitlist), available });
}
