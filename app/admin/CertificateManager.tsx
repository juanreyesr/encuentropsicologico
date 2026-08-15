"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { CERTIFICATE_TYPES, CERTIFICATE_TYPE_LABELS, DEFAULT_CERTIFICATE_SETTINGS, SIGNATURE_SLOTS, type CertificateSettings, type CertificateType } from "../../lib/certificate-template";

type Settings = Required<CertificateSettings>;
type BusyAction = "upload" | "save" | "generate" | null;
type Counts = Record<CertificateType, number>;
type Progress = { processed: number; total: number; byType: Counts } | null;
const emptyCounts = (): Counts => ({ professional: 0, general: 0, speaker: 0, organizer: 0 });
const DIRECT_UPLOAD_LIMIT = 3.5 * 1024 * 1024;
const MAX_SPONSOR_LOGOS = 4;

function freshSettings(): Settings {
  return {
    ...DEFAULT_CERTIFICATE_SETTINGS,
    signatures: DEFAULT_CERTIFICATE_SETTINGS.signatures.map(signature => ({ ...signature })),
    sponsor_logos: [],
  };
}

function mergeSettings(saved: Partial<Settings>): Settings {
  const fallback = freshSettings();
  return {
    ...fallback,
    ...saved,
    signatures: Array.isArray(saved.signatures)
      ? fallback.signatures.map((item, index) => saved.signatures?.[index] ?? item)
      : fallback.signatures,
    sponsor_logos: Array.isArray(saved.sponsor_logos) ? saved.sponsor_logos.slice(0, MAX_SPONSOR_LOGOS) : [],
  };
}

async function requestJson(url: string, init: RequestInit, timeout = 30_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const raw = await response.text();
    let data: Record<string, unknown> = {};
    try { data = raw ? JSON.parse(raw) as Record<string, unknown> : {}; } catch { data = { error: raw }; }
    return { response, data };
  } finally {
    window.clearTimeout(timer);
  }
}

function requestError(error: unknown, fallback: string) {
  return error instanceof DOMException && error.name === "AbortError"
    ? "La operación tardó demasiado. Intenta otra vez o usa una imagen más liviana."
    : fallback;
}

async function optimizeImageForUpload(file: File) {
  if (file.size <= DIRECT_UPLOAD_LIMIT) return file;
  if (!(file.type === "image/jpeg" || file.type === "image/png")) {
    throw new Error("El archivo debe ser una imagen PNG o JPG.");
  }

  const source = await createImageBitmap(file);
  // Se reduce en PNG para no perder el fondo transparente de firmas y sellos,
  // que es lo que permite estamparlas sobre el diploma.
  const makeFile = async (largestSide: number) => {
    const scale = Math.min(1, largestSide / Math.max(source.width, source.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen para la carga.");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return new Promise<File | null>(resolve => {
      canvas.toBlob(blob => {
        resolve(blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.png`, { type: "image/png" }) : null);
      }, "image/png");
    });
  };

  // Más que suficiente para un logo o una firma de diploma, sin cargar píxeles
  // que nunca se imprimirán.
  let optimized: File | null = null;
  try {
    optimized = await makeFile(960);
    if (!optimized || optimized.size > DIRECT_UPLOAD_LIMIT) optimized = await makeFile(720);
    if (!optimized || optimized.size > DIRECT_UPLOAD_LIMIT) optimized = await makeFile(540);
  } finally {
    source.close();
  }
  if (!optimized || optimized.size > DIRECT_UPLOAD_LIMIT) {
    throw new Error("No se pudo reducir la imagen lo suficiente. Usa una versión de menos de 3 MB.");
  }
  return optimized;
}

function isErrorMessage(message: string) {
  return /no se pudo|tardó|supera|demasiado|error|large|no autorizado/i.test(message);
}

export default function CertificateManager() {
  const [settings, setSettings] = useState<Settings>(freshSettings);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<CertificateType>("professional");
  const [sampleName, setSampleName] = useState("María Fernanda López");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState<Progress>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/certificates", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok || !active) return;
        const { settings: saved } = await response.json();
        if (saved && active) setSettings(mergeSettings(saved));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!editorOpen && !previewOpen) return;
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (previewOpen) setPreviewOpen(false);
      else setEditorOpen(false);
    }
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [editorOpen, previewOpen]);

  // El PDF de la vista previa vive en memoria del navegador; se libera al
  // cambiar de versión o al cerrar el panel.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function upload(event: ChangeEvent<HTMLInputElement>, type: "signature" | "logo" | "seal" | "sealLeft", index = 0) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (type === "logo" && settings.sponsor_logos.length >= MAX_SPONSOR_LOGOS) {
      setMessage("El diploma admite hasta 4 logos de patrocinadores.");
      event.target.value = "";
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage("La imagen supera 10 MB. Elige una versión más liviana para que cargue correctamente.");
      event.target.value = "";
      return;
    }
    setBusyAction("upload");
    setMessage("");
    try {
      const fileToUpload = await optimizeImageForUpload(file);
      const form = new FormData();
      form.append("file", fileToUpload);
      form.append("purpose", "certificate");
      const { response, data } = await requestJson("/api/admin/media", { method: "POST", body: form }, 35_000);
      if (!response.ok || typeof data.url !== "string") {
        setMessage(response.status === 413
          ? "La imagen sigue siendo demasiado grande para cargarla. Usa una versión de menos de 3 MB."
          : String(data.error ?? "No se pudo cargar la imagen."));
        return;
      }
      if (type === "seal") {
        setSettings(current => ({ ...current, seal_url: data.url as string, seal_enabled: true }));
      } else if (type === "sealLeft") {
        setSettings(current => ({ ...current, seal_left_url: data.url as string, seal_left_enabled: true }));
      } else if (type === "signature") {
        setSettings(current => ({
          ...current,
          signatures: current.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, image_url: data.url as string } : item),
        }));
      } else {
        setSettings(current => ({ ...current, sponsor_logos: [...current.sponsor_logos, data.url as string].slice(0, MAX_SPONSOR_LOGOS) }));
      }
      setMessage(type === "signature" ? "Firma cargada. Guarda el modelo para conservarla." : type === "seal" || type === "sealLeft" ? "Sello cargado y activado. Guarda el modelo para conservarlo." : "Logo cargado. Guarda el modelo para conservarlo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : requestError(error, "No se pudo cargar la imagen. Comprueba tu conexión e inténtalo de nuevo."));
    } finally {
      setBusyAction(null);
      event.target.value = "";
    }
  }

  async function save() {
    setBusyAction("save");
    setMessage("");
    try {
      const { response, data } = await requestJson("/api/admin/certificates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (response.ok) {
        if (data.settings && typeof data.settings === "object") setSettings(mergeSettings(data.settings as Partial<Settings>));
        setMessage("Modelo de diploma guardado.");
      } else {
        setMessage(String(data.error ?? "No se pudo guardar el diploma."));
      }
    } catch (error) {
      setMessage(requestError(error, "No se pudo guardar el diploma. Comprueba tu conexión e inténtalo de nuevo."));
    } finally {
      setBusyAction(null);
    }
  }

  // La emisión avanza por lotes para poder mostrar el porcentaje real mientras
  // ocurre, en vez de una espera sin señales.
  async function generate() {
    const planResponse = await fetch("/api/admin/certificates/generate", { cache: "no-store" });
    const plan = planResponse.ok ? await planResponse.json() as { eligible: number; batchSize: number } : { eligible: 0, batchSize: 40 };
    if (!plan.eligible) { setMessage("Aún no hay asistencias verificadas. Activa y completa el control de asistencia antes de emitir diplomas."); return; }
    if (!window.confirm(`Se emitirán diplomas para ${plan.eligible} persona${plan.eligible === 1 ? "" : "s"} con asistencia verificada, cada una con el modelo que corresponde a su función. ¿Continuar?`)) return;

    setBusyAction("generate");
    setMessage("");
    const totals = emptyCounts();
    setProgress({ processed: 0, total: plan.eligible, byType: { ...totals } });
    try {
      let offset = 0;
      for (;;) {
        const { response, data } = await requestJson("/api/admin/certificates/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ offset, limit: plan.batchSize }),
        }, 45_000);
        if (!response.ok) { setProgress(null); setMessage(String(data.error ?? "No se pudieron emitir los diplomas.")); return; }
        const batch = data as { processed: number; total: number; done: boolean; byType: Counts };
        CERTIFICATE_TYPES.forEach(type => { totals[type] += batch.byType?.[type] ?? 0; });
        setProgress({ processed: batch.processed, total: batch.total || plan.eligible, byType: { ...totals } });
        offset = batch.processed;
        if (batch.done) break;
      }
      const generated = CERTIFICATE_TYPES.reduce((sum, type) => sum + totals[type], 0);
      const detail = CERTIFICATE_TYPES.filter(type => totals[type]).map(type => `${totals[type]} ${CERTIFICATE_TYPE_LABELS[type].toLowerCase()}`).join(" · ");
      setMessage(`${generated} diploma${generated === 1 ? "" : "s"} emitido${generated === 1 ? "" : "s"}.${detail ? ` ${detail}.` : ""} Ya están disponibles en la cuenta de cada participante.`);
    } catch (error) {
      setProgress(null);
      setMessage(requestError(error, "No se pudieron emitir los diplomas. Inténtalo de nuevo."));
    } finally {
      setBusyAction(null);
    }
  }

  async function renderPreview(type: CertificateType = previewType) {
    setPreviewType(type);
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const response = await fetch("/api/admin/certificates/preview", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, type, fullName: sampleName }),
      });
      if (!response.ok) {
        setPreviewUrl("");
        setPreviewError(await response.text() || "No se pudo generar la vista previa.");
        return;
      }
      setPreviewUrl(URL.createObjectURL(await response.blob()));
    } catch (error) {
      setPreviewUrl("");
      setPreviewError(requestError(error, "No se pudo generar la vista previa. Comprueba tu conexión e inténtalo de nuevo."));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function showPreview(type: CertificateType = previewType) {
    setPreviewOpen(true);
    await renderPreview(type);
  }

  function openPrintablePreview() {
    if (!previewUrl) return;
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="admin-content certificate-manager">
      <div className="panel">
        <p className="admin-kicker">DIPLOMAS DE PARTICIPACIÓN</p>
        <h2>Un modelo elegante, cuatro tipos de diploma.</h2>
        <p>Cada persona recibe el diploma que corresponde a su función: ponentes y equipo organizador reciben su reconocimiento, los participantes profesionales el título profesional y el resto el diploma general. Al emitir se asignan todos de una sola vez según el rol registrado en cada inscripción.</p>
        <div className="certificate-manager-actions">
          <button className="secondary" onClick={() => setEditorOpen(true)}>Editar modelo y firmas</button>
          <button className="secondary certificate-preview-trigger" onClick={() => void showPreview()}>Previsualizar certificados</button>
          <button className="admin-save" disabled={busyAction !== null} onClick={generate}>{busyAction === "generate" ? `Emitiendo… ${progress && progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%` : "Emitir diplomas"}</button>
        </div>
        {progress && <div className="certificate-progress" role="status" aria-live="polite">
          <div className="certificate-progress-bar"><b style={{ width: `${progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%` }} /></div>
          <p><b>{progress.total ? Math.round((progress.processed / progress.total) * 100) : 0}%</b><span>{progress.processed} de {progress.total} diplomas emitidos</span>{busyAction === "generate" ? <small>Emitiendo…</small> : <small>Emisión completada</small>}</p>
          <div className="certificate-progress-types">{CERTIFICATE_TYPES.map(type => <span key={type}>{CERTIFICATE_TYPE_LABELS[type]}<b>{progress.byType[type]}</b></span>)}</div>
        </div>}
        {message && <p className={isErrorMessage(message) ? "community-error" : "community-success"} role="status">{message}</p>}
      </div>

      {editorOpen && (
        <div className="community-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
          <section className="community-modal certificate-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-title">
            <button className="community-modal-close" aria-label="Cerrar editor" onClick={() => setEditorOpen(false)}>×</button>
            <p className="section-kicker">MODELO GENERAL</p>
            <h2 id="certificate-title">Editar diploma</h2>
            <p className="certificate-editor-help">Los cambios se pueden previsualizar antes de guardarlos. La vista de prueba no emite ningún certificado.</p>
            <div className="certificate-details-grid">
              <label className="wide">Nombre del evento<input value={settings.event_name} onChange={event => setSettings({ ...settings, event_name: event.target.value })} /></label>
              <label>Fecha<input value={settings.event_date} onChange={event => setSettings({ ...settings, event_date: event.target.value })} /></label>
              <label>Lugar<input value={settings.event_place} onChange={event => setSettings({ ...settings, event_place: event.target.value })} /></label>
              <label>Título para profesionales<input value={settings.professional_title} onChange={event => setSettings({ ...settings, professional_title: event.target.value })} /></label>
              <label>Título para participantes generales<input value={settings.general_title} onChange={event => setSettings({ ...settings, general_title: event.target.value })} /></label>
              <label className="wide">Texto para profesionales<textarea rows={3} value={settings.professional_body} onChange={event => setSettings({ ...settings, professional_body: event.target.value })} /></label>
              <label className="wide">Texto para participantes generales<textarea rows={3} value={settings.general_body} onChange={event => setSettings({ ...settings, general_body: event.target.value })} /></label>
              <label>Título para ponentes<input value={settings.speaker_title} onChange={event => setSettings({ ...settings, speaker_title: event.target.value })} /></label>
              <label>Título para el equipo organizador<input value={settings.organizer_title} onChange={event => setSettings({ ...settings, organizer_title: event.target.value })} /></label>
              <label className="wide">Texto para ponentes<textarea rows={3} value={settings.speaker_body} onChange={event => setSettings({ ...settings, speaker_body: event.target.value })} /></label>
              <label className="wide">Texto para el equipo organizador<textarea rows={3} value={settings.organizer_body} onChange={event => setSettings({ ...settings, organizer_body: event.target.value })} /></label>
            </div>

            <div className="certificate-signatures">
              <h3>Firmas</h3>
              <p className="certificate-signature-help">Aparecen en el diploma en este mismo orden. Deja vacía la que no uses: si solo llenas dos, el diploma se ve exactamente como hasta ahora.</p>
              {SIGNATURE_SLOTS.map(slot => {
                const index = slot.index;
                const signature = settings.signatures[index] ?? { name: "", role: "", image_url: "" };
                return (
                <article className="certificate-signature-card" key={slot.key}>
                  <label className="certificate-file-control">
                    <span className="certificate-file-preview">{signature.image_url ? <img src={signature.image_url} alt={`Vista previa de la ${slot.label.toLowerCase()}`} /> : <b>{slot.label}</b>}</span>
                    <input type="file" accept="image/jpeg,image/png" disabled={busyAction === "upload"} onChange={event => upload(event, "signature", index)} />
                    <strong>{busyAction === "upload" ? "Cargando imagen…" : signature.image_url ? "Cambiar firma" : "Cargar firma"}</strong>
                    <small>PNG o JPG · máximo 10 MB</small>
                  </label>
                  <div className="certificate-signature-fields">
                    <b className="certificate-signature-position">{slot.label}</b>
                    <label>Nombre<input value={signature.name} onChange={event => setSettings({ ...settings, signatures: settings.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /></label>
                    <label>Función<input value={signature.role} placeholder="Ej. Organizadora" onChange={event => setSettings({ ...settings, signatures: settings.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) })} /></label>
                  </div>
                </article>
                );
              })}
            </div>

            <div className="certificate-seal">
              <h3>Sellos del diploma</h3>
              <p>Se imprimen girados y fundidos con el papel, como sellos reales, sin tapar los nombres. Puedes activarlos o desactivarlos cuando quieras sin perder la imagen.</p>
              {([
                { key: "sealLeft", title: "Sello izquierdo", help: "Cae entre la firma de la izquierda y la del centro.", url: settings.seal_left_url, enabled: settings.seal_left_enabled, setUrl: (url: string) => setSettings({ ...settings, seal_left_url: url, seal_left_enabled: url ? settings.seal_left_enabled : false }), setEnabled: (value: boolean) => setSettings({ ...settings, seal_left_enabled: value }) },
                { key: "seal", title: "Sello derecho", help: "Monta sobre la mitad derecha de la firma central.", url: settings.seal_url, enabled: settings.seal_enabled, setUrl: (url: string) => setSettings({ ...settings, seal_url: url, seal_enabled: url ? settings.seal_enabled : false }), setEnabled: (value: boolean) => setSettings({ ...settings, seal_enabled: value }) },
              ] as const).map(seal => (
                <div className="certificate-seal-body" key={seal.key}>
                  <label className="certificate-file-control">
                    <span className="certificate-file-preview seal">{seal.url ? <img src={seal.url} alt={`Vista previa del ${seal.title.toLowerCase()}`} /> : <b>{seal.title}</b>}</span>
                    <input type="file" accept="image/jpeg,image/png" disabled={busyAction === "upload"} onChange={event => upload(event, seal.key === "seal" ? "seal" : "sealLeft")} />
                    <strong>{busyAction === "upload" ? "Cargando imagen…" : seal.url ? "Cambiar imagen" : "Cargar imagen"}</strong>
                    <small>PNG con fondo blanco o transparente · máximo 10 MB</small>
                  </label>
                  <div>
                    <b className="certificate-signature-position">{seal.title}</b>
                    <p className="certificate-seal-place">{seal.help}</p>
                    <label className="live-toggle"><div><b>{seal.enabled ? "Activado" : "Desactivado"}</b><small>{seal.enabled ? "Aparece en los diplomas que se emitan a partir de ahora." : "La imagen se conserva, pero no se imprime."}</small></div><input type="checkbox" disabled={!seal.url} checked={seal.enabled} onChange={event => seal.setEnabled(event.target.checked)} /><i /></label>
                    {!seal.url && <small className="certificate-seal-hint">Carga primero la imagen para poder activarlo.</small>}
                    {seal.url && <button type="button" className="danger-link" onClick={() => seal.setUrl("")}>Quitar esta imagen</button>}
                  </div>
                </div>
              ))}
            </div>

            <div className="certificate-logos">
              <h3>Patrocinadores</h3>
              <p>Agrega hasta 4 logos para el pie del diploma. Cada uno se ajustará al mismo espacio, sin deformarse ni recortarse.</p>
              <div>
                {settings.sponsor_logos.map((url, index) => (
                  <figure key={`${url}-${index}`}>
                    <img src={url} alt="Logo de patrocinador" />
                    <button type="button" aria-label="Quitar logo" disabled={busyAction !== null} onClick={() => setSettings({ ...settings, sponsor_logos: settings.sponsor_logos.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                  </figure>
                ))}
                {settings.sponsor_logos.length < MAX_SPONSOR_LOGOS && <label className="certificate-logo-upload"><input type="file" accept="image/jpeg,image/png" disabled={busyAction === "upload"} onChange={event => upload(event, "logo")} /><strong>{busyAction === "upload" ? "Cargando imagen…" : "Agregar logo"}</strong><small>{settings.sponsor_logos.length} de {MAX_SPONSOR_LOGOS} logos · PNG o JPG</small></label>}
              </div>
              {settings.sponsor_logos.length === MAX_SPONSOR_LOGOS && <small className="certificate-logo-limit">Ya agregaste los 4 logos. Puedes quitar uno para reemplazarlo.</small>}
            </div>

            {message && <p className={isErrorMessage(message) ? "community-error" : "community-success"} role="status">{message}</p>}

            <div className="community-modal-actions certificate-editor-actions">
              <button className="secondary" onClick={() => setEditorOpen(false)}>Cerrar</button>
              <button className="secondary" disabled={previewLoading} onClick={() => void showPreview()}>{previewLoading ? "Preparando…" : "Previsualizar cambios"}</button>
              <button className="primary" disabled={busyAction !== null} onClick={save}>{busyAction === "save" ? "Guardando…" : "Guardar modelo"}</button>
            </div>
          </section>
        </div>
      )}

      {previewOpen && (
        <div className="community-modal-backdrop certificate-preview-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPreviewOpen(false); }}>
          <section className="community-modal certificate-preview-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-preview-title">
            <button className="community-modal-close" aria-label="Cerrar vista previa" onClick={() => setPreviewOpen(false)}>×</button>
            <header className="certificate-preview-header">
              <div>
                <p className="section-kicker">VISTA PREVIA</p>
                <h2 id="certificate-preview-title">Así quedará el certificado</h2>
              </div>
              <p>Es el mismo PDF que descargará cada participante. Revisa el texto, las firmas y los logos en los cuatro tipos antes de emitir.</p>
            </header>

            <div className="certificate-preview-toolbar">
              <div className="certificate-type-tabs" role="tablist" aria-label="Tipo de certificado">
                {CERTIFICATE_TYPES.map(type => <button key={type} role="tab" aria-selected={previewType === type} className={previewType === type ? "selected" : ""} onClick={() => void renderPreview(type)}>{CERTIFICATE_TYPE_LABELS[type]}</button>)}
              </div>
              <label>Nombre de muestra<input value={sampleName} maxLength={160} onChange={event => setSampleName(event.target.value)} /></label>
              <button className="secondary" disabled={previewLoading} onClick={() => void renderPreview()}>{previewLoading ? "Actualizando…" : "Actualizar vista"}</button>
            </div>

            <p className="certificate-preview-note"><span aria-hidden="true">◇</span> Vista de prueba: no emite certificados ni modifica cuentas de participantes.</p>
            {previewError && <p className="certificate-preview-error" role="alert">{previewError}</p>}
            <div className={`certificate-preview-stage${previewLoading ? " loading" : ""}`} aria-busy={previewLoading}>
              {previewLoading && <div className="certificate-preview-loading" role="status">Preparando el certificado…</div>}
              {previewUrl && <iframe title={`Vista previa del certificado: ${CERTIFICATE_TYPE_LABELS[previewType]}`} src={`${previewUrl}#toolbar=0&navpanes=0&view=Fit`} />}
            </div>

            <div className="community-modal-actions certificate-preview-actions">
              <button className="secondary" onClick={() => setPreviewOpen(false)}>Cerrar vista</button>
              <button className="primary" disabled={!previewUrl || previewLoading} onClick={openPrintablePreview}>Abrir el PDF en tamaño real</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
