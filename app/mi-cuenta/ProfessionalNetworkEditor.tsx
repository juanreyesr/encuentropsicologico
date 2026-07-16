"use client";

import { FormEvent, useState } from "react";

export type ProfessionalDirectory = {
  share_enabled: boolean;
  profession: string | null;
  specialty: string | null;
  address: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
};

const emptyDirectory: ProfessionalDirectory = {
  share_enabled: false,
  profession: "",
  specialty: "",
  address: "",
  email: "",
  whatsapp: "",
  website: "",
  instagram: "",
};

export default function ProfessionalNetworkEditor({
  initialOptIn,
  initialDirectory,
}: {
  initialOptIn: boolean;
  initialDirectory?: ProfessionalDirectory | null;
}) {
  const [professionalNetworkOptIn, setProfessionalNetworkOptIn] = useState(initialOptIn);
  const [directory, setDirectory] = useState<ProfessionalDirectory>({ ...emptyDirectory, ...(initialDirectory ?? {}) });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(field: keyof ProfessionalDirectory, value: string | boolean) {
    setDirectory(current => ({ ...current, [field]: field === "whatsapp" && typeof value === "string" ? value.replace(/\D/g, "") : value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/account/professional-directory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ professionalNetworkOptIn, ...directory }),
    });
    setSaving(false);
    setMessage(response.ok ? "Preferencias de red profesional guardadas." : "No fue posible guardar estos datos.");
  }

  return <section className="professional-network-card">
    <div>
      <span>RED PROFESIONAL</span>
      <h2>Conecta con otros profesionales.</h2>
      <p>Esta información es opcional. Solo se usará dentro de la infraestructura del encuentro y podrás cambiarla cuando quieras.</p>
    </div>
    <form onSubmit={submit}>
      <label className="account-check">
        <input type="checkbox" checked={professionalNetworkOptIn} onChange={event => setProfessionalNetworkOptIn(event.target.checked)} />
        <span><b>Quiero ser parte de una red profesional.</b><small>El equipo organizador podrá saber que deseas integrarte a futuras actividades y contactos profesionales.</small></span>
      </label>
      <label className="account-check">
        <input type="checkbox" checked={directory.share_enabled} onChange={event => updateField("share_enabled", event.target.checked)} />
        <span><b>Me gustaría que mi oficina y especialidad se comparta con otros profesionales.</b><small>Si marcas esta opción, llena solo los datos que quieres compartir con otros profesionales.</small></span>
      </label>
      {directory.share_enabled && <div className="directory-form">
        <p>Llena solo los datos que quieres compartir con otros profesionales:</p>
        <label>Profesión<input value={directory.profession ?? ""} onChange={event => updateField("profession", event.target.value)} /></label>
        <label>Especialidad<input value={directory.specialty ?? ""} onChange={event => updateField("specialty", event.target.value)} /></label>
        <label className="wide">Dirección<input value={directory.address ?? ""} onChange={event => updateField("address", event.target.value)} /></label>
        <label>Correo electrónico<input type="email" value={directory.email ?? ""} onChange={event => updateField("email", event.target.value)} /></label>
        <label>WhatsApp<input inputMode="numeric" pattern="[0-9]*" value={directory.whatsapp ?? ""} onChange={event => updateField("whatsapp", event.target.value)} /></label>
        <label>Página web<input value={directory.website ?? ""} onChange={event => updateField("website", event.target.value)} placeholder="https://..." /></label>
        <label>Instagram<input value={directory.instagram ?? ""} onChange={event => updateField("instagram", event.target.value)} placeholder="@usuario" /></label>
      </div>}
      {message && <p className="account-status">{message}</p>}
      <button className="primary" type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar red profesional"} <span>→</span></button>
    </form>
  </section>;
}
