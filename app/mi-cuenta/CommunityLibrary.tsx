"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: number; name: string; slug: string; is_default: boolean };
type Resource = { id: number; title: string; description: string | null; source_author: string | null; original_filename: string; mime_type: string; size_bytes: number; status: string; moderation_reason: string | null; created_at: string; contributor_name?: string; download_count?: number };
type Group = Category & { resources: Resource[] };
type LibraryData = { availableCategories: Category[]; groups: Group[]; myResources: Resource[]; rewards: { stars: number; contributions: number; usefulDownloads: number } };

const rightsOptions = [
  ["own_work", "Es un trabajo propio"],
  ["permission", "Tengo permiso para compartirlo"],
  ["public_domain", "Es de dominio público"],
  ["open_license", "Tiene una licencia abierta"],
  ["legal_source", "Proviene de una fuente legal que permite compartirlo"],
];

function StarIcon({ filled = false }: { filled?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="m12 2.8 2.8 5.68 6.27.91-4.54 4.43 1.07 6.25L12 17.12l-5.6 2.95 1.07-6.25-4.54-4.43 6.27-.91L12 2.8Z" /></svg>;
}

function FileIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h6.69L18 8.31v11.94H6.75V3.75Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.9v4.65h4.35M9 13h6M9 16h4" /></svg>;
}

export default function CommunityLibrary() {
  const router = useRouter();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"declaration" | "form" | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadLibrary = useCallback(async () => {
    const response = await fetch("/api/community-resources", { cache: "no-store" });
    if (response.ok) setData(await response.json());
    else setError("No se pudo cargar la biblioteca comunitaria.");
    setLoading(false);
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/community-resources", { cache: "no-store" }).then(async response => {
      if (ignore) return;
      if (response.ok) setData(await response.json());
      else setError("No se pudo cargar la biblioteca comunitaria.");
      setLoading(false);
    }).catch(() => {
      if (!ignore) { setError("No se pudo cargar la biblioteca comunitaria."); setLoading(false); }
    });
    return () => { ignore = true; };
  }, []);
  useEffect(() => {
    if (!modal) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setModal(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modal]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("responsibilityAccepted", "true");
    const response = await fetch("/api/community-resources", { method: "POST", body: form });
    const result = await response.json();
    setSubmitting(false);
    if (!response.ok) { setError(result.error ?? "No se pudo compartir el recurso."); return; }
    setModal(null); setCategoryId("");
    setMessage("Gracias por aportar. Tu recurso quedó en revisión y aparecerá al ser aprobado.");
    await loadLibrary();
    router.refresh();
  }

  return <section className="community-library" aria-labelledby="community-library-title">
    <div className="community-library-head">
      <div><span>BIBLIOTECA COLABORATIVA</span><h2 id="community-library-title">Recursos compartidos por la comunidad</h2><p>Materiales aportados por participantes para acompañar el trabajo clínico y comunitario con el duelo.</p></div>
      <button className="community-share-button" type="button" onClick={() => { setError(""); setModal("declaration"); }}><span>+</span> Compartir un recurso</button>
    </div>

    {data && <div className="community-reward-summary"><span className="reward-star"><StarIcon filled /></span><div><b>{data.rewards.stars} {data.rewards.stars === 1 ? "estrella" : "estrellas"}</b><small>{data.rewards.contributions} aportes aprobados · {data.rewards.usefulDownloads} descargas útiles de otros miembros</small></div></div>}
    {message && <p className="community-success" role="status">{message}</p>}
    {error && !modal && <p className="community-error" role="alert">{error}</p>}

    {loading ? <div className="community-loading" aria-live="polite">Preparando la biblioteca…</div> : data?.groups.length ? <div className="community-groups">{data.groups.map(group => <section className="community-category" key={group.id}><header><div><span>{String(group.resources.length).padStart(2, "0")}</span><h3>{group.name}</h3></div><p>{group.resources.length} {group.resources.length === 1 ? "recurso" : "recursos"}</p></header><div className="community-resource-grid">{group.resources.map(resource => <article key={resource.id}><div className="community-file-icon"><FileIcon /></div><span>{resource.original_filename.split(".").pop()?.toUpperCase()} · {Math.max(1, Math.round(resource.size_bytes / 1024))} KB</span><h4>{resource.title}</h4><p>{resource.description || "Recurso compartido para la comunidad profesional."}</p>{resource.source_author && <small>Autor o fuente: {resource.source_author}</small>}<footer><div><b>{resource.contributor_name}</b><small>{resource.download_count ?? 0} descargas</small></div><a href={`/api/community-resources/${resource.id}/download`} aria-label={`Descargar ${resource.title}`}>Descargar <span>↓</span></a></footer></article>)}</div></section>)}</div> : <div className="community-empty"><span><FileIcon /></span><h3>La biblioteca está lista para recibir el primer aporte.</h3><p>Comparte un material útil y ayúdanos a construir este espacio entre profesionales y estudiantes.</p><button type="button" className="secondary" onClick={() => setModal("declaration")}>Compartir el primer recurso</button></div>}

    {data && data.myResources.length > 0 && <section className="my-community-resources"><h3>Tus recursos enviados</h3>{data.myResources.map(resource => <article key={resource.id}><div><b>{resource.title}</b><small>{resource.status === "pending" ? "En revisión" : resource.status === "approved" ? "Publicado" : "No aprobado"}</small></div>{resource.moderation_reason && <p>{resource.moderation_reason}</p>}</article>)}</section>}

    {modal && <div className="community-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><div className="community-modal" role="dialog" aria-modal="true" aria-labelledby="community-modal-title"><button className="community-modal-close" type="button" aria-label="Cerrar" onClick={() => setModal(null)}>×</button>{modal === "declaration" ? <div className="community-declaration"><span className="reward-star"><StarIcon filled /></span><p className="section-kicker">ANTES DE COMPARTIR</p><h2 id="community-modal-title">Un aporte responsable fortalece a toda la comunidad.</h2><p>Soy consciente de que es mi responsabilidad lo que estoy por compartir y que lo hago como un aporte a quienes trabajan con el duelo.</p><p>Declaro que soy autor del material, tengo permiso para compartirlo, es de dominio público, tiene licencia abierta o proviene de una fuente legal que permite su distribución.</p><div className="community-modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>Cancelar</button><button type="button" className="primary" onClick={() => setModal("form")}>Acepto y quiero continuar →</button></div></div> : <form className="community-upload-form" onSubmit={submit}><p className="section-kicker">NUEVO APORTE</p><h2 id="community-modal-title">Compartir con la comunidad</h2><p>Tu recurso será revisado antes de aparecer en la biblioteca.</p><label>Título del recurso *<input name="title" required minLength={3} maxLength={160} /></label><label>Descripción breve<textarea name="description" rows={3} maxLength={800} /></label><label>Autor o fuente original<input name="sourceAuthor" maxLength={160} /></label><label>Categoría *<select name="categoryId" required={categoryId !== "other"} value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="">Selecciona una categoría</option>{data?.availableCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}<option value="other">Otra categoría</option></select></label>{categoryId === "other" && <label>Nueva categoría *<input name="customCategory" required minLength={2} maxLength={60} placeholder="Ej. Guía para familias" /></label>}<label>¿Por qué puedes compartirlo? *<select name="rightsBasis" required defaultValue=""><option value="" disabled>Selecciona una opción</option>{rightsOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="community-file-field">Archivo *<input name="file" type="file" required accept=".pdf,.docx,.pptx,.xlsx,.jpg,.jpeg,.png" /><small>PDF, Word, PowerPoint, Excel, JPG o PNG · máximo 25 MB</small></label>{error && <p className="community-error" role="alert">{error}</p>}<div className="community-modal-actions"><button type="button" className="secondary" onClick={() => setModal(null)}>Cancelar</button><button className="primary" type="submit" disabled={submitting}>{submitting ? "Cargando aporte…" : "Enviar para revisión →"}</button></div></form>}</div></div>}
  </section>;
}
