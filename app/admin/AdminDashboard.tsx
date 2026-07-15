"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EventProgramItem, EventSpeaker } from "../../lib/event";
import { programTimeLabel } from "../../lib/event";

type DashboardData = {
  daysRemaining: number;
  metrics: { total: number; presencial: number; virtual: number; waitlist: number; available: number; capacity: number };
  recent: Array<{ id: number; name: string; modality: string; status: string; created_at: string }>;
  problems: { open: number; recent: Array<{ id: number; phone: string; problem: string; status: string; created_at: string }> };
};

type SiteContent = { title: string; date: string; place: string; description: string; live: boolean };
type Section = "Resumen" | "Contenido" | "Programa" | "Ponentes" | "Problemas" | "Transmisión";
type SpeakerDraft = Omit<EventSpeaker, "id">;
type ProgramDraft = Omit<EventProgramItem, "id">;

const emptyDashboard: DashboardData = { daysRemaining: 0, metrics: { total: 0, presencial: 0, virtual: 0, waitlist: 0, available: 250, capacity: 250 }, recent: [], problems: { open: 0, recent: [] } };
const emptySpeaker: SpeakerDraft = { name: "", professional_title: "", talk_title: "", talk_time: "", program_item_id: null, bio: "", photo_url: null, video_url: null, contact_email: "", contact_phone: "", contact_website: "", display_order: 0, is_published: false };
const emptyProgramItem: ProgramDraft = { start_time: "", end_time: "", type: "", title: "", description: "", details: "", display_order: 0, is_published: true };
const sections: Section[] = ["Resumen", "Contenido", "Programa", "Ponentes", "Problemas", "Transmisión"];
const navIcons = ["◇", "✎", "☷", "◉", "!", "▶"];

function displayProgramOption(item: EventProgramItem) {
  return `${programTimeLabel(item)} · ${item.type} · ${item.title}`;
}

export default function AdminDashboard({ userName }: { userName: string }) {
  const [active, setActive] = useState<Section>("Resumen");
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [speakers, setSpeakers] = useState<EventSpeaker[]>([]);
  const [program, setProgram] = useState<EventProgramItem[]>([]);
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<number | "new">("new");
  const [selectedProgramId, setSelectedProgramId] = useState<number | "new">("new");
  const [speakerDraft, setSpeakerDraft] = useState<SpeakerDraft>(emptySpeaker);
  const [programDraft, setProgramDraft] = useState<ProgramDraft>(emptyProgramItem);
  const [content, setContent] = useState<SiteContent>({ title: "Cuando el Duelo se Detiene", date: "15 de agosto de 2026", place: "Chimaltenango", description: "Jornada Clínica sobre Duelo Prolongado.", live: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"photo" | "video" | null>(null);
  const [message, setMessage] = useState("");

  const selectedProgramOptions = useMemo(() => program, [program]);

  async function loadAll() {
    setLoading(true);
    const [dashboardResponse, speakersResponse, contentResponse, programResponse] = await Promise.all([
      fetch("/api/admin/dashboard"),
      fetch("/api/admin/speakers"),
      fetch("/api/admin/content"),
      fetch("/api/admin/program"),
    ]);
    if (dashboardResponse.ok) setDashboard(await dashboardResponse.json());
    if (speakersResponse.ok) setSpeakers((await speakersResponse.json()).speakers);
    if (programResponse.ok) setProgram((await programResponse.json()).program);
    if (contentResponse.ok) {
      const saved = await contentResponse.json();
      setContent(current => ({ ...current, ...saved, live: Boolean(saved.live) }));
    }
    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([fetch("/api/admin/dashboard"), fetch("/api/admin/speakers"), fetch("/api/admin/content"), fetch("/api/admin/program")]).then(async ([dashboardResponse, speakersResponse, contentResponse, programResponse]) => {
      if (ignore) return;
      if (dashboardResponse.ok) setDashboard(await dashboardResponse.json());
      if (speakersResponse.ok) setSpeakers((await speakersResponse.json()).speakers);
      if (programResponse.ok) setProgram((await programResponse.json()).program);
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
    return saveContent();
  }

  return <main className="admin-shell">
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/"><span className="brand-mark">EC</span><b>Encuentro Clínico</b></Link>
      <nav>{sections.map((item, index) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{navIcons[index]}</span>{item}{item === "Programa" && program.length > 0 && <i>{program.length}</i>}{item === "Ponentes" && speakers.length > 0 && <i>{speakers.length}</i>}{item === "Problemas" && dashboard.problems.open > 0 && <i className="alert-dot">{dashboard.problems.open}</i>}</button>)}</nav>
      <div className="admin-user"><span>{userName.slice(0, 2).toUpperCase()}</span><div><b>{userName}</b><small>Administrador</small></div><form action="/api/auth/logout" method="post"><button aria-label="Cerrar sesión">→</button></form></div>
    </aside>
    <section className="admin-main">
      <header><div><p>Panel de administración</p><h1>{active}</h1></div><div className="admin-header-actions"><Link href="/" target="_blank">Ver sitio ↗</Link>{["Contenido", "Programa", "Ponentes", "Transmisión"].includes(active) && <button className="admin-save" disabled={saving} onClick={saveCurrentSection}>{saving ? "Guardando…" : "Guardar cambios"}</button>}</div></header>
      {message && <div className="admin-toast" role="status">{message}</div>}

      {active === "Resumen" && <div className="admin-content">
        <div className="welcome"><div><p>ESTADO DEL EVENTO</p><h2>Información real,<br />lista para trabajar.</h2><span>{loading ? "Actualizando información…" : dashboard.daysRemaining > 0 ? `Faltan ${dashboard.daysRemaining} días para el evento.` : "La fecha del evento ha llegado."}</span></div><div className="event-ring"><b>{loading ? "—" : dashboard.daysRemaining}</b><small>DÍAS</small></div></div>
        <div className="stat-grid"><article><span>Inscripciones confirmadas</span><b>{loading ? "—" : dashboard.metrics.total}</b><small>Total real en Supabase</small></article><article><span>Presenciales</span><b>{loading ? "—" : dashboard.metrics.presencial}</b><small>Confirmadas</small></article><article><span>Virtuales</span><b>{loading ? "—" : dashboard.metrics.virtual}</b><small>Confirmadas</small></article><article><span>Cupo disponible</span><b>{loading ? "—" : dashboard.metrics.available}</b><small>de {dashboard.metrics.capacity} presenciales · espera: {dashboard.metrics.waitlist}</small></article></div>
        <div className="admin-columns"><article className="panel"><div className="panel-title"><h3>Inscripciones recientes</h3></div>{dashboard.recent.length === 0 ? <div className="admin-empty"><b>Aún no hay inscripciones.</b><p>Las nuevas inscripciones aparecerán aquí automáticamente.</p></div> : dashboard.recent.map(item => <div className="activity" key={item.id}><span>+</span><p>{item.name}<small>{item.modality === "presencial" ? "Presencial" : "Virtual"} · {item.status === "waitlist" ? "Lista de espera" : "Confirmada"} · {new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</small></p></div>)}</article><article className="panel"><div className="panel-title"><h3>Estado del sitio</h3><span className="online">En línea</span></div><div className="checklist"><p><span>✓</span> Información general <b>Conectada</b></p><p><span>✓</span> Programa <b>{program.length ? `${program.length} bloques` : "Pendiente"}</b></p><p><span>{speakers.length ? "✓" : "·"}</span> Ponentes <b>{speakers.length ? `${speakers.filter(item => item.is_published).length} publicados` : "Sin agregar"}</b></p><p><span>{content.live ? "✓" : "·"}</span> Transmisión <b>{content.live ? "Activa" : "Desactivada"}</b></p></div></article></div>
      </div>}

      {active === "Contenido" && <div className="admin-content editor-page"><div className="panel"><p className="admin-kicker">PORTADA DEL SITIO</p><h2>Información principal</h2><label>Título del evento<input value={content.title} onChange={event => setContent({ ...content, title: event.target.value })} /></label><label>Fecha<input value={content.date} onChange={event => setContent({ ...content, date: event.target.value })} /></label><label>Lugar<input value={content.place} onChange={event => setContent({ ...content, place: event.target.value })} /></label><label>Descripción<textarea rows={5} value={content.description} onChange={event => setContent({ ...content, description: event.target.value })} /></label></div><div className="panel preview-card"><p>VISTA PREVIA</p><div><small>{content.date} · {content.place}</small><h3>{content.title}</h3><p>{content.description}</p></div></div></div>}

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

      {active === "Problemas" && <div className="admin-content"><article className="panel support-panel"><div className="panel-title"><h3>Problemas de acceso</h3><span className={dashboard.problems.open > 0 ? "problem-count has-problems" : "problem-count"}>{dashboard.problems.open} abiertos</span></div>{dashboard.problems.recent.length === 0 ? <div className="admin-empty"><b>No hay problemas reportados.</b><p>Cuando un participante indique que no puede iniciar sesión, aparecerá aquí.</p></div> : dashboard.problems.recent.map(problem => <div className={`support-issue ${problem.status === "open" ? "open" : ""}`} key={problem.id}><div><b>{problem.phone}</b><small>{new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(problem.created_at))}</small></div><p>{problem.problem}</p><span>{problem.status === "open" ? "Pendiente" : "Resuelto"}</span></div>)}</article></div>}

      {active === "Transmisión" && <div className="admin-content"><div className="panel transmission-editor"><p className="admin-kicker">CONTROL DE ACCESO</p><h2>Transmisión en vivo</h2><p>Actívala únicamente cuando la sala esté lista. El sitio público mostrará el acceso a los participantes.</p><label className="live-toggle large"><div><b>Mostrar transmisión</b><small>{content.live ? "Visible para participantes" : "Aún no disponible"}</small></div><input type="checkbox" checked={content.live} onChange={event => setContent({ ...content, live: event.target.checked })} /><i /></label></div></div>}
    </section>
  </main>;
}
