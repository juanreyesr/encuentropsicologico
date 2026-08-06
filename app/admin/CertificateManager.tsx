"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { DEFAULT_CERTIFICATE_SETTINGS, type CertificateSettings } from "../../lib/certificate-template";

type Settings = Required<CertificateSettings>;
type CertificateType = "professional" | "general";

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
      ? [saved.signatures[0] ?? fallback.signatures[0], saved.signatures[1] ?? fallback.signatures[1]]
      : fallback.signatures,
    sponsor_logos: Array.isArray(saved.sponsor_logos) ? saved.sponsor_logos : [],
  };
}

export default function CertificateManager() {
  const [settings, setSettings] = useState<Settings>(freshSettings);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState<CertificateType>("professional");
  const [sampleName, setSampleName] = useState("María Fernanda López");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/certificates")
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

  async function upload(event: ChangeEvent<HTMLInputElement>, type: "signature" | "logo", index = 0) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setMessage("");
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", "certificate");
    const response = await fetch("/api/admin/media", { method: "POST", body: form });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error ?? "No se pudo cargar la imagen.");
      return;
    }
    if (type === "signature") {
      setSettings(current => ({
        ...current,
        signatures: current.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, image_url: result.url } : item),
      }));
    } else {
      setSettings(current => ({ ...current, sponsor_logos: [...current.sponsor_logos, result.url] }));
    }
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/certificates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const result = await response.json();
    setSaving(false);
    if (response.ok) {
      if (result.settings) setSettings(mergeSettings(result.settings));
      setMessage("Modelo de diploma guardado.");
    } else {
      setMessage(result.error ?? "No se pudo guardar el diploma.");
    }
  }

  async function generate() {
    if (!window.confirm("Se emitirán diplomas para todos los participantes confirmados y quedarán disponibles en sus cuentas. ¿Continuar?")) return;
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/certificates/generate", { method: "POST" });
    const result = await response.json();
    setSaving(false);
    setMessage(response.ok
      ? `${result.generated} diploma${result.generated === 1 ? "" : "s"} emitido${result.generated === 1 ? "" : "s"}.`
      : result.error ?? "No se pudieron emitir los diplomas.");
  }

  async function renderPreview(type: CertificateType = previewType) {
    setPreviewType(type);
    setPreviewLoading(true);
    setPreviewError("");
    const response = await fetch("/api/admin/certificates/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings, type, fullName: sampleName }),
    });
    const html = await response.text();
    setPreviewLoading(false);
    if (!response.ok) {
      setPreviewHtml("");
      setPreviewError(html || "No se pudo generar la vista previa.");
      return;
    }
    setPreviewHtml(html);
  }

  async function showPreview(type: CertificateType = previewType) {
    setPreviewOpen(true);
    await renderPreview(type);
  }

  function openPrintablePreview() {
    if (!previewHtml) return;
    const url = URL.createObjectURL(new Blob([previewHtml], { type: "text/html" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className="admin-content certificate-manager">
      <div className="panel">
        <p className="admin-kicker">DIPLOMAS DE PARTICIPACIÓN</p>
        <h2>Un modelo elegante, dos tipos de diploma.</h2>
        <p>Los participantes profesionales recibirán el título profesional; los demás recibirán el diploma general. Configura y revisa ambos modelos antes de emitirlos.</p>
        <div className="certificate-manager-actions">
          <button className="secondary" onClick={() => setEditorOpen(true)}>Editar modelo y firmas</button>
          <button className="secondary certificate-preview-trigger" onClick={() => void showPreview()}>Previsualizar certificados</button>
          <button className="admin-save" disabled={saving} onClick={generate}>{saving ? "Procesando…" : "Generar certificados para confirmados"}</button>
        </div>
        {message && <p className="community-success" role="status">{message}</p>}
      </div>

      {editorOpen && (
        <div className="community-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditorOpen(false); }}>
          <section className="community-modal certificate-modal" role="dialog" aria-modal="true" aria-labelledby="certificate-title">
            <button className="community-modal-close" aria-label="Cerrar editor" onClick={() => setEditorOpen(false)}>×</button>
            <p className="section-kicker">MODELO GENERAL</p>
            <h2 id="certificate-title">Editar diploma</h2>
            <p className="certificate-editor-help">Los cambios se pueden previsualizar antes de guardarlos. La vista de prueba no emite ningún certificado.</p>
            <div className="speaker-form-grid">
              <label className="wide">Nombre del evento<input value={settings.event_name} onChange={event => setSettings({ ...settings, event_name: event.target.value })} /></label>
              <label>Fecha<input value={settings.event_date} onChange={event => setSettings({ ...settings, event_date: event.target.value })} /></label>
              <label>Lugar<input value={settings.event_place} onChange={event => setSettings({ ...settings, event_place: event.target.value })} /></label>
              <label>Título para profesionales<input value={settings.professional_title} onChange={event => setSettings({ ...settings, professional_title: event.target.value })} /></label>
              <label>Título para participantes generales<input value={settings.general_title} onChange={event => setSettings({ ...settings, general_title: event.target.value })} /></label>
              <label className="wide">Texto para profesionales<textarea rows={3} value={settings.professional_body} onChange={event => setSettings({ ...settings, professional_body: event.target.value })} /></label>
              <label className="wide">Texto para participantes generales<textarea rows={3} value={settings.general_body} onChange={event => setSettings({ ...settings, general_body: event.target.value })} /></label>
            </div>

            <div className="certificate-signatures">
              <h3>Firmas</h3>
              {settings.signatures.map((signature, index) => (
                <article key={index}>
                  <div>
                    {signature.image_url ? <img src={signature.image_url} alt={`Firma ${index + 1}`} /> : <span>Firma {index + 1}</span>}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => upload(event, "signature", index)} />
                  </div>
                  <label>Nombre<input value={signature.name} onChange={event => setSettings({ ...settings, signatures: settings.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /></label>
                  <label>Función<input value={signature.role} placeholder="Ej. Organizadora" onChange={event => setSettings({ ...settings, signatures: settings.signatures.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) })} /></label>
                </article>
              ))}
            </div>

            <div className="certificate-logos">
              <h3>Patrocinadores</h3>
              <p>Agrega los logos que deban aparecer en el pie del diploma.</p>
              <div>
                {settings.sponsor_logos.map((url, index) => (
                  <figure key={`${url}-${index}`}>
                    <img src={url} alt="Logo de patrocinador" />
                    <button type="button" aria-label="Quitar logo" onClick={() => setSettings({ ...settings, sponsor_logos: settings.sponsor_logos.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                  </figure>
                ))}
                <label className="media-upload"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => upload(event, "logo")} /><span>Agregar logo</span></label>
              </div>
            </div>

            <div className="community-modal-actions certificate-editor-actions">
              <button className="secondary" onClick={() => setEditorOpen(false)}>Cerrar</button>
              <button className="secondary" disabled={previewLoading} onClick={() => void showPreview()}>{previewLoading ? "Preparando…" : "Previsualizar cambios"}</button>
              <button className="primary" disabled={saving} onClick={save}>{saving ? "Guardando…" : "Guardar modelo"}</button>
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
              <p>Revisa el texto, las firmas y los logos en ambos tipos antes de emitir.</p>
            </header>

            <div className="certificate-preview-toolbar">
              <div className="certificate-type-tabs" role="tablist" aria-label="Tipo de certificado">
                <button role="tab" aria-selected={previewType === "professional"} className={previewType === "professional" ? "selected" : ""} onClick={() => void renderPreview("professional")}>Profesional</button>
                <button role="tab" aria-selected={previewType === "general"} className={previewType === "general" ? "selected" : ""} onClick={() => void renderPreview("general")}>General</button>
              </div>
              <label>Nombre de muestra<input value={sampleName} maxLength={160} onChange={event => setSampleName(event.target.value)} /></label>
              <button className="secondary" disabled={previewLoading} onClick={() => void renderPreview()}>{previewLoading ? "Actualizando…" : "Actualizar vista"}</button>
            </div>

            <p className="certificate-preview-note"><span aria-hidden="true">◇</span> Vista de prueba: no emite certificados ni modifica cuentas de participantes.</p>
            {previewError && <p className="certificate-preview-error" role="alert">{previewError}</p>}
            <div className={`certificate-preview-stage${previewLoading ? " loading" : ""}`} aria-busy={previewLoading}>
              {previewLoading && <div className="certificate-preview-loading" role="status">Preparando el certificado…</div>}
              {previewHtml && <iframe title={`Vista previa del certificado ${previewType === "professional" ? "profesional" : "general"}`} srcDoc={previewHtml} />}
            </div>

            <div className="community-modal-actions certificate-preview-actions">
              <button className="secondary" onClick={() => setPreviewOpen(false)}>Cerrar vista</button>
              <button className="primary" disabled={!previewHtml || previewLoading} onClick={openPrintablePreview}>Abrir en tamaño real / imprimir prueba</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
