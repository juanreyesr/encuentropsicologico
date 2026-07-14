"use client";

import { ChangeEvent, useEffect, useState } from "react";
import type { EventSpeaker } from "../../lib/event";

type DashboardData = {
  daysRemaining: number;
  metrics: { total: number; presencial: number; virtual: number; waitlist: number; available: number; capacity: number };
  recent: Array<{ id: number; name: string; modality: string; status: string; created_at: string }>;
};

type SiteContent = { title: string; date: string; place: string; description: string; live: boolean };

const emptyDashboard: DashboardData = { daysRemaining: 0, metrics: { total: 0, presencial: 0, virtual: 0, waitlist: 0, available: 250, capacity: 250 }, recent: [] };
const emptySpeaker: Omit<EventSpeaker, "id"> = { name: "", professional_title: "", talk_title: "", talk_time: "", bio: "", photo_url: null, video_url: null, display_order: 0, is_published: false };
const sections = ["Resumen", "Contenido", "Ponentes", "Transmisión"];

export default function AdminDashboard({ userName }: { userName: string }) {
  const [active, setActive] = useState("Resumen");
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new">("new");
  const [speakerDraft, setSpeakerDraft] = useState<Omit<EventSpeaker, "id">>(emptySpeaker);
  const [content, setContent] = useState<SiteContent>({ title: "Cuando el Duelo se Detiene", date: "15 de agosto de 2026", place: "Chimaltenango", description: "Jornada Clínica sobre Duelo Prolongado.", live: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "video" | null>(null);
  const [message, setMessage] = useState("");

  async function loadAll() {
    setLoading(true);
    const [dashboardResponse, speakersResponse, contentResponse] = await Promise.all([fetch("/api/admin/dashboard"), fetch("/api/admin/speakers"), fetch("/api/admin/content")]);
    if (dashboardResponse.ok) setDashboard(await dashboardResponse.json());
    if (speakersResponse.ok) setSpeakers((await speakersResponse.json()).speakers);
    if (contentResponse.ok) {
      const saved = await contentResponse.json();
      setContent(current => ({ ...current, ...saved, live: Boolean(saved.live) }));
    }
    setLoading(false);
  }

  useEffect(() => { void loadAll(); }, []);

  function flash(text: string) { setMessage(text); window.setTimeout(() => setMessage(""), 3500); }

  async function saveContent() {
    setSaving(true);
    const response = await fetch("/api/admin/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) });
    setSaving(false);
    flash(response.ok ? "Cambios guardados y listos para publicar." : "No se pudieron guardar los cambios.");
  }

  function selectSpeaker(speaker?: EventSpeaker) {
    if (!speaker) { setSelectedId("new"); setSpeakerDraft(emptySpeaker); return; }
    const { id, ...draft } = speaker;
    setSelectedId(id); setSpeakerDraft(draft);
  }

  async function saveSpeaker() {
    if (!speakerDraft.name.trim()) { flash("Escribe el nombre del ponente."); return; }
    setSaving(true);
    const response = await fetch("/api/admin/speakers", { method: selectedId === "new" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(selectedId === "new" ? speakerDraft : { id: selectedId, ...speakerDraft }) });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) { flash(result.error ?? "No se pudo guardar el ponente."); return; }
    await loadAll(); selectSpeaker(result.speaker); flash("Ponente guardado correctamente.");
  }

  async function removeSpeaker() {
    if (selectedId === "new" || !window.confirm("¿Eliminar este ponente? Esta acción no se puede deshacer.")) return;
    const response = await fetch(`/api/admin/speakers?id=${selectedId}`, { method: "DELETE" });
    if (!response.ok) { flash("No se pudo eliminar el ponente."); return; }
    selectSpeaker(); await loadAll(); flash("Ponente eliminado.");
  }

  async function uploadMedia(event: ChangeEvent<HTMLInputElement>, kind: "photo" | "video") {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    const form = new FormData(); form.append("file", file);
    const response = await fetch("/api/admin/media", { method: "POST", body: form });
    const result = await response.json();
    setUploading(null);
    if (!response.ok) { flash(result.error ?? "No se pudo cargar el archivo."); return; }
    setSpeakerDraft(current => ({ ...current, [kind === "photo" ? "photo_url" : "video_url"]: result.url }));
    flash(kind === "photo" ? "Fotografía cargada. Guarda el ponente." : "Video cargado. Guarda el ponente.");
  }

  const navIcons = ["◇", "✎", "◉", "▶"];
  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/"><span className="brand-mark">EC</span><b>Encuentro Clínico</b></a>
      <nav>{sections.map((item, index) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{navIcons[index]}</span>{item}{item === "Ponentes" && speakers.length > 0 && <i>{speakers.length}</i>}</button>)}</nav>
      <div className="admin-user"><span>{userName.slice(0, 2).toUpperCase()}</span><div><b>{userName}</b><small>Administrador</small></div><form action="/api/auth/logout" method="post"><button aria-label="Cerrar sesión">→</button></form></div>
    </aside>
    <section className="admin-main">
      <header><div><p>Panel de administración</p><h1>{active}</h1></div><div className="admin-header-actions"><a href="/" target="_blank">Ver sitio ↗</a>{active !== "Resumen" && <button className="admin-save" disabled={saving} onClick={active === "Ponentes" ? saveSpeaker : saveContent}>{saving ? "Guardando…" : "Guardar cambios"}</button>}</div></header>
      {message && <div className="admin-toast" role="status">{message}</div>}
      {active === "Resumen" && <div className="admin-content">
        <div className="welcome"><div><p>ESTADO DEL EVENTO</p><h2>Información real,<br />lista para trabajar.</h2><span>{loading ? "Actualizando información…" : dashboard.daysRemaining > 0 ? `Faltan ${dashboard.daysRemaining} días para el evento.` : "La fecha del evento ha llegado."}</span></div><div className="event-ring"><b>{loading ? "—" : dashboard.daysRemaining}</b><small>DÍAS</small></div></div>
        <div className="stat-grid"><article><span>Inscripciones confirmadas</span><b>{loading ? "—" : dashboard.metrics.total}</b><small>Total real en Supabase</small></article><article><span>Presenciales</span><b>{loading ? "—" : dashboard.metrics.presencial}</b><small>Confirmadas</small></article><article><span>Virtuales</span><b>{loading ? "—" : dashboard.metrics.virtual}</b><small>Confirmadas</small></article><article><span>Cupo disponible</span><b>{loading ? "—" : dashboard.metrics.available}</b><small>de {dashboard.metrics.capacity} presenciales · espera: {dashboard.metrics.waitlist}</small></article></div>
        <div className="admin-columns"><article className="panel"><div className="panel-title"><h3>Inscripciones recientes</h3></div>{dashboard.recent.length === 0 ? <div className="admin-empty"><b>Aún no hay inscripciones.</b><p>Las nuevas inscripciones aparecerán aquí automáticamente.</p></div> : dashboard.recent.map(item => <div className="activity" key={item.id}><span>+</span><p>{item.name}<small>{item.modality === "presencial" ? "Presencial" : "Virtual"} · {item.status === "waitlist" ? "Lista de espera" : "Confirmada"} · {new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</small></p></div>)}</article><article className="panel"><div className="panel-title"><h3>Estado del sitio</h3><span className="online">En línea</span></div><div className="checklist"><p><span>✓</span> Información general <b>Conectada</b></p><p><span>✓</span> Inscripciones <b>Supabase</b></p><p><span>{speakers.length ? "✓" : "·"}</span> Ponentes <b>{speakers.length ? `${speakers.filter(item => item.is_published).length} publicados` : "Sin agregar"}</b></p><p><span>{content.live ? "✓" : "·"}</span> Transmisión <b>{content.live ? "Activa" : "Desactivada"}</b></p></div></article></div>
      </div>}
      {active === "Contenido" && <div className="admin-content editor-page"><div className="panel"><p className="admin-kicker">PORTADA DEL SITIO</p><h2>Información principal</h2><label>Título del evento<input value={content.title} onChange={event => setContent({ ...content, title: event.target.value })} /></label><label>Fecha<input value={content.date} onChange={event => setContent({ ...content, date: event.target.value })} /></label><label>Lugar<input value={content.place} onChange={event => setContent({ ...content, place: event.target.value })} /></label><label>Descripción<textarea rows={5} value={content.description} onChange={event => setContent({ ...content, description: event.target.value })} /></label></div><div className="panel preview-card"><p>VISTA PREVIA</p><div><small>{content.date} · {content.place}</small><h3>{content.title}</h3><p>{content.description}</p></div></div></div>}
      {active === "Ponentes" && <div className="admin-content speaker-admin">
        <aside className="panel speaker-list"><div className="panel-title"><h3>Ponentes</h3><button onClick={() => selectSpeaker()}>+ Nuevo</button></div>{speakers.length === 0 ? <div className="admin-empty"><b>No hay ponentes agregados.</b><p>Crea el primero y publícalo cuando su ficha esté completa.</p></div> : speakers.map(speaker => <button key={speaker.id} className={selectedId === speaker.id ? "selected" : ""} onClick={() => selectSpeaker(speaker)}>{speaker.photo_url ? <img src={speaker.photo_url} alt="" /> : <span>{speaker.name.slice(0, 1)}</span>}<div><b>{speaker.name}</b><small>{speaker.talk_time || "Horario pendiente"} · {speaker.is_published ? "Publicado" : "Borrador"}</small></div></button>)}</aside>
        <section className="panel speaker-editor"><div className="panel-title"><h3>{selectedId === "new" ? "Nuevo ponente" : "Editar ponente"}</h3>{selectedId !== "new" && <button className="danger-link" onClick={removeSpeaker}>Eliminar</button>}</div><div className="speaker-form-grid"><label>Nombre completo *<input value={speakerDraft.name} onChange={event => setSpeakerDraft({ ...speakerDraft, name: event.target.value })} /></label><label>Título profesional<input value={speakerDraft.professional_title} onChange={event => setSpeakerDraft({ ...speakerDraft, professional_title: event.target.value })} placeholder="Ej. Psicóloga clínica, MSc." /></label><label>Momento / horario de ponencia<input value={speakerDraft.talk_time} onChange={event => setSpeakerDraft({ ...speakerDraft, talk_time: event.target.value })} placeholder="Ej. 9:10–9:30" /></label><label>Orden de aparición<input type="number" min="0" value={speakerDraft.display_order} onChange={event => setSpeakerDraft({ ...speakerDraft, display_order: Number(event.target.value) })} /></label><label className="wide">Título de la ponencia<input value={speakerDraft.talk_title} onChange={event => setSpeakerDraft({ ...speakerDraft, talk_title: event.target.value })} /></label><label className="wide">Resumen de experiencia<textarea rows={7} value={speakerDraft.bio} onChange={event => setSpeakerDraft({ ...speakerDraft, bio: event.target.value })} placeholder="Trayectoria, especialidades, experiencia y enfoque profesional." /></label></div><div className="media-fields"><label className="media-upload"><b>Fotografía</b><small>JPG, PNG o WebP · recomendado vertical</small>{speakerDraft.photo_url && <img src={speakerDraft.photo_url} alt="Vista previa del ponente" />}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => uploadMedia(event, "photo")} /><span>{uploading === "photo" ? "Cargando…" : speakerDraft.photo_url ? "Cambiar fotografía" : "Cargar fotografía"}</span></label><label className="media-upload"><b>Video del ponente</b><small>MP4 o WebM · máximo 50 MB</small>{speakerDraft.video_url && <video src={speakerDraft.video_url} controls preload="metadata" />}<input type="file" accept="video/mp4,video/webm" onChange={event => uploadMedia(event, "video")} /><span>{uploading === "video" ? "Cargando…" : speakerDraft.video_url ? "Cambiar video" : "Cargar video"}</span></label></div><label className="publish-check"><input type="checkbox" checked={speakerDraft.is_published} onChange={event => setSpeakerDraft({ ...speakerDraft, is_published: event.target.checked })} /><span><b>Publicar en el sitio</b><small>La ficha será visible para todos los visitantes.</small></span></label></section>
      </div>}
      {active === "Transmisión" && <div className="admin-content"><div className="panel transmission-editor"><p className="admin-kicker">CONTROL DE ACCESO</p><h2>Transmisión en vivo</h2><p>Actívala únicamente cuando la sala esté lista. El sitio público mostrará el acceso a los participantes.</p><label className="live-toggle large"><div><b>Mostrar transmisión</b><small>{content.live ? "Visible para participantes" : "Aún no disponible"}</small></div><input type="checkbox" checked={content.live} onChange={event => setContent({ ...content, live: event.target.checked })} /><i /></label></div></div>}
    </section>
  </main>;
}
