"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { prepareImageForUpload } from "../../lib/image-upload";

/**
 * Galería del encuentro: se suben varias fotografías de una vez y cada una se
 * ajusta sola antes de enviarse, así se puede cargar la foto tal como salió del
 * teléfono sin retocarla en otro programa.
 */

type Photo = { id: number; image_url: string; caption: string | null; display_order: number; is_published: boolean };
type Progress = { done: number; total: number } | null;

function isError(message: string) {
  return /no se pudo|no se pudieron|demasiado|error|no autorizado/i.test(message);
}

export default function GalleryManager() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [captions, setCaptions] = useState<Record<number, string>>({});

  async function load() {
    const response = await fetch("/api/admin/gallery", { cache: "no-store" });
    if (!response.ok) return;
    const { photos: rows } = await response.json() as { photos: Photo[] };
    setPhotos(rows);
    setCaptions(Object.fromEntries(rows.map(photo => [photo.id, photo.caption ?? ""])));
  }

  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(kickoff);
  }, []);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    setMessage("");
    setProgress({ done: 0, total: files.length });

    const uploaded: Array<{ image_url: string; display_order: number }> = [];
    const failed: string[] = [];
    for (const [index, file] of files.entries()) {
      try {
        const prepared = await prepareImageForUpload(file);
        const form = new FormData();
        form.append("file", prepared.file);
        form.append("purpose", "gallery");
        const response = await fetch("/api/admin/media", { method: "POST", body: form });
        const data = await response.json() as { url?: string; error?: string };
        if (!response.ok || !data.url) { failed.push(file.name); }
        else uploaded.push({ image_url: data.url, display_order: photos.length + uploaded.length + 1 });
      } catch {
        failed.push(file.name);
      }
      setProgress({ done: index + 1, total: files.length });
    }

    if (uploaded.length) {
      const response = await fetch("/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: uploaded }),
      });
      if (!response.ok) failed.push("al guardar en la galería");
      else await load();
    }

    setProgress(null);
    setBusy(false);
    setMessage(failed.length
      ? `${uploaded.length} de ${files.length} fotografías se agregaron. No se pudo con: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}.`
      : `${uploaded.length} fotografía${uploaded.length === 1 ? "" : "s"} agregada${uploaded.length === 1 ? "" : "s"}.`);
  }

  async function update(id: number, changes: Record<string, unknown>) {
    setBusy(true);
    const response = await fetch("/api/admin/gallery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...changes }),
    });
    setBusy(false);
    if (!response.ok) { setMessage("No se pudo actualizar la fotografía."); return; }
    await load();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const reordered = [...photos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setPhotos(reordered);
    setBusy(true);
    const response = await fetch("/api/admin/gallery", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map(photo => photo.id) }),
    });
    setBusy(false);
    if (!response.ok) setMessage("No se pudo guardar el orden.");
    await load();
  }

  async function remove(id: number) {
    if (!window.confirm("¿Quitar esta fotografía de la galería?")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/gallery?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) { setMessage("No se pudo eliminar la fotografía."); return; }
    setMessage("Fotografía eliminada.");
    await load();
  }

  const visible = photos.filter(photo => photo.is_published).length;

  return <div className="admin-content gallery-manager">
    <div className="panel">
      <p className="admin-kicker">GALERÍA DEL ENCUENTRO</p>
      <h2>Las fotografías de la jornada.</h2>
      <p>Se muestran en el carrusel de la página principal, en el orden que definas aquí. Puedes subir varias a la vez y tal como salieron del teléfono: cada una se endereza, se reduce y se comprime sola antes de guardarse.</p>

      <label className="gallery-upload">
        <input type="file" accept="image/*" multiple disabled={busy} onChange={upload} />
        <strong>{progress ? `Subiendo ${progress.done} de ${progress.total}…` : "Agregar fotografías"}</strong>
        <small>Puedes seleccionar varias de una vez · JPG, PNG, WebP o HEIC</small>
      </label>

      {progress && <div className="gallery-progress"><b style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} /></div>}
      {message && <p className={isError(message) ? "community-error" : "community-success"} role="status">{message}</p>}
    </div>

    <section className="panel">
      <div className="panel-title"><h3>Fotografías</h3><span>{photos.length ? `${visible} visible${visible === 1 ? "" : "s"} de ${photos.length}` : "Ninguna todavía"}</span></div>
      {photos.length === 0
        ? <div className="admin-empty"><b>Aún no hay fotografías.</b><p>Sube las primeras y aparecerán de inmediato en la página principal.</p></div>
        : <div className="gallery-grid">
          {photos.map((photo, index) => <figure key={photo.id} className={photo.is_published ? "" : "hidden-photo"}>
            <img src={photo.image_url} alt={photo.caption ?? `Fotografía ${index + 1} del encuentro`} />
            <figcaption>
              <label>Pie de foto
                <input
                  value={captions[photo.id] ?? ""}
                  maxLength={220}
                  placeholder="Opcional"
                  onChange={event => setCaptions({ ...captions, [photo.id]: event.target.value })}
                  onBlur={() => { if ((captions[photo.id] ?? "") !== (photo.caption ?? "")) void update(photo.id, { caption: captions[photo.id] ?? "" }); }}
                />
              </label>
              <div className="gallery-photo-actions">
                <button type="button" disabled={busy || index === 0} aria-label="Mover antes" onClick={() => void move(index, -1)}>↑</button>
                <button type="button" disabled={busy || index === photos.length - 1} aria-label="Mover después" onClick={() => void move(index, 1)}>↓</button>
                <button type="button" disabled={busy} onClick={() => void update(photo.id, { is_published: !photo.is_published })}>{photo.is_published ? "Ocultar" : "Mostrar"}</button>
                <button type="button" className="danger-link" disabled={busy} onClick={() => void remove(photo.id)}>Eliminar</button>
              </div>
            </figcaption>
          </figure>)}
        </div>}
    </section>
  </div>;
}
