import { isEventAdmin } from "../../../../lib/admin";
import { EVENT_CAPACITY, eventDaysRemaining } from "../../../../lib/event";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type Registration = { id: number; name: string; modality: string; status: string; created_at: string };

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const response = await supabaseServerFetch("encuentro_psicologico_registrations?select=id,name,modality,status,created_at&order=created_at.desc");
  if (!response.ok) return Response.json({ error: "No se pudieron cargar las inscripciones." }, { status: 503 });
  const registrations = await response.json() as Registration[];
  const confirmed = registrations.filter(item => item.status === "confirmed");
  const presencial = confirmed.filter(item => item.modality === "presencial").length;
  const virtual = confirmed.filter(item => item.modality === "virtual").length;
  const waitlist = registrations.filter(item => item.status === "waitlist").length;
  return Response.json({
    daysRemaining: eventDaysRemaining(),
    metrics: { total: confirmed.length, presencial, virtual, waitlist, available: Math.max(0, EVENT_CAPACITY - presencial), capacity: EVENT_CAPACITY },
    recent: registrations.slice(0, 8),
  });
}
