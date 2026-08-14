"use client";

import { FormEvent, useEffect, useState } from "react";

type Material = {
  id: number;
  title: string;
  description: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  programItemId: number;
  programTitle: string;
  ownerName: string;
  releaseAt: string | null;
  downloadUrl: string;
};
type ProgramSlot = { id: number; title: string; timeLabel: string; isPublished: boolean; speakerName: string | null; materialCount: number };
type Data = { materials: Material[]; program: ProgramSlot[] };

const FILE_TYPES = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png";

function size(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
function when(value: string) {
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function MaterialsManager() {
  const [data, setData] = useState<Data>({ materials: [], program: [] });
  const [programItemId, setProgramItemId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Material | null>(null);

  async function load() {
    const response = await fetch("/api/admin/event-materials", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }
  useEffect(() => { const kickoff = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(kickoff); }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("Selecciona el archivo que vas a subir."); return; }
    setBusy(true); setError(""); setMessage("");
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    form.append("description", description);
    form.append("programItemId", programItemId);
    const response = await fetch("/api/admin/event-materials", { method: "POST", body: form });
    const result = await response.json() as { error?: string; ownerName?: string };
    setBusy(false);
    if (!response.ok) { setError(result.error ?? "No se pudo subir el material."); return; }
    setTitle(""); setDescription(""); setFile(null); setProgramItemId("");
    (event.target as HTMLFormElement).reset();
    setMessage(`Material publicado a nombre de ${result.ownerName}. Los participantes lo verán como si lo hubiera subido esa persona.`);
    await load();
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true); setError("");
    const response = await fetch("/api/admin/event-materials", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, title: editing.title, description: editing.description ?? "" }) });
    setBusy(false);
    if (!response.ok) { const result = await response.json(); setError(result.error ?? "No se pudo guardar el material."); return; }
    setEditing(null); setMessage("Material actualizado.");
    await load();
  }

  async function remove(material: Material) {
    if (!window.confirm(`¿Eliminar "${material.title}"? El archivo se borra y dejará de estar disponible para los participantes.`)) return;
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/event-materials?id=${material.id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) { setError("No se pudo eliminar el material."); return; }
    setMessage("Material eliminado.");
    await load();
  }

  const slots = data.program.filter(item => item.speakerName);
  const withoutSpeaker = data.program.filter(item => !item.speakerName && item.materialCount === 0);
  const totalSize = data.materials.reduce((total, item) => total + item.sizeBytes, 0);

  return <div className="admin-content materials-admin">
    <div className="stat-grid">
      <article><span>Materiales cargados</span><b>{data.materials.length}</b><small>De todas las conferencias</small></article>
      <article><span>Conferencias con material</span><b>{new Set(data.materials.map(item => item.programItemId)).size}</b><small>de {slots.length} con ponente asignado</small></article>
      <article><span>Espacio ocupado</span><b>{size(totalSize || 1)}</b><small>Máximo 25 MB por archivo</small></article>
      <article><span>Sin material aún</span><b>{slots.filter(item => item.materialCount === 0).length}</b><small>Conferencias pendientes</small></article>
    </div>

    <section className="panel">
      <p className="admin-kicker">SUBIR EN NOMBRE DEL PONENTE</p>
      <h2>Cargar material por ellos</h2>
      <p className="admin-note">Elige la conferencia y el archivo quedará registrado a nombre de su ponente. Los participantes lo verán exactamente igual que si lo hubiera subido esa persona, y se libera con la misma regla de siempre: al terminar su conferencia y solo para quienes tengan la asistencia verificada.</p>
      <form className="materials-form" onSubmit={upload}>
        <label>Conferencia y ponente *
          <select required value={programItemId} onChange={event => setProgramItemId(event.target.value)}>
            <option value="">Selecciona una conferencia</option>
            {slots.map(item => <option key={item.id} value={item.id}>{item.timeLabel ? `${item.timeLabel} · ` : ""}{item.title} · {item.speakerName}</option>)}
          </select>
        </label>
        <label>Título del material *<input required minLength={3} maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ej. Presentación de la conferencia" /></label>
        <label className="wide">Descripción<textarea rows={3} maxLength={800} value={description} onChange={event => setDescription(event.target.value)} placeholder="Opcional. Una línea que explique qué contiene el archivo." /></label>
        <label className="wide">Archivo *<input required type="file" accept={FILE_TYPES} onChange={event => setFile(event.target.files?.[0] ?? null)} /><small>PDF, Word, PowerPoint, Excel, JPG o PNG · máximo 25 MB</small></label>
        {error && <p className="community-error" role="alert">{error}</p>}
        {message && <p className="community-success" role="status">{message}</p>}
        <button className="admin-save" disabled={busy}>{busy ? "Subiendo…" : "Subir material"}</button>
      </form>
      {withoutSpeaker.length > 0 && <p className="admin-note">Sin ponente asignado todavía: {withoutSpeaker.map(item => item.title).join(", ")}. Asigna a la persona en <b>Inscritos</b> para poder subir material a su nombre.</p>}
    </section>

    <section className="panel">
      <div className="panel-title"><h3>Materiales de las conferencias</h3><span>{data.materials.length}</span></div>
      {data.materials.length === 0 ? <div className="admin-empty"><b>Todavía no hay materiales.</b><p>Aparecerán aquí los que suban los ponentes desde su cuenta y los que subas tú por ellos.</p></div> : <div className="materials-list">
        {data.materials.map(material => <article key={material.id}>
          <div>
            <b>{material.title}</b>
            <small>{material.programTitle} · a nombre de {material.ownerName}</small>
            {material.description && <p>{material.description}</p>}
            <small>{material.originalFilename} · {size(material.sizeBytes)} · subido el {when(material.createdAt)}</small>
          </div>
          <div className="materials-actions">
            <a href={material.downloadUrl} target="_blank" rel="noreferrer">Descargar</a>
            <button type="button" onClick={() => setEditing(material)} disabled={busy}>Editar</button>
            <button type="button" className="danger-link" onClick={() => remove(material)} disabled={busy}>Eliminar</button>
          </div>
        </article>)}
      </div>}
    </section>

    {editing && <div className="community-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}>
      <section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="material-edit-title">
        <button className="community-modal-close" aria-label="Cerrar" onClick={() => setEditing(null)}>×</button>
        <p className="section-kicker">MATERIAL</p>
        <h2 id="material-edit-title">Editar material</h2>
        <form className="materials-form" onSubmit={saveEdit}>
          <label className="wide">Título<input required minLength={3} maxLength={160} value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} /></label>
          <label className="wide">Descripción<textarea rows={3} maxLength={800} value={editing.description ?? ""} onChange={event => setEditing({ ...editing, description: event.target.value })} /></label>
          <div className="community-modal-actions">
            <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
            <button className="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
          </div>
        </form>
      </section>
    </div>}
  </div>;
}
