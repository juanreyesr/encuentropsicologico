"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EventProgramItem, EventSpeaker } from "../../lib/event";
import { programTimeLabel } from "../../lib/event";
import CertificateManager from "./CertificateManager";
import QuestionControl from "./QuestionControl";
import AttendanceControl from "./AttendanceControl";
import SponsorManager from "./SponsorManager";

type DashboardData = {
  daysRemaining: number;
  metrics: { total: number; presencial: number; virtual: number; waitlist: number; available: number; capacity: number; students?: number; professionals?: number; networkOptIns?: number; sharedDirectory?: number; guatemala?: number; speakers?: number; organizers?: number };
  recent: Array<{ id: number; name: string; modality: string; status: string; created_at: string }>;
  problems: { open: number; recent: Array<{ id: number; phone: string; problem: string; status: string; created_at: string }> };
  professionalNetwork: {
    optIns: Array<{ id: number; name: string; modality: string; status: string; created_at: string }>;
    shared: Array<{ user_id: string; name: string; participant_email: string | null; phone: string | null; share_enabled: boolean; profession: string | null; specialty: string | null; address: string | null; email: string | null; whatsapp: string | null; website: string | null; instagram: string | null; updated_at: string }>;
  };
  statistics: { departments: Array<{ label: string; value: number }>; genders: Array<{ label: string; value: number }>; professions: Array<{ label: string; value: number }>; countries: Array<{ label: string; value: number }>; modalities: Array<{ label: string; value: number }>; profiles: Array<{ label: string; value: number }> };
};

type SiteContent = { title: string; date: string; place: string; description: string; live: boolean; liveTitle: string; liveUrl: string };
type Section = "Resumen" | "Contenido" | "Inscritos" | "Programa" | "Ponentes" | "Preguntas" | "Certificados" | "Patrocinadores" | "Red profesional" | "Biblioteca" | "Problemas" | "Transmisión";
type SpeakerDraft = Omit<EventSpeaker, "id">;
type ProgramDraft = Omit<EventProgramItem, "id">;
type Registration = { id: number; user_id: string | null; modality: string; name: string; email: string; phone: string; attendee_type: string; profession: string | null; license: string | null; institution: string | null; country: string; department: string | null; gender: string | null; status: string; professional_network_opt_in: boolean; event_roles: string[]; speaker_program_item_id: number | null; created_at: string };
type RegistrationDraft = Omit<Registration, "id" | "user_id" | "created_at">;
type CommunityAdminResource = { id: number; owner_user_id: string; category_id: number; category_name: string; contributor_name: string; title: string; description: string | null; source_author: string | null; rights_basis: string; responsibility_accepted_at: string; original_filename: string; mime_type: string; size_bytes: number; status: string; moderation_reason: string | null; created_at: string };
type CommunityAdminData = { resources: CommunityAdminResource[]; metrics: { pending: number; approved: number; rejected: number } };

const emptyDashboard: DashboardData = { daysRemaining: 0, metrics: { total: 0, presencial: 0, virtual: 0, waitlist: 0, available: 250, capacity: 250, students: 0, professionals: 0, networkOptIns: 0, sharedDirectory: 0, guatemala: 0, speakers: 0, organizers: 0 }, recent: [], problems: { open: 0, recent: [] }, professionalNetwork: { optIns: [], shared: [] }, statistics: { departments: [], genders: [], professions: [], countries: [], modalities: [], profiles: [] } };
const emptySpeaker: SpeakerDraft = { name: "", professional_title: "", talk_title: "", talk_time: "", program_item_id: null, bio: "", photo_url: null, video_url: null, contact_email: "", contact_phone: "", contact_website: "", display_order: 0, is_published: false };
const emptyProgramItem: ProgramDraft = { start_time: "", end_time: "", type: "", title: "", description: "", details: "", display_order: 0, is_published: true };
const emptyRegistration: RegistrationDraft = { modality: "presencial", name: "", email: "", phone: "", attendee_type: "general", profession: "", license: "", institution: "", country: "Guatemala", department: "", gender: "", status: "confirmed", professional_network_opt_in: false, event_roles: [], speaker_program_item_id: null };
const sections: Section[] = ["Resumen", "Contenido", "Inscritos", "Programa", "Ponentes", "Preguntas", "Certificados", "Patrocinadores", "Red profesional", "Biblioteca", "Problemas", "Transmisión"];
const navIcons = ["◇", "✎", "▤", "☷", "◉", "?", "▱", "◆", "♢", "▧", "!", "▶"];

function displayProgramOption(item: EventProgramItem) {
  return `${programTimeLabel(item)} · ${item.type} · ${item.title}`;
}

export default function AdminDashboard({ userName }: { userName: string }) {
  const [active, setActive] = useState<Section>("Resumen");
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [program, setProgram] = useState<EventProgramItem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [community, setCommunity] = useState<CommunityAdminData>({ resources: [], metrics: { pending: 0, approved: 0, rejected: 0 } });
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<number | "new">("new");
  const [selectedProgramId, setSelectedProgramId] = useState<number | "new">("new");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<number | null>(null);
  const [speakerDraft, setSpeakerDraft] = useState<SpeakerDraft>(emptySpeaker);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(emptyProgramItem);
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationDraft>(emptyRegistration);
  const [content, setContent] = useState<SiteContent>({ title: "Cuando el Duelo se Detiene", date: "15 de agosto de 2026", place: "Chimaltenango", description: "Jornada Clínica sobre Duelo Prolongado.", live: false, liveTitle: "Encuentro en vivo", liveUrl: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "video" | null>(null);
  const [message, setMessage] = useState("");
  const [registrationSearch, setRegistrationSearch] = useState("");

  const selectedProgramOptions = useMemo(() => program, [program]);
  const filteredRegistrations = useMemo(() => {
    const query = registrationSearch.trim().toLocaleLowerCase("es");
    if (!query) return registrations;
    return registrations.filter(item => [item.name, item.email, item.phone, item.department, item.profession].filter(Boolean).some(value => String(value).toLocaleLowerCase("es").includes(query)));
  }, [registrations, registrationSearch]);

  async function loadAll() {
    setLoading(true);
    const [dashboardResponse, speakersResponse, contentResponse, programResponse, registrationsResponse, communityResponse] = await Promise.all([
      fetch("/api/admin/dashboard"),
      fetch("/api/admin/speakers"),
      fetch("/api/admin/content"),
      fetch("/api/admin/program"),
      fetch("/api/admin/registrations"),
      fetch("/api/admin/community-resources"),
    ]);
    if (dashboardResponse.ok) setDashboard(await dashboardResponse.json());
    if (speakersResponse.ok) setSpeakers((await speakersResponse.json()).speakers);
    if (programResponse.ok) setProgram((await programResponse.json()).program);
    if (registrationsResponse.ok) setRegistrations((await registrationsResponse.json()).registrations);
    if (communityResponse.ok) setCommunity(await communityResponse.json());
    if (contentResponse.ok) {
      const saved = await contentResponse.json();
      setContent(current => ({ ...current, ...saved, live: Boolean(saved.live) }));
    }
    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([fetch("/api/admin/dashboard"), fetch("/api/admin/speakers"), fetch("/api/admin/content"), fetch("/api/admin/program"), fetch("/api/admin/registrations"), fetch("/api/admin/community-resources")]).then(async ([dashboardResponse, speakersResponse, contentResponse, programResponse, registrationsResponse, communityResponse]) => {
      if (ignore) return;
      if (dashboardResponse.ok) setDashboard(await dashboardResponse.json());
      if (speakersResponse.ok) setSpeakers((await speakersResponse.json()).speakers);
      if (programResponse.ok) setProgram((await programResponse.json()).program);
      if (registrationsResponse.ok) setRegistrations((await registrationsResponse.json()).registrations);
      if (communityResponse.ok) setCommunity(await communityResponse.json());
      if (contentResponse.ok) {
        const saved = await contentResponse.json();
        setContent(current => ({ ...current, ...saved, live: Boolean(saved.live) }));
      }
      setLoading(false);
    }).catch(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetch("/api/admin/dashboard", { cache: "no-store" }).then(async response => { if (response.ok) setDashboard(await response.json()); }).catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  function flash(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 3500);
  }

  async function saveContent() {
    setSaving(true);
    const response = await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    setSaving(false);
    flash(response.ok ? "Cambios guardados y listos para publicar." : "No se pudieron guardar los cambios.");
  }

  function selectSpeaker(speaker?: EventSpeaker) {
    if (!speaker) {
      setSelectedSpeakerId("new");
      setSpeakerDraft({ ...emptySpeaker, display_order: speakers.length + 1 });
      return;
    }
    const { id, ...draft } = speaker;
    setSelectedSpeakerId(id);
    setSpeakerDraft(draft);
  }

  function selectProgramItem(item?: EventProgramItem) {
    if (!item) {
      setSelectedProgramId("new");
      setProgramDraft({ ...emptyProgramItem, display_order: program.length + 1 });
      return;
    }
    const { id, ...draft } = item;
    setSelectedProgramId(id);
    setProgramDraft(draft);
  }

  function selectRegistration(registration?: Registration) {
    if (!registration) {
      setSelectedRegistrationId(null);
      setRegistrationDraft(emptyRegistration);
      return;
    }
    const draft: RegistrationDraft = {
      modality: registration.modality,
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      attendee_type: registration.attendee_type,
      profession: registration.profession ?? "",
      license: registration.license ?? "",
      institution: registration.institution ?? "",
      country: registration.country,
      department: registration.department ?? "",
      gender: registration.gender ?? "",
      status: registration.status,
      professional_network_opt_in: registration.professional_network_opt_in,
      event_roles: registration.event_roles ?? [],
      speaker_program_item_id: registration.speaker_program_item_id ?? null,
    };
    const { id } = registration;
    setSelectedRegistrationId(id);
    setRegistrationDraft(draft);
  }

  async function saveSpeaker() {
    if (!speakerDraft.name.trim()) { flash("Escribe el nombre del ponente."); return; }
    setSaving(true);
    const payload = selectedSpeakerId === "new" ? speakerDraft : { id: selectedSpeakerId, ...speakerDraft };
    const response = await fetch("/api/admin/speakers", { method: selectedSpeakerId === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { flash(result.error ?? "No se pudo guardar el ponente."); return; }
    const savedSpeaker = result.speaker as EventSpeaker;
    setSpeakers(current => (selectedSpeakerId === "new" ? [...current, savedSpeaker] : current.map(item => item.id === savedSpeaker.id ? savedSpeaker : item)).sort((a, b) => a.display_order - b.display_order || a.id - b.id));
    selectSpeaker(savedSpeaker);
    flash("Ponente guardado correctamente.");
  }

  async function saveProgramItem() {
    if (!programDraft.title.trim()) { flash("Escribe el nombre del bloque del programa."); return; }
    setSaving(true);
    const payload = selectedProgramId === "new" ? programDraft : { id: selectedProgramId, ...programDraft };
    const response = await fetch("/api/admin/program", { method: selectedProgramId === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { flash(result.error ?? "No se pudo guardar el bloque."); return; }
    const savedItem = result.item as EventProgramItem;
    setProgram(current => (selectedProgramId === "new" ? [...current, savedItem] : current.map(item => item.id === savedItem.id ? savedItem : item)).sort((a, b) => a.display_order - b.display_order || a.id - b.id));
    selectProgramItem(savedItem);
    flash("Programa actualizado correctamente.");
  }

  async function saveRegistration() {
    if (!selectedRegistrationId) { flash("Selecciona un inscrito."); return; }
    if (!registrationDraft.name.trim()) { flash("Escribe el nombre del inscrito."); return; }
    setSaving(true);
    const response = await fetch("/api/admin/registrations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selectedRegistrationId, ...registrationDraft }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { flash(result.error ?? "No se pudo guardar el inscrito."); return; }
    await loadAll();
    selectRegistration(result.registration as Registration);
    flash("Inscripción actualizada.");
  }

  async function removeSpeaker() {
    if (selectedSpeakerId === "new" || !window.confirm("¿Eliminar este ponente? Esta acción no se puede deshacer.")) return;
    const response = await fetch(`/api/admin/speakers?id=${selectedSpeakerId}`, { method: "DELETE" });
    if (!response.ok) { flash("No se pudo eliminar el ponente."); return; }
    selectSpeaker();
    await loadAll();
    flash("Ponente eliminado.");
  }

  async function removeProgramItem() {
    if (selectedProgramId === "new" || !window.confirm("¿Eliminar este bloque del programa?")) return;
    const response = await fetch(`/api/admin/program?id=${selectedProgramId}`, { method: "DELETE" });
    if (!response.ok) { flash("No se pudo eliminar el bloque."); return; }
    selectProgramItem();
    await loadAll();
    flash("Bloque eliminado.");
  }

  async function removeRegistration() {
    if (!selectedRegistrationId || !window.confirm("¿Borrar esta inscripción del evento? No se borrará el usuario global de Supabase.")) return;
    const response = await fetch(`/api/admin/registrations?id=${selectedRegistrationId}`, { method: "DELETE" });
    if (!response.ok) { flash("No se pudo borrar la inscripción."); return; }
    selectRegistration();
    await loadAll();
    flash("Inscripción borrada del evento.");
  }

  async function moderateCommunityResource(id: number, status: "approved" | "rejected") {
    const reason = status === "rejected" ? window.prompt("Indica brevemente por qué no se aprobará este recurso:") : "";
    if (status === "rejected" && reason === null) return;
    setSaving(true);
    const response = await fetch("/api/admin/community-resources", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, reason }) });
    setSaving(false);
    if (!response.ok) { flash("No se pudo actualizar el recurso."); return; }
    await loadAll();
    flash(status === "approved" ? "Recurso aprobado y publicado." : "Recurso marcado como no aprobado.");
  }

  async function removeCommunityResource(id: number) {
    if (!window.confirm("¿Retirar y borrar el archivo de este recurso? También se descontarán las estrellas relacionadas.")) return;
    setSaving(true);
    const response = await fetch(`/api/admin/community-resources?id=${id}`, { method: "DELETE" });
    setSaving(false);
    if (!response.ok) { flash("No se pudo retirar el recurso."); return; }
    await loadAll();
    flash("Recurso retirado de la biblioteca.");
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>, kind: "photo" | "video") {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/admin/media", { method: "POST", body: form });
    const result = await response.json();
    setUploading(null);
    if (!response.ok) { flash(result.error ?? "No se pudo cargar el archivo."); return; }
    setSpeakerDraft(current => ({ ...current, [kind === "photo" ? "photo_url" : "video_url"]: result.url }));
    flash(kind === "photo" ? "Fotografía cargada. Guarda el ponente." : "Video cargado. Guarda el ponente.");
  }

  function saveCurrentSection() {
    if (active === "Ponentes") return saveSpeaker();
    if (active === "Programa") return saveProgramItem();
    if (active === "Inscritos") return saveRegistration();
    return saveContent();
  }

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/"><img src="/logo-duelo-arbol-morado.png" alt="" /><b>Encuentro Clínico</b></Link>
      <nav>{sections.map((item, index) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{navIcons[index]}</span>{item}{item === "Inscritos" && registrations.length > 0 && <i>{registrations.length}</i>}{item === "Programa" && program.length > 0 && <i>{program.length}</i>}{item === "Ponentes" && speakers.length > 0 && <i>{speakers.length}</i>}{item === "Red profesional" && (dashboard.metrics.networkOptIns ?? 0) > 0 && <i>{dashboard.metrics.networkOptIns}</i>}{item === "Biblioteca" && community.metrics.pending > 0 && <i className="alert-dot">{community.metrics.pending}</i>}{item === "Problemas" && dashboard.problems.open > 0 && <i className="alert-dot">{dashboard.problems.open}</i>}</button>)}</nav>
      <div className="admin-user"><span>{userName.slice(0, 2).toUpperCase()}</span><div><b>{userName}</b><small>Administrador</small></div><form action="/api/auth/logout" method="post"><button aria-label="Cerrar sesión">→</button></form></div>
    </aside>
    <section className="admin-main">
      <header><div><p>Panel de administración</p><h1>{active}</h1></div><div className="admin-header-actions"><Link href="/" target="_blank">Ver sitio ↗</Link>{["Contenido", "Inscritos", "Programa", "Ponentes", "Transmisión"].includes(active) && <button className="admin-save" disabled={saving || (active === "Inscritos" && !selectedRegistrationId)} onClick={saveCurrentSection}>{saving ? "Guardando…" : "Guardar cambios"}</button>}</div></header>
      {message && <div className="admin-toast" role="status">{message}</div>}

      {active === "Resumen" && <div className="admin-content">
        <div className="welcome"><div><p>ESTADO DEL EVENTO</p><h2>Información real,<br />lista para trabajar.</h2><span>{loading ? "Actualizando información…" : dashboard.daysRemaining > 0 ? `Faltan ${dashboard.daysRemaining} días para el evento.` : "La fecha del evento ha llegado."}</span></div><div className="event-ring"><b>{loading ? "—" : dashboard.daysRemaining}</b><small>DÍAS</small></div></div>
        <div className="stat-grid dashboard-stat-grid"><article><span>Inscripciones confirmadas</span><b>{loading ? "—" : dashboard.metrics.total}</b><small>Total real en Supabase</small></article><article><span>Presenciales</span><b>{loading ? "—" : dashboard.metrics.presencial}</b><small>Confirmadas</small></article><article><span>Virtuales</span><b>{loading ? "—" : dashboard.metrics.virtual}</b><small>Confirmadas</small></article><article><span>Cupo disponible</span><b>{loading ? "—" : dashboard.metrics.available}</b><small>de {dashboard.metrics.capacity} presenciales · espera: {dashboard.metrics.waitlist}</small></article><article><span>Profesionales</span><b>{loading ? "—" : dashboard.metrics.professionals ?? 0}</b><small>Perfil profesional</small></article><article><span>Estudiantes</span><b>{loading ? "—" : dashboard.metrics.students ?? 0}</b><small>Perfil estudiante</small></article><article><span>Red profesional</span><b>{loading ? "—" : dashboard.metrics.networkOptIns ?? 0}</b><small>Desean ser parte</small></article><article><span>Datos compartidos</span><b>{loading ? "—" : dashboard.metrics.sharedDirectory ?? 0}</b><small>Directorio profesional</small></article></div>
        <div className="dashboard-breakdowns"><article className="panel"><div className="panel-title"><h3>Distribución por departamento</h3><small>Actualización automática</small></div>{dashboard.statistics.departments.length ? dashboard.statistics.departments.map(item => <p key={item.label}><span>{item.label}</span><b>{item.value}</b></p>) : <div className="admin-empty"><p>Aparecerá con las nuevas inscripciones.</p></div>}</article><article className="panel"><div className="panel-title"><h3>Profesiones y procedencia</h3><small>Datos útiles para logística</small></div>{[...dashboard.statistics.professions.slice(0, 4), ...dashboard.statistics.countries.slice(0, 3)].map(item => <p className="compact-stat" key={`${item.label}-${item.value}`}><span>{item.label}</span><b>{item.value}</b></p>) || <div className="admin-empty"><p>Se mostrará cuando haya datos.</p></div>}</article></div>
        <div className="admin-columns"><article className="panel"><div className="panel-title"><h3>Inscripciones recientes</h3></div>{dashboard.recent.length === 0 ? <div className="admin-empty"><b>Aún no hay inscripciones.</b><p>Las nuevas inscripciones aparecerán aquí automáticamente.</p></div> : dashboard.recent.map(item => <div className="activity" key={item.id}><span>+</span><p>{item.name}<small>{item.modality === "presencial" ? "Presencial" : "Virtual"} · {item.status === "waitlist" ? "Lista de espera" : "Confirmada"} · {new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</small></p></div>)}</article><article className="panel"><div className="panel-title"><h3>Estadísticas rápidas</h3><span className="online">Admin</span></div><div className="analytics-bars"><p><span>Presencial</span><b style={{ width: `${dashboard.metrics.total ? Math.round((dashboard.metrics.presencial / dashboard.metrics.total) * 100) : 0}%` }} /></p><p><span>Virtual</span><b style={{ width: `${dashboard.metrics.total ? Math.round((dashboard.metrics.virtual / dashboard.metrics.total) * 100) : 0}%` }} /></p><p><span>Red profesional</span><b style={{ width: `${dashboard.metrics.total ? Math.round(((dashboard.metrics.networkOptIns ?? 0) / dashboard.metrics.total) * 100) : 0}%` }} /></p><p><span>Guatemala</span><b style={{ width: `${dashboard.metrics.total ? Math.round(((dashboard.metrics.guatemala ?? 0) / dashboard.metrics.total) * 100) : 0}%` }} /></p></div><div className="quick-form-stats">{[...dashboard.statistics.genders, ...dashboard.statistics.profiles].map(item => <p key={`${item.label}-${item.value}`}><span>{item.label}</span><b>{item.value}</b></p>)}</div></article><article className="panel"><div className="panel-title"><h3>Estado del sitio</h3><span className="online">En línea</span></div><div className="checklist"><p><span>✓</span> Información general <b>Conectada</b></p><p><span>✓</span> Programa <b>{program.length ? `${program.length} bloques` : "Pendiente"}</b></p><p><span>{speakers.length ? "✓" : "·"}</span> Ponentes <b>{speakers.length ? `${speakers.filter(item => item.is_published).length} publicados` : "Sin agregar"}</b></p><p><span>{content.live ? "✓" : "·"}</span> Transmisión <b>{content.live ? "Activa" : "Desactivada"}</b></p></div></article></div>
      </div>}

      {active === "Contenido" && <div className="admin-content editor-page"><div className="panel"><p className="admin-kicker">PORTADA DEL SITIO</p><h2>Información principal</h2><label>Título del evento<input value={content.title} onChange={event => setContent({ ...content, title: event.target.value })} /></label><label>Fecha<input value={content.date} onChange={event => setContent({ ...content, date: event.target.value })} /></label><label>Lugar<input value={content.place} onChange={event => setContent({ ...content, place: event.target.value })} /></label><label>Descripción<textarea rows={5} value={content.description} onChange={event => setContent({ ...content, description: event.target.value })} /></label></div><div className="panel preview-card"><p>VISTA PREVIA</p><div><small>{content.date} · {content.place}</small><h3>{content.title}</h3><p>{content.description}</p></div></div></div>}

      {active === "Inscritos" && <div className="admin-content speaker-admin registrations-admin">
        <aside className="panel speaker-list"><div className="panel-title"><h3>Inscritos</h3><span>{registrations.length}</span></div><label className="admin-search"><span aria-hidden="true">⌕</span><input value={registrationSearch} onChange={event => setRegistrationSearch(event.target.value)} placeholder="Buscar nombre, correo o teléfono" aria-label="Buscar inscritos" /></label>{registrations.length === 0 ? <div className="admin-empty"><b>No hay inscritos.</b><p>Cuando se registren participantes, aparecerán aquí.</p></div> : filteredRegistrations.length === 0 ? <div className="admin-empty"><b>Sin coincidencias.</b><p>Prueba con otro nombre, correo o teléfono.</p></div> : filteredRegistrations.map(registration => <button key={registration.id} className={selectedRegistrationId === registration.id ? "selected" : ""} onClick={() => selectRegistration(registration)}><span>{registration.name.slice(0, 1)}</span><div><b>{registration.name}</b><small>{registration.modality === "presencial" ? "Presencial" : "Virtual"} · {registration.status === "waitlist" ? "Lista de espera" : "Confirmada"} · {registration.email}</small></div></button>)}</aside>
        <section className="panel speaker-editor"><div className="panel-title"><h3>{selectedRegistrationId ? "Editar inscrito" : "Selecciona un inscrito"}</h3>{selectedRegistrationId && <button className="danger-link" onClick={removeRegistration}>Borrar inscripción</button>}</div>{selectedRegistrationId ? <><p className="admin-note">Estos cambios aplican solo al registro del evento. Para proteger otras apps, no se borra ni modifica el usuario global de Supabase.</p><div className="speaker-form-grid"><label>Nombre completo<input value={registrationDraft.name} onChange={event => setRegistrationDraft({ ...registrationDraft, name: event.target.value })} /></label><label>Correo del registro<input type="email" value={registrationDraft.email} onChange={event => setRegistrationDraft({ ...registrationDraft, email: event.target.value })} /></label><label>Teléfono<input inputMode="numeric" value={registrationDraft.phone} onChange={event => setRegistrationDraft({ ...registrationDraft, phone: event.target.value.replace(/\D/g, "") })} /></label><label>Género<select value={registrationDraft.gender ?? ""} onChange={event => setRegistrationDraft({ ...registrationDraft, gender: event.target.value })}><option value="">Sin dato</option><option>Hombre</option><option>Mujer</option></select></label><label>Modalidad<select value={registrationDraft.modality} onChange={event => setRegistrationDraft({ ...registrationDraft, modality: event.target.value })}><option value="presencial">Presencial</option><option value="virtual">Virtual</option></select></label><label>Estado<select value={registrationDraft.status} onChange={event => setRegistrationDraft({ ...registrationDraft, status: event.target.value })}><option value="confirmed">Confirmada</option><option value="waitlist">Lista de espera</option><option value="cancelled">Cancelada</option></select></label><label>Perfil<select value={registrationDraft.attendee_type} onChange={event => setRegistrationDraft({ ...registrationDraft, attendee_type: event.target.value })}><option value="general">General</option><option value="student">Estudiante</option><option value="professional">Profesional</option></select></label><label>Profesión<input value={registrationDraft.profession ?? ""} onChange={event => setRegistrationDraft({ ...registrationDraft, profession: event.target.value })} /></label><label>Número de colegiado<input inputMode="numeric" value={registrationDraft.license ?? ""} onChange={event => setRegistrationDraft({ ...registrationDraft, license: event.target.value.replace(/\D/g, "") })} /></label><label>Institución / Universidad<input value={registrationDraft.institution ?? ""} onChange={event => setRegistrationDraft({ ...registrationDraft, institution: event.target.value })} /></label><label>País<input value={registrationDraft.country} onChange={event => setRegistrationDraft({ ...registrationDraft, country: event.target.value })} /></label><label>Departamento<input value={registrationDraft.department ?? ""} onChange={event => setRegistrationDraft({ ...registrationDraft, department: event.target.value })} /></label></div><div className="event-role-box"><b>Funciones dentro de la actividad</b><label><input type="checkbox" checked={registrationDraft.event_roles?.includes("organizer")} onChange={event => setRegistrationDraft({ ...registrationDraft, event_roles: event.target.checked ? [...registrationDraft.event_roles.filter(role => role !== "organizer"), "organizer"] : registrationDraft.event_roles.filter(role => role !== "organizer") })} /> Organizador</label><label><input type="checkbox" checked={registrationDraft.event_roles?.includes("speaker")} onChange={event => setRegistrationDraft({ ...registrationDraft, event_roles: event.target.checked ? [...registrationDraft.event_roles.filter(role => role !== "speaker"), "speaker"] : registrationDraft.event_roles.filter(role => role !== "speaker"), speaker_program_item_id: event.target.checked ? registrationDraft.speaker_program_item_id : null })} /> Ponente de la actividad</label>{registrationDraft.event_roles?.includes("speaker") && <label>Conferencia asignada *<select required value={registrationDraft.speaker_program_item_id ?? ""} onChange={event => setRegistrationDraft({ ...registrationDraft, speaker_program_item_id: event.target.value ? Number(event.target.value) : null })}><option value="">Selecciona una conferencia</option>{program.map(item => <option key={item.id} value={item.id}>{displayProgramOption(item)}</option>)}</select></label>}<small>Al asignar una ponencia, las preguntas de esa conferencia llegarán al espacio de este usuario.</small></div><label className="publish-check"><input type="checkbox" checked={registrationDraft.professional_network_opt_in} onChange={event => setRegistrationDraft({ ...registrationDraft, professional_network_opt_in: event.target.checked })} /><span><b>Quiere ser parte de la red profesional</b><small>Esto solo marca el interés; los datos compartibles se llenan desde la cuenta del participante.</small></span></label></> : <div className="admin-empty"><b>Elige un registro.</b><p>Podrás corregir datos, asignar una función o borrar la inscripción del evento.</p></div>}</section>
      </div>}

      {active === "Programa" && <div className="admin-content speaker-admin program-admin">
        <aside className="panel speaker-list"><div className="panel-title"><h3>Programa</h3><button onClick={() => selectProgramItem()}>+ Nuevo</button></div>{program.length === 0 ? <div className="admin-empty"><b>No hay bloques.</b><p>Crea el programa completo de la actividad.</p></div> : program.map(item => <button key={item.id} className={selectedProgramId === item.id ? "selected" : ""} onClick={() => selectProgramItem(item)}><span>{item.display_order}</span><div><b>{item.title}</b><small>{programTimeLabel(item)} · {item.type || "Sin tipo"} · {item.is_published ? "Visible" : "Oculto"}</small></div></button>)}</aside>
        <section className="panel speaker-editor"><div className="panel-title"><h3>{selectedProgramId === "new" ? "Nuevo bloque" : "Editar bloque"}</h3>{selectedProgramId !== "new" && <button className="danger-link" onClick={removeProgramItem}>Eliminar</button>}</div><div className="speaker-form-grid"><label>Inicio<input value={programDraft.start_time} onChange={event => setProgramDraft({ ...programDraft, start_time: event.target.value })} placeholder="8:30" /></label><label>Final<input value={programDraft.end_time} onChange={event => setProgramDraft({ ...programDraft, end_time: event.target.value })} placeholder="9:00" /></label><label>Tipo<input value={programDraft.type} onChange={event => setProgramDraft({ ...programDraft, type: event.target.value })} placeholder="Charla 1, Receso, Cierre..." /></label><label>Orden<input type="number" min="0" value={programDraft.display_order} onChange={event => setProgramDraft({ ...programDraft, display_order: Number(event.target.value) })} /></label><label className="wide">Nombre del bloque *<input value={programDraft.title} onChange={event => setProgramDraft({ ...programDraft, title: event.target.value })} /></label><label className="wide">Descripción breve<input value={programDraft.description} onChange={event => setProgramDraft({ ...programDraft, description: event.target.value })} placeholder="Texto que aparece debajo del título en el programa." /></label><label className="wide">Detalles al presionar +<textarea rows={6} value={programDraft.details} onChange={event => setProgramDraft({ ...programDraft, details: event.target.value })} placeholder="Detalles del coffee break, introducción, cierre o notas de la conferencia." /></label></div><label className="publish-check"><input type="checkbox" checked={programDraft.is_published} onChange={event => setProgramDraft({ ...programDraft, is_published: event.target.checked })} /><span><b>Mostrar en el programa público</b><small>Si está oculto, no aparecerá en la agenda del sitio.</small></span></label></section>
      </div>}

      {active === "Ponentes" && <div className="admin-content speaker-admin">
        <aside className="panel speaker-list"><div className="panel-title"><h3>Ponentes</h3><button onClick={() => selectSpeaker()}>+ Nuevo</button></div>{speakers.length === 0 ? <div className="admin-empty"><b>No hay ponentes agregados.</b><p>Crea el primero y publícalo cuando su ficha esté completa.</p></div> : speakers.map(speaker => {
          const linkedProgram = program.find(item => item.id === speaker.program_item_id);
          return <button key={speaker.id} className={selectedSpeakerId === speaker.id ? "selected" : ""} onClick={() => selectSpeaker(speaker)}>{speaker.photo_url ? <img src={speaker.photo_url} alt="" /> : <span>{speaker.name.slice(0, 1)}</span>}<div><b>{speaker.name}</b><small>{linkedProgram ? programTimeLabel(linkedProgram) : speaker.talk_time || "Horario pendiente"} · {speaker.is_published ? "Publicado" : "Borrador"}</small></div></button>;
        })}</aside>
        <section className="panel speaker-editor"><div className="panel-title"><h3>{selectedSpeakerId === "new" ? "Nuevo ponente" : "Editar ponente"}</h3>{selectedSpeakerId !== "new" && <button className="danger-link" onClick={removeSpeaker}>Eliminar</button>}</div><div className="speaker-form-grid"><label>Nombre completo *<input value={speakerDraft.name} onChange={event => setSpeakerDraft({ ...speakerDraft, name: event.target.value })} /></label><label>Título profesional<input value={speakerDraft.professional_title} onChange={event => setSpeakerDraft({ ...speakerDraft, professional_title: event.target.value })} placeholder="Ej. Psicóloga clínica, MSc." /></label><label>Espacio del programa<select value={speakerDraft.program_item_id ?? ""} onChange={event => {
          const itemId = event.target.value ? Number(event.target.value) : null;
          const item = program.find(programItem => programItem.id === itemId);
          setSpeakerDraft({ ...speakerDraft, program_item_id: itemId, talk_time: item ? programTimeLabel(item) : "" });
        }}><option value="">Selecciona un espacio</option>{selectedProgramOptions.map(item => <option key={item.id} value={item.id}>{displayProgramOption(item)}</option>)}</select></label><label>Orden de aparición<input type="number" min="0" value={speakerDraft.display_order} onChange={event => setSpeakerDraft({ ...speakerDraft, display_order: Number(event.target.value) })} /></label><label className="wide">Título de la ponencia<input value={speakerDraft.talk_title} onChange={event => setSpeakerDraft({ ...speakerDraft, talk_title: event.target.value })} /></label><label className="wide">Resumen de experiencia<textarea rows={7} value={speakerDraft.bio} onChange={event => setSpeakerDraft({ ...speakerDraft, bio: event.target.value })} placeholder="Trayectoria, especialidades, experiencia y enfoque profesional." /></label><label>Correo de contacto<input type="email" value={speakerDraft.contact_email} onChange={event => setSpeakerDraft({ ...speakerDraft, contact_email: event.target.value })} placeholder="correo@clinica.com" /></label><label>Teléfono de contacto<input inputMode="tel" value={speakerDraft.contact_phone} onChange={event => setSpeakerDraft({ ...speakerDraft, contact_phone: event.target.value })} placeholder="502..." /></label><label className="wide">Sitio web o enlace profesional<input value={speakerDraft.contact_website} onChange={event => setSpeakerDraft({ ...speakerDraft, contact_website: event.target.value })} placeholder="https://..." /></label></div><div className="media-fields"><label className="media-upload"><b>Fotografía</b><small>JPG, PNG o WebP · se ajustará desde arriba para no cortar la cabeza</small>{speakerDraft.photo_url && <img src={speakerDraft.photo_url} alt="Vista previa del ponente" />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadMedia(event, "photo")} /><span>{uploading === "photo" ? "Cargando…" : speakerDraft.photo_url ? "Cambiar fotografía" : "Cargar fotografía"}</span></label><label className="media-upload"><b>Video del ponente</b><small>MP4 o WebM · máximo 50 MB</small>{speakerDraft.video_url && <video src={speakerDraft.video_url} controls preload="metadata" />}<input type="file" accept="video/mp4,video/webm" onChange={event => uploadMedia(event, "video")} /><span>{uploading === "video" ? "Cargando…" : speakerDraft.video_url ? "Cambiar video" : "Cargar video"}</span></label></div><label className="publish-check"><input type="checkbox" checked={speakerDraft.is_published} onChange={event => setSpeakerDraft({ ...speakerDraft, is_published: event.target.checked })} /><span><b>Publicar en el sitio</b><small>La ficha será visible para todos los visitantes.</small></span></label></section>
      </div>}

      {active === "Preguntas" && <><QuestionControl /><AttendanceControl /></>}
      {active === "Certificados" && <CertificateManager />}
      {active === "Patrocinadores" && <SponsorManager />}

      {active === "Red profesional" && <div className="admin-content">
        <div className="stat-grid"><article><span>Quieren pertenecer</span><b>{dashboard.metrics.networkOptIns ?? 0}</b><small>Marcados en inscripción o cuenta</small></article><article><span>Comparten datos</span><b>{dashboard.metrics.sharedDirectory ?? 0}</b><small>Directorio profesional</small></article><article><span>Profesionales</span><b>{dashboard.metrics.professionals ?? 0}</b><small>Perfil profesional inscrito</small></article><article><span>Estudiantes</span><b>{dashboard.metrics.students ?? 0}</b><small>Perfil estudiante inscrito</small></article></div>
        <article className="panel network-panel"><div className="panel-title"><h3>Datos compartidos por participantes</h3><span>{dashboard.professionalNetwork.shared.length}</span></div>{dashboard.professionalNetwork.shared.length === 0 ? <div className="admin-empty"><b>Aún no hay datos compartidos.</b><p>Cuando un participante marque que desea compartir oficina y especialidad, aparecerá aquí.</p></div> : <div className="network-directory">{dashboard.professionalNetwork.shared.map(item => <article key={item.user_id}><div><b>{item.name}</b><small>{item.profession || "Profesión no indicada"} · {item.specialty || "Especialidad no indicada"}</small></div><p>{item.address || "Sin dirección compartida"}</p><div className="network-links">{item.email && <a href={`mailto:${item.email}`}>{item.email}</a>}{item.whatsapp && <a href={`https://wa.me/${item.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a>}{item.website && <a href={item.website.startsWith("http") ? item.website : `https://${item.website}`} target="_blank" rel="noreferrer">Web</a>}{item.instagram && <span>{item.instagram}</span>}</div></article>)}</div>}</article>
        <article className="panel network-panel"><div className="panel-title"><h3>Interesados en la red</h3><span>{dashboard.professionalNetwork.optIns.length}</span></div>{dashboard.professionalNetwork.optIns.length === 0 ? <div className="admin-empty"><b>Nadie ha marcado la red profesional aún.</b><p>El listado se llenará con participantes que marquen esa opción.</p></div> : dashboard.professionalNetwork.optIns.map(item => <div className="activity" key={item.id}><span>♢</span><p>{item.name}<small>{item.modality === "presencial" ? "Presencial" : "Virtual"} · {item.status === "waitlist" ? "Lista de espera" : "Confirmada"} · {new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</small></p></div>)}</article>
      </div>}

      {active === "Problemas" && <div className="admin-content"><article className="panel support-panel"><div className="panel-title"><h3>Problemas de acceso</h3><span className={dashboard.problems.open > 0 ? "problem-count has-problems" : "problem-count"}>{dashboard.problems.open} abiertos</span></div>{dashboard.problems.recent.length === 0 ? <div className="admin-empty"><b>No hay problemas reportados.</b><p>Cuando un participante indique que no puede iniciar sesión, aparecerá aquí.</p></div> : dashboard.problems.recent.map(problem => <div className={`support-issue ${problem.status === "open" ? "open" : ""}`} key={problem.id}><div><b>{problem.phone}</b><small>{new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(problem.created_at))}</small></div><p>{problem.problem}</p><span>{problem.status === "open" ? "Pendiente" : "Resuelto"}</span></div>)}</article></div>}

      {active === "Transmisión" && <div className="admin-content"><div className="panel transmission-editor"><p className="admin-kicker">CONTROL DE ACCESO</p><h2>Transmisión en vivo</h2><p>Pega un enlace de YouTube. Al activarla, solo participantes con cuenta podrán verla dentro de esta plataforma.</p><div className="speaker-form-grid"><label className="wide">Nombre de la transmisión<input value={content.liveTitle} placeholder="Ej. Jornada Clínica en vivo" onChange={event => setContent({ ...content, liveTitle: event.target.value })} /></label><label className="wide">Enlace de YouTube<input type="url" value={content.liveUrl} placeholder="https://www.youtube.com/watch?v=..." onChange={event => setContent({ ...content, liveUrl: event.target.value })} /><small>Admite enlaces youtube.com, youtu.be o youtube.com/live.</small></label></div><label className="live-toggle large"><div><b>Mostrar transmisión</b><small>{content.live ? "Visible para participantes registrados" : "Aún no disponible"}</small></div><input type="checkbox" checked={content.live} onChange={event => setContent({ ...content, live: event.target.checked })} /><i /></label></div></div>}
      {active === "Biblioteca" && <div className="admin-content">
        <div className="stat-grid community-admin-metrics"><article><span>Pendientes de revisión</span><b>{community.metrics.pending}</b><small>Requieren una decisión</small></article><article><span>Publicados</span><b>{community.metrics.approved}</b><small>Visibles para participantes</small></article><article><span>No aprobados</span><b>{community.metrics.rejected}</b><small>Conservados para seguimiento</small></article><article><span>Total gestionado</span><b>{community.resources.length}</b><small>Sin contar retirados</small></article></div>
        <article className="panel"><div className="panel-title"><h3>Recursos aportados por la comunidad</h3><span>{community.resources.length}</span></div>{community.resources.length === 0 ? <div className="community-admin-empty"><b>Aún no hay recursos enviados.</b><p>Los aportes de participantes aparecerán aquí para revisión.</p></div> : <div className="community-admin-list">{community.resources.map(resource => <article className="community-admin-item" key={resource.id}><div><header><b>{resource.title}</b><span className={`community-status ${resource.status}`}>{resource.status === "pending" ? "Pendiente" : resource.status === "approved" ? "Publicado" : "No aprobado"}</span></header><p>{resource.description || "Sin descripción."}</p><small>{resource.category_name} · aportado por {resource.contributor_name} · {resource.original_filename} · {Math.max(1, Math.round(resource.size_bytes / 1024))} KB</small>{resource.source_author && <small>Autor o fuente: {resource.source_author}</small>}<small>Declaración de responsabilidad aceptada por el participante.</small>{resource.moderation_reason && <small>Nota: {resource.moderation_reason}</small>}</div><div className="community-admin-actions"><a href={`/api/community-resources/${resource.id}/download`} target="_blank" rel="noreferrer">Revisar archivo</a>{resource.status !== "approved" && <button className="approve" type="button" disabled={saving} onClick={() => moderateCommunityResource(resource.id, "approved")}>Aprobar</button>}{resource.status !== "rejected" && <button className="reject" type="button" disabled={saving} onClick={() => moderateCommunityResource(resource.id, "rejected")}>No aprobar</button>}<button className="remove" type="button" disabled={saving} onClick={() => removeCommunityResource(resource.id)}>Retirar</button></div></article>)}</div>}</article>
      </div>}
    </section>
  </main>;
}
