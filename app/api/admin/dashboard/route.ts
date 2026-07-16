import { isEventAdmin } from "../../../../lib/admin";
import { EVENT_CAPACITY, eventDaysRemaining } from "../../../../lib/event";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

type Registration = { id: number; user_id?: string | null; name: string; email?: string | null; phone?: string | null; modality: string; status: string; created_at: string; attendee_type?: string | null; country?: string | null; department?: string | null; professional_network_opt_in?: boolean };
type SupportIssue = { id: number; phone: string; problem: string; status: string; created_at: string };
type ProfessionalDirectory = { user_id: string; share_enabled: boolean; profession: string | null; specialty: string | null; address: string | null; email: string | null; whatsapp: string | null; website: string | null; instagram: string | null; updated_at: string };

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [response, issuesResponse, directoryResponse] = await Promise.all([
    supabaseServerFetch("encuentro_psicologico_registrations?select=id,user_id,name,email,phone,modality,status,attendee_type,country,department,professional_network_opt_in,created_at&order=created_at.desc"),
    supabaseServerFetch("encuentro_psicologico_support_issues?select=id,phone,problem,status,created_at&order=created_at.desc"),
    supabaseServerFetch("encuentro_psicologico_professional_directory?select=user_id,share_enabled,profession,specialty,address,email,whatsapp,website,instagram,updated_at&order=updated_at.desc"),
  ]);
  if (!response.ok) return Response.json({ error: "No se pudieron cargar las inscripciones." }, { status: 503 });
  const registrations = await response.json() as Registration[];
  const issues = issuesResponse.ok ? await issuesResponse.json() as SupportIssue[] : [];
  const directory = directoryResponse.ok ? await directoryResponse.json() as ProfessionalDirectory[] : [];
  const confirmed = registrations.filter(item => item.status === "confirmed");
  const presencial = confirmed.filter(item => item.modality === "presencial").length;
  const virtual = confirmed.filter(item => item.modality === "virtual").length;
  const waitlist = registrations.filter(item => item.status === "waitlist").length;
  const openIssues = issues.filter(item => item.status === "open");
  const networkOptIns = registrations.filter(item => item.professional_network_opt_in);
  const sharedDirectory = directory.filter(item => item.share_enabled);
  const registrationsByUser = new Map(registrations.map(item => [String(item.user_id ?? ""), item]));
  return Response.json({
    daysRemaining: eventDaysRemaining(),
    metrics: {
      total: confirmed.length,
      presencial,
      virtual,
      waitlist,
      available: Math.max(0, EVENT_CAPACITY - presencial),
      capacity: EVENT_CAPACITY,
      students: confirmed.filter(item => item.attendee_type === "student").length,
      professionals: confirmed.filter(item => item.attendee_type === "professional").length,
      networkOptIns: networkOptIns.length,
      sharedDirectory: sharedDirectory.length,
      guatemala: confirmed.filter(item => (item.country ?? "Guatemala") === "Guatemala").length,
    },
    recent: registrations.slice(0, 8),
    problems: { open: openIssues.length, recent: issues.slice(0, 20) },
    professionalNetwork: {
      optIns: networkOptIns.slice(0, 40).map(item => ({ id: item.id, name: item.name, modality: item.modality, status: item.status, created_at: item.created_at })),
      shared: sharedDirectory.map(item => {
        const registration = registrationsByUser.get(item.user_id);
        return { ...item, name: registration?.name ?? "Participante", participant_email: registration?.email ?? null, phone: registration?.phone ?? null };
      }),
    },
  });
}
