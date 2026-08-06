"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Material = {
  id: number;
  title: string;
  description: string | null;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
};
type Talk = {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  materialCount: number;
  available: boolean;
  releaseAt: string;
  materials: Material[];
};
type MaterialsData = {
  attendanceConfirmed: boolean;
  speaker: { programItemId: number; talkTitle: string; startTime: string; endTime: string } | null;
  myMaterials: Material[];
  talks: Talk[];
};

function FileIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h6.69L18 8.31v11.94H6.75V3.75Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.9v4.65h4.35M9 13h6M9 16h4" /></svg>;
}

function LockIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5.5" y="10" width="13" height="10" rx="1.5" /><path strokeLinecap="round" d="M8.5 10V7a3.5 3.5 0 0 1 7 0v3" /></svg>;
}

function fileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function availabilityLabel(talk: Talk, attendanceConfirmed: boolean) {
  if (!attendanceConfirmed) return "Confirma tu asistencia el día del evento para acceder";
  const date = new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(talk.releaseAt));
  return `Disponible después de la ponencia · ${date}`;
}

export default function EventMaterials() {
  const [data, setData] = useState<MaterialsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/account/event-materials", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar los materiales.");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los materiales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/account/event-materials", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (ignore) return;
      if (!response.ok) throw new Error(result.error ?? "No se pudieron cargar los materiales.");
      setData(result);
    }).catch(loadError => {
      if (!ignore) setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los materiales.");
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(""); setMessage("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/account/event-materials", { method: "POST", body: new FormData(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo subir el material.");
      form.reset();
      setMessage("Material cargado correctamente. Ya puedes editarlo, descargarlo o eliminarlo.");
      await load();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir el material.");
    } finally {
      setSubmitting(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    setSubmitting(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/account/event-materials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: form.get("title"), description: form.get("description") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo editar el material.");
      setEditingId(null);
      setMessage("Los datos del material fueron actualizados.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo editar el material.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(material: Material) {
    if (!window.confirm(`¿Deseas eliminar “${material.title}”? Esta acción también borrará el archivo.`)) return;
    setSubmitting(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/account/event-materials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: material.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo eliminar el material.");
      setMessage("El material fue eliminado.");
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el material.");
    } finally {
      setSubmitting(false);
    }
  }

  return <details className="account-resources event-materials" open>
    <summary><span>RECURSOS DEL ENCUENTRO</span><h2>Materiales de las ponencias <b aria-hidden="true">+</b></h2></summary>
    <div className="account-resources-body">
      {loading && <p className="event-materials-loading" aria-live="polite">Preparando los materiales…</p>}
      {error && <p className="community-error" role="alert">{error}</p>}
      {message && <p className="community-success" role="status">{message}</p>}

      {data?.speaker && <section className="speaker-material-manager" aria-labelledby="speaker-materials-title">
        <div className="speaker-material-intro">
          <span>PARA TU PONENCIA</span>
          <h3 id="speaker-materials-title">{data.speaker.talkTitle}</h3>
          <p>Aquí puedes subir los materiales para compartir. Solo se mostrarán a los participantes el día del evento, después de la hora a la que te corresponde la ponencia ({data.speaker.startTime}–{data.speaker.endTime}).</p>
        </div>
        <form className="speaker-material-upload" onSubmit={upload}>
          <label>Título del material *<input name="title" required minLength={3} maxLength={160} placeholder="Ej. Presentación y lecturas recomendadas" /></label>
          <label>Descripción breve<textarea name="description" rows={3} maxLength={800} placeholder="Explica qué contiene o cómo puede utilizarse." /></label>
          <label className="speaker-material-file">Archivo *<input name="file" type="file" required accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png" /><small>PDF, Word, PowerPoint, Excel, JPG o PNG · máximo 25 MB</small></label>
          <button className="primary" type="submit" disabled={submitting}>{submitting ? "Subiendo material…" : "Subir material →"}</button>
        </form>

        {data.myMaterials.length > 0 && <div className="speaker-owned-materials"><h4>Tus materiales cargados</h4>{data.myMaterials.map(material => editingId === material.id ? <form className="speaker-material-edit" key={material.id} onSubmit={event => save(event, material.id)}><label>Título<input name="title" required minLength={3} maxLength={160} defaultValue={material.title} /></label><label>Descripción<textarea name="description" rows={2} maxLength={800} defaultValue={material.description ?? ""} /></label><div><button className="secondary" type="button" onClick={() => setEditingId(null)}>Cancelar</button><button className="primary" disabled={submitting}>Guardar cambios</button></div></form> : <article key={material.id}><div className="event-material-file-icon"><FileIcon /></div><div><b>{material.title}</b><p>{material.description || material.originalFilename}</p><small>{material.originalFilename} · {fileSize(material.sizeBytes)}</small></div><div className="speaker-material-actions"><a href={material.downloadUrl}>Descargar</a><button type="button" onClick={() => setEditingId(material.id)}>Editar</button><button className="danger-link" type="button" disabled={submitting} onClick={() => remove(material)}>Eliminar</button></div></article>)}</div>}
      </section>}

      {data && <section className="participant-event-materials" aria-labelledby="participant-materials-title">
        <div className="event-materials-heading"><div><span>PARA PARTICIPANTES</span><h3 id="participant-materials-title">Materiales organizados por conferencia</h3></div>{data.attendanceConfirmed ? <small className="event-access-confirmed">Asistencia confirmada</small> : <small className="event-access-pending">Acceso sujeto a asistencia</small>}</div>
        {data.talks.length ? <div className="event-talk-list">{data.talks.map(talk => <article key={talk.id} className={talk.available ? "available" : "locked"}><div className="event-material-file-icon">{talk.available ? <FileIcon /> : <LockIcon />}</div><div><span>{talk.startTime}–{talk.endTime}</span><h4>{talk.title}</h4><p>{talk.available ? `${talk.materialCount} ${talk.materialCount === 1 ? "material disponible" : "materiales disponibles"}` : `${talk.materialCount} ${talk.materialCount === 1 ? "material preparado" : "materiales preparados"} · ${availabilityLabel(talk, data.attendanceConfirmed)}`}</p></div>{talk.available && <div className="event-talk-downloads">{talk.materials.map(material => <a key={material.id} href={material.downloadUrl}><span>{material.title}</span><small>{fileSize(material.sizeBytes)} ↓</small></a>)}</div>}</article>)}</div> : <div className="event-materials-empty"><FileIcon /><div><b>Aún no hay materiales cargados.</b><p>Cuando los ponentes preparen sus archivos, aquí verás la conferencia y la cantidad de recursos que estarán disponibles.</p></div></div>}
      </section>}
    </div>
  </details>;
}
