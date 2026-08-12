"use client";

import { FormEvent, useEffect, useState } from "react";

type State = {
  enabled: boolean;
  preview: boolean;
  organizer: boolean;
  kiosk: boolean;
  selfCheckin: boolean;
  organizersOnly: boolean;
  registration: { modality: string; status: string; attendance_verified_at?: string | null } | null;
};

export default function AttendanceVerifier({ isOrganizer }: { isOrganizer: boolean }) {
  const [state, setState] = useState<State | null>(null); const [open, setOpen] = useState(false); const [phone, setPhone] = useState(""); const [result, setResult] = useState(""); const [saving, setSaving] = useState(false);
  async function load() { const response = await fetch("/api/attendance", { cache: "no-store" }); if (response.ok) setState(await response.json()); }
  useEffect(() => { const kickoff = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(kickoff); }, []);
  async function verifyVirtual() { setSaving(true); setResult(""); const response = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "virtual" }) }); const data = await response.json(); setSaving(false); setResult(response.ok ? (data.alreadyVerified ? `Tu asistencia ya fue verificada, ${data.name}.` : `Asistencia verificada. Gracias, ${data.name}.`) : data.error ?? "No se pudo verificar."); if (response.ok) await load(); }
  async function verifyKiosk(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setResult(""); const response = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "kiosk", phone }) }); const data = await response.json(); setSaving(false); setResult(response.ok ? (data.alreadyVerified ? `${data.name} ya está verificado.` : `Asistencia verificada: ${data.name}.`) : data.error ?? "No se pudo verificar."); if (response.ok) { setPhone(""); await load(); } }

  if (!state) return null;
  const organizer = state.organizer || isOrganizer;

  // Vista previa para la organización: el módulo se ve y se explica, pero
  // ninguna acción está disponible hasta que se habilite desde el panel.
  if (!state.enabled) {
    if (!state.preview) return null;
    return <details className="account-resources attendance-card locked-module"><summary><span>ASISTENCIA DEL EVENTO</span><h2>Se habilitará el día del evento<b aria-hidden="true">+</b></h2></summary><div className="account-resources-body"><p className="locked-note"><b>Aún no disponible.</b> Así se verá tu espacio de verificación cuando la organización lo abra.</p><p>{organizer ? "Podrás abrir el modo kiosko y registrar la asistencia de las personas presenciales con su número de teléfono." : "Podrás confirmar tu presencia desde aquí."}</p><button className="secondary" disabled>Abrir modo kiosko</button></div></details>;
  }

  const virtual = state.registration?.modality === "virtual" && state.registration.status === "confirmed";
  const verified = Boolean(state.registration?.attendance_verified_at);
  return <><details className="account-resources attendance-card" open><summary><span>ASISTENCIA DEL EVENTO</span><h2>{verified ? "Presencia verificada" : "Verifica tu asistencia"}<b aria-hidden="true">+</b></h2></summary><div className="account-resources-body">{state.organizersOnly && organizer && <p className="attendance-test-note"><b>Verificación abierta solo para la organización:</b> tu asistencia y la de tu equipo quedan registradas de forma definitiva. Los demás participantes aún no ven este módulo.</p>}{virtual && state.selfCheckin && <><p>{verified ? "Tu asistencia virtual quedó registrada correctamente." : "Estás conectado a la jornada: confirma tu presencia ahora para que tu diploma pueda emitirse."}</p><button className="primary" disabled={saving || verified} onClick={verifyVirtual}>{verified ? "Asistencia verificada" : saving ? "Verificando…" : "Confirmar mi presencia virtual"}</button></>}{virtual && !state.selfCheckin && <p>La confirmación virtual está suspendida por la organización en este momento.</p>}{!virtual && !organizer && <p>La asistencia presencial se verifica con el equipo organizador en el lugar del evento.</p>}{organizer && <div className="organizer-checkin"><p><b>Organización:</b> {state.kiosk ? "abre el modo kiosko para registrar a asistentes presenciales con su número de teléfono." : "el modo kiosko está suspendido; la organización puede reactivarlo desde el panel."}</p><button className="secondary" disabled={!state.kiosk} onClick={() => { setOpen(true); setResult(""); }}>Abrir modo kiosko</button></div>}{result && <p className="community-success" role="status">{result}</p>}</div></details>{open && <div className="community-modal-backdrop attendance-kiosk-backdrop" role="presentation"><section className="community-modal attendance-kiosk" role="dialog" aria-modal="true" aria-labelledby="kiosk-title"><button className="community-modal-close" aria-label="Cerrar modo kiosko" onClick={() => setOpen(false)}>×</button><p className="section-kicker">CONTROL PRESENCIAL</p><h2 id="kiosk-title">Verificación de asistencia</h2><p>{state.organizersOnly ? "Verificación abierta solo para la organización: ingresa el teléfono de una persona del equipo con inscripción presencial confirmada." : "Ingresa únicamente el número de teléfono del participante. Su nombre aparecerá antes de finalizar."}</p><form onSubmit={verifyKiosk}><label>Número de teléfono<input autoFocus required minLength={8} inputMode="numeric" pattern="[0-9]*" value={phone} onChange={event => setPhone(event.target.value.replace(/\D/g, ""))} /></label><button className="primary" disabled={saving}>{saving ? "Verificando…" : "Verificar presencia"}</button></form>{result && <p className="attendance-result" role="status">{result}</p>}<button className="secondary" onClick={() => setOpen(false)}>Salir del modo kiosko</button></section></div>}</>;
}
