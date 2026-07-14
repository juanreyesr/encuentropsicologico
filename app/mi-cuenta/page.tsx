import { requireUser } from "../../lib/auth";
import { EVENT_CAPACITY } from "../../lib/event";
import { supabaseServerFetch } from "../../lib/supabase-server";
import Link from "next/link";
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  const [regResponse, resourceResponse, certificateResponse, capacityResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_registrations?select=modality,status,name&user_id=eq.${user.id}`),
    supabaseServerFetch("encuentro_psicologico_resources?select=id,title,description,file_url&is_published=eq.true&order=created_at.desc"),
    supabaseServerFetch(`encuentro_psicologico_certificates?select=certificate_number,attendance_confirmed,issued_at&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch("encuentro_psicologico_registrations?select=id&modality=eq.presencial&status=eq.confirmed", { headers: { Prefer: "count=exact", Range: "0-0" } }),
  ]);
  const registrations = regResponse.ok ? await regResponse.json() as Array<{ modality:string; status:string; name:string }> : [];
  const resources = resourceResponse.ok ? await resourceResponse.json() as Array<{ id:number; title:string; description?:string; file_url?:string }> : [];
  const [certificate] = certificateResponse.ok ? await certificateResponse.json() as Array<{ certificate_number?:string; attendance_confirmed:boolean }> : [];
  const presencialCount = Number(capacityResponse.headers.get("content-range")?.split("/")[1] ?? 0);
  const canSwitchToVirtual = presencialCount >= EVENT_CAPACITY && registrations.some(item => item.modality === "presencial" && item.status === "confirmed");
  return <main className="account-page"><header><Link href="/" className="access-brand"><img src="/duelo-simbolo.png" alt="" /> Encuentro Clínico</Link><form action="/api/auth/logout" method="post"><button>Cerrar sesión</button></form></header><section><p className="section-kicker">ÁREA DEL PARTICIPANTE</p><h1>Hola, {registrations[0]?.name ?? user.email}.</h1><p>Aquí encontrarás tu inscripción, materiales y constancia de participación.</p><div className="account-grid"><article><span>INSCRIPCIÓN</span><h2>{registrations.length ? "Confirmada" : "Pendiente"}</h2>{registrations.map(item=><p key={item.modality}>{item.modality === "presencial" ? "Presencial" : "Virtual"} · {item.status === "waitlist" ? "Lista de espera" : "Confirmada"}</p>)}{canSwitchToVirtual && <form action="/api/account/modality" method="post" className="switch-modality"><p>El cupo presencial está lleno. Si ya no puedes asistir presencialmente, puedes cambiarte a modalidad virtual y liberar tu espacio.</p><button className="secondary" type="submit">Cambiar mi asistencia a virtual</button></form>}</article><article><span>CONSTANCIA</span><h2>{certificate?.attendance_confirmed ? "Disponible" : "Se habilitará después del evento"}</h2><p>La asistencia debe ser confirmada por la organización.</p>{certificate?.attendance_confirmed && <a className="primary" href="/api/account/certificate">Descargar constancia</a>}</article></div><div className="account-resources"><h2>Materiales y recursos</h2>{resources.length ? resources.map(resource=><article key={resource.id}><div><b>{resource.title}</b><p>{resource.description}</p></div>{resource.file_url && <a href={resource.file_url} target="_blank" rel="noreferrer">Descargar ↓</a>}</article>) : <p>Los materiales aparecerán aquí cuando el administrador los publique.</p>}</div></section></main>;
}
