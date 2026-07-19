import { requireUser } from "../../lib/auth";
import { EVENT_CAPACITY } from "../../lib/event";
import { supabaseServerFetch } from "../../lib/supabase-server";
import Link from "next/link";
import AccountNameEditor from "./AccountNameEditor";
import ProfessionalNetworkEditor, { type ProfessionalDirectory } from "./ProfessionalNetworkEditor";
import CommunityLibrary from "./CommunityLibrary";
import AttendanceVerifier from "./AttendanceVerifier";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const [regResponse, resourceResponse, certificateResponse, capacityResponse, profileResponse, directoryResponse, rewardResponse, pendingResourceResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_registrations?select=modality,status,name,event_roles,speaker_program_item_id&user_id=eq.${user.id}`),
    supabaseServerFetch("encuentro_psicologico_resources?select=id,title,description,file_url&is_published=eq.true&order=created_at.desc"),
    supabaseServerFetch(`encuentro_psicologico_certificates?select=certificate_number,attendance_confirmed,issued_at&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch("encuentro_psicologico_registrations?select=id&modality=eq.presencial&status=eq.confirmed", { headers: { Prefer: "count=exact", Range: "0-0" } }),
    supabaseServerFetch(`encuentro_psicologico_profiles?select=professional_network_opt_in&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_professional_directory?select=share_enabled,profession,specialty,address,email,whatsapp,website,instagram&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_community_reward_events?select=id&owner_user_id=eq.${user.id}`, { headers: { Prefer: "count=exact", Range: "0-0" } }),
    supabaseServerFetch(`encuentro_psicologico_community_resources?select=id&owner_user_id=eq.${user.id}&status=eq.pending`, { headers: { Prefer: "count=exact", Range: "0-0" } }),
  ]);
  const registrations = regResponse.ok ? await regResponse.json() as Array<{ modality:string; status:string; name:string; event_roles?: string[]; speaker_program_item_id?: number | null }> : [];
  const resources = resourceResponse.ok ? await resourceResponse.json() as Array<{ id:number; title:string; description?:string; file_url?:string }> : [];
  const [certificate] = certificateResponse.ok ? await certificateResponse.json() as Array<{ certificate_number?:string; attendance_confirmed:boolean }> : [];
  const [profile] = profileResponse.ok ? await profileResponse.json() as Array<{ professional_network_opt_in: boolean }> : [];
  const [directory] = directoryResponse.ok ? await directoryResponse.json() as ProfessionalDirectory[] : [];
  const presencialCount = Number(capacityResponse.headers.get("content-range")?.split("/")[1] ?? 0);
  const communityStars = rewardResponse.ok ? Number(rewardResponse.headers.get("content-range")?.split("/")[1] ?? 0) : 0;
  const pendingCommunityStars = pendingResourceResponse.ok ? Number(pendingResourceResponse.headers.get("content-range")?.split("/")[1] ?? 0) : 0;
  const canSwitchToVirtual = presencialCount >= EVENT_CAPACITY && registrations.some(item => item.modality === "presencial" && item.status === "confirmed");

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
        <article><span>INSCRIPCIÓN</span><h2>{registrations.length ? "Confirmada" : "Pendiente"}</h2>{registrations.map(item=><p key={item.modality}>{item.modality === "presencial" ? "Presencial" : "Virtual"} · {item.status === "waitlist" ? "Lista de espera" : "Confirmada"}</p>)}{canSwitchToVirtual && <form action="/api/account/modality" method="post" className="switch-modality"><p>El cupo presencial está lleno. Si ya no puedes asistir presencialmente, puedes cambiarte a modalidad virtual y liberar tu espacio.</p><button className="secondary" type="submit">Cambiar mi asistencia a virtual</button></form>}</article>
        <article><span>CONSTANCIA</span><h2>{certificate?.attendance_confirmed ? "Disponible" : "Se habilitará después del evento"}</h2><p>La asistencia debe ser confirmada por la organización.</p>{certificate?.attendance_confirmed && <a className="primary" href="/api/account/certificate">Descargar constancia</a>}</article>
      </div>
      <AttendanceVerifier isOrganizer={registrations.some(item => item.event_roles?.includes("organizer"))} />
      {registrations.some(item => item.event_roles?.includes("speaker")) && <details className="account-resources speaker-account-link"><summary><span>ESPACIO DE PONENTE</span><h2>Preguntas de tu conferencia <b aria-hidden="true">+</b></h2></summary><div className="account-resources-body"><p>Cuando la organización active las preguntas en vivo, aquí tendrás acceso a tu bandeja para marcar las que responderás durante el panel.</p><Link className="primary" href="/preguntas">Abrir preguntas recibidas</Link></div></details>}
      <CommunityLibrary />
      <ProfessionalNetworkEditor initialOptIn={Boolean(profile?.professional_network_opt_in)} initialDirectory={directory ?? null} />
      <details className="account-resources" open><summary><span>RECURSOS DEL ENCUENTRO</span><h2>Materiales y recursos <b aria-hidden="true">+</b></h2></summary><div className="account-resources-body">{resources.length ? resources.map(resource=><article key={resource.id}><div><b>{resource.title}</b><p>{resource.description}</p></div>{resource.file_url && <a href={resource.file_url} target="_blank" rel="noreferrer">Descargar ↓</a>}</article>) : <p>Los materiales aparecerán aquí cuando el administrador los publique.</p>}</div></details>
    </section>
  </main>;
}
