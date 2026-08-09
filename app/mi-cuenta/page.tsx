import { requireUser } from "../../lib/auth";
import { DEFAULT_PROGRAM, EVENT_DATE_LABEL, EVENT_PLACE_LABEL, type EventProgramItem } from "../../lib/event";
import { supabaseServerFetch } from "../../lib/supabase-server";
import Link from "next/link";
import AccountNameEditor from "./AccountNameEditor";
import ProfessionalNetworkEditor, { type ProfessionalDirectory } from "./ProfessionalNetworkEditor";
import CommunityLibrary from "./CommunityLibrary";
import AttendanceVerifier from "./AttendanceVerifier";
import ModalitySwitcher from "./ModalitySwitcher";
import EventMaterials from "./EventMaterials";
import SpeakerAssignmentCard, { type SpeakerAssignment } from "./SpeakerAssignment";

export const dynamic = "force-dynamic";

// El super administrador asigna la conferencia desde la inscripción; estos datos se leen
// en cada visita para que el ponente vea su tema, horario y detalle sin ningún paso extra.
async function loadSpeakerAssignment(programItemId?: number | null): Promise<SpeakerAssignment | null> {
  if (!programItemId) return null;
  const [programResponse, speakerResponse, contentResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_program?select=id,start_time,end_time,type,title,description,details&id=eq.${programItemId}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_speakers?select=talk_title&program_item_id=eq.${programItemId}&limit=1`),
    supabaseServerFetch("encuentro_psicologico_content?select=payload&id=eq.site&limit=1"),
  ]);
  const [programItem] = programResponse.ok ? await programResponse.json() as EventProgramItem[] : [];
  const item = programItem ?? DEFAULT_PROGRAM.find(entry => entry.id === programItemId);
  if (!item) return null;
  const [speaker] = speakerResponse.ok ? await speakerResponse.json() as Array<{ talk_title?: string | null }> : [];
  const [content] = contentResponse.ok ? await contentResponse.json() as Array<{ payload?: { date?: string; place?: string } }> : [];
  return {
    item,
    talkTitle: speaker?.talk_title?.trim() ?? "",
    eventDate: content?.payload?.date?.trim() || EVENT_DATE_LABEL,
    eventPlace: content?.payload?.place?.trim() || EVENT_PLACE_LABEL,
  };
}

export default async function AccountPage() {
  const user = await requireUser();
  const [regResponse, certificateResponse, profileResponse, directoryResponse, rewardResponse, pendingResourceResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_registrations?select=modality,status,name,event_roles,speaker_program_item_id&user_id=eq.${user.id}`),
    supabaseServerFetch(`encuentro_psicologico_certificates?select=certificate_number,attendance_confirmed,issued_at&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_profiles?select=professional_network_opt_in&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_professional_directory?select=share_enabled,profession,specialty,address,email,whatsapp,website,instagram&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_community_reward_events?select=id&owner_user_id=eq.${user.id}`, { headers: { Prefer: "count=exact", Range: "0-0" } }),
    supabaseServerFetch(`encuentro_psicologico_community_resources?select=id&owner_user_id=eq.${user.id}&status=eq.pending`, { headers: { Prefer: "count=exact", Range: "0-0" } }),
  ]);
  const registrations = regResponse.ok ? await regResponse.json() as Array<{ modality:string; status:string; name:string; event_roles?: string[]; speaker_program_item_id?: number | null }> : [];
  const [certificate] = certificateResponse.ok ? await certificateResponse.json() as Array<{ certificate_number?:string; attendance_confirmed:boolean }> : [];
  const [profile] = profileResponse.ok ? await profileResponse.json() as Array<{ professional_network_opt_in: boolean }> : [];
  const [directory] = directoryResponse.ok ? await directoryResponse.json() as ProfessionalDirectory[] : [];
  const communityStars = rewardResponse.ok ? Number(rewardResponse.headers.get("content-range")?.split("/")[1] ?? 0) : 0;
  const pendingCommunityStars = pendingResourceResponse.ok ? Number(pendingResourceResponse.headers.get("content-range")?.split("/")[1] ?? 0) : 0;
  const activeRegistration = registrations[0];
  const speakerRegistration = registrations.find(item => item.event_roles?.includes("speaker")) ?? null;
  const speakerAssignment = speakerRegistration ? await loadSpeakerAssignment(speakerRegistration.speaker_program_item_id) : null;

  return <main className="account-page">
    <header>
      <Link href="/" className="access-brand"><img src="/logo-duelo-arbol-morado.png" alt="" /> Encuentro Clínico</Link>
      <form action="/api/auth/logout" method="post"><button>Cerrar sesión</button></form>
    </header>
    <section>
      <p className="section-kicker">ÁREA DEL PARTICIPANTE</p>
      <div className="account-community-heading"><AccountNameEditor initialName={registrations[0]?.name ?? user.email} /><div className="account-community-score" title="Tus aportes a la comunidad"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m12 2.8 2.8 5.68 6.27.91-4.54 4.43 1.07 6.25L12 17.12l-5.6 2.95 1.07-6.25-4.54-4.43 6.27-.91L12 2.8Z" /></svg><div><b>{communityStars}</b><span>Tus aportes a la comunidad</span>{pendingCommunityStars > 0 && <small>+{pendingCommunityStars} pendiente{pendingCommunityStars === 1 ? "" : "s"} de aprobación</small>}</div></div></div>
      <p>Aquí encontrarás tu inscripción, materiales, constancia de participación y tus opciones de red profesional.</p>
      <div className="account-grid">
        <article><span>INSCRIPCIÓN</span><h2>{activeRegistration ? "Confirmada" : "Pendiente"}</h2>{activeRegistration && <><p>{activeRegistration.modality === "presencial" ? "Presencial" : "Virtual"} · {activeRegistration.status === "waitlist" ? "Lista de espera" : "Confirmada"}</p><ModalitySwitcher current={activeRegistration.modality as "presencial" | "virtual"} /></>}</article>
        <article><span>CONSTANCIA</span><h2>{certificate?.attendance_confirmed ? "Disponible" : "Se habilitará después del evento"}</h2><p>La asistencia debe ser confirmada por la organización.</p>{certificate?.attendance_confirmed && <a className="primary" href="/api/account/certificate">Descargar constancia</a>}</article>
      </div>
      <AttendanceVerifier isOrganizer={registrations.some(item => item.event_roles?.includes("organizer"))} />
      {speakerRegistration && <SpeakerAssignmentCard assignment={speakerAssignment} />}
      <EventMaterials />
      <CommunityLibrary />
      <ProfessionalNetworkEditor initialOptIn={Boolean(profile?.professional_network_opt_in)} initialDirectory={directory ?? null} />
    </section>
  </main>;
}
