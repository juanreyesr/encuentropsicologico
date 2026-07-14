import { supabaseServerFetch } from "../../../lib/supabase-server";
import { currentUser } from "../../../lib/auth";

const CAPACITY = 250;

async function availability() {
  const response = await supabaseServerFetch("encuentro_psicologico_registrations?select=id&modality=eq.presencial&status=eq.confirmed", {
    headers: { Prefer: "count=exact", Range: "0-0" },
  });
  if (!response.ok) { console.error("Supabase capacity error", response.status, await response.text()); throw new Error("No se pudo consultar el cupo presencial."); }
  const total = Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
  return { capacity: CAPACITY, confirmed: total, available: Math.max(0, CAPACITY - total), full: total >= CAPACITY };
}

export async function GET() {
  try { return Response.json(await availability()); }
  catch { return Response.json({ error: "No fue posible consultar los espacios disponibles." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Debes crear tu cuenta antes de inscribirte." }, { status: 401 });
  const data = await request.json() as Record<string, string | boolean>;
  if (!data.name || !data.email || !data.phone || !data.modality) return Response.json({ error: "Faltan datos requeridos" }, { status: 400 });
  if (data.modality !== "presencial" && data.modality !== "virtual") return Response.json({ error: "Selecciona si tu asistencia será presencial o virtual." }, { status: 400 });

  const response = await supabaseServerFetch("rpc/encuentro_psicologico_register", {
    method: "POST",
    body: JSON.stringify({
      p_modality: data.modality,
      p_name: data.name,
      p_email: data.email,
      p_phone: data.phone,
      p_attendee_type: data.attendeeType || "general",
      p_profession: data.profession || null,
      p_license: data.license || null,
      p_institution: data.institution || null,
      p_country: data.country || "Guatemala",
      p_waitlist: Boolean(data.waitlist),
      p_user_id: user.id,
    }),
  });
  if (!response.ok) return Response.json({ error: "No fue posible completar la inscripción." }, { status: 503 });
  const result = await response.json() as { status: string; available: number; registration_status?: string };
  if (result.status === "full") return Response.json({ full: true, available: 0 }, { status: 409 });
  return Response.json({ ok: true, alreadyRegistered: result.status === "already_registered", waitlisted: result.status === "waitlist" || result.registration_status === "waitlist", available: result.available });
}
