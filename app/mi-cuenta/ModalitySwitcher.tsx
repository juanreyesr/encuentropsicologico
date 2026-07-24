"use client";

import { useState } from "react";

export default function ModalitySwitcher({ current }: { current: "presencial" | "virtual" }) {
  const [modality, setModality] = useState(current); const [message, setMessage] = useState(""); const [saving, setSaving] = useState(false);
  async function choose(next: "presencial" | "virtual") {
    if (next === modality) return;
    if (next === "presencial" && !window.confirm("Si vuelves a la asistencia presencial, el cambio quedará sujeto al cupo disponible. ¿Deseas continuar?")) return;
    setSaving(true); setMessage("");
    const response = await fetch("/api/account/modality", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modality: next }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setMessage(result.error ?? "No se pudo actualizar tu modalidad."); return; }
    setModality(next); setMessage(next === "presencial" ? "Tu asistencia presencial quedó confirmada." : "Ahora participarás de forma virtual. Tu espacio presencial fue liberado.");
  }
  return <div className="modality-switcher"><p>Selecciona una sola modalidad de participación.</p><div role="radiogroup" aria-label="Modalidad de asistencia"><button type="button" role="radio" aria-checked={modality === "presencial"} className={modality === "presencial" ? "selected" : ""} disabled={saving} onClick={() => choose("presencial")}><b>Presencial</b><small>Chimaltenango · incluye coffee break y souvenir</small></button><button type="button" role="radio" aria-checked={modality === "virtual"} className={modality === "virtual" ? "selected" : ""} disabled={saving} onClick={() => choose("virtual")}><b>Virtual</b><small>Transmisión y recursos desde tu cuenta</small></button></div>{modality === "virtual" && <small className="modality-note">Si deseas volver a presencial, se confirmará únicamente si hay cupo disponible.</small>}{message && <p className={message.startsWith("Tu asistencia") || message.startsWith("Ahora") ? "community-success" : "form-error"} role="status">{message}</p>}</div>;
}
