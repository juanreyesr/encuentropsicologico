"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type State = {
  enabled: boolean;
  preview: boolean;
  organizer: boolean;
  kiosk: boolean;
  selfCheckin: boolean;
  organizersOnly: boolean;
  registration: { modality: string; status: string; attendance_verified_at?: string | null } | null;
};

type Match = {
  id: number;
  name: string;
  modality: string;
  attendeeType: string | null;
  institution: string | null;
  verifiedAt: string | null;
  alreadyVerified: boolean;
  organizer: boolean;
  speaker: boolean;
};

const PROFILE_LABELS: Record<string, string> = { general: "General", student: "Estudiante", professional: "Profesional" };

function profileLine(match: Match) {
  const parts = [PROFILE_LABELS[match.attendeeType ?? ""] ?? "General"];
  if (match.speaker) parts.push("Ponente");
  if (match.organizer) parts.push("Organización");
  if (match.institution) parts.push(match.institution);
  return parts.join(" · ");
}

function verifiedLabel(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function AttendanceVerifier({ isOrganizer }: { isOrganizer: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [confirmed, setConfirmed] = useState<{ name: string; alreadyVerified: boolean } | null>(null);
  const phoneInput = useRef<HTMLInputElement | null>(null);

  async function load() { const response = await fetch("/api/attendance", { cache: "no-store" }); if (response.ok) setState(await response.json()); }
  useEffect(() => { const kickoff = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(kickoff); }, []);

  async function verifyVirtual() { setSaving(true); setResult(""); const response = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "virtual" }) }); const data = await response.json(); setSaving(false); setResult(response.ok ? (data.alreadyVerified ? `Tu asistencia ya fue verificada, ${data.name}.` : `Asistencia verificada. Gracias, ${data.name}.`) : data.error ?? "No se pudo verificar."); if (response.ok) await load(); }

  // Paso 1: consultar. Solo busca y muestra a quién se está por verificar; no
  // escribe nada, así se corrige un número mal digitado sin marcar a nadie.
  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setResult(""); setMatch(null);
    const response = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lookup", phone }) });
    const data = await response.json();
    setSaving(false);
    if (response.ok) setMatch(data.registration as Match); else setResult(data.error ?? "No se pudo consultar.");
  }

  // Paso 2: confirmar a la persona que ya está en pantalla.
  async function confirmAttendance() {
    if (!match) return;
    setSaving(true); setResult("");
    const response = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "kiosk", phone, registrationId: match.id }) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) { setResult(data.error ?? "No se pudo verificar."); return; }
    setConfirmed({ name: data.name ?? match.name, alreadyVerified: Boolean(data.alreadyVerified) });
    setMatch(null);
    await load();
  }

  // Paso 3: seguir con la siguiente persona sin salir del kiosko.
  function nextPerson() {
    setPhone(""); setMatch(null); setConfirmed(null); setResult("");
    window.setTimeout(() => phoneInput.current?.focus(), 0);
  }

  function closeKiosk() { setOpen(false); nextPerson(); }

  if (!state) return null;
  const organizer = state.organizer || isOrganizer;

  // Vista previa para la organización: el módulo se ve y se explica, pero
  // ninguna acción está disponible hasta que se habilite desde el panel.
  if (!state.enabled) {
    if (!state.preview) return null;
    return <details className="account-resources attendance-card locked-module"><summary><span>ASISTENCIA DEL EVENTO</span><h2>Se habilitará el día del evento<b aria-hidden="true">+</b></h2></summary><div className="account-resources-body"><p className="locked-note"><b>Aún no disponible.</b> Así se verá tu espacio de verificación cuando la organización lo abra.</p><p>{organizer ? "Podrás abrir el modo kiosko, consultar a cada persona por su número de teléfono y confirmar su asistencia una tras otra." : "Podrás confirmar tu presencia desde aquí."}</p><button className="secondary" disabled>Abrir modo kiosko</button></div></details>;
  }

  const virtual = state.registration?.modality === "virtual" && state.registration.status === "confirmed";
  const verified = Boolean(state.registration?.attendance_verified_at);

  return <><details className="account-resources attendance-card" open><summary><span>ASISTENCIA DEL EVENTO</span><h2>{verified ? "Presencia verificada" : "Verifica tu asistencia"}<b aria-hidden="true">+</b></h2></summary><div className="account-resources-body">{state.organizersOnly && organizer && <p className="attendance-test-note"><b>Verificación abierta solo para la organización:</b> tu asistencia y la de tu equipo quedan registradas de forma definitiva. Los demás participantes aún no ven este módulo.</p>}{virtual && state.selfCheckin && <><p>{verified ? "Tu asistencia virtual quedó registrada correctamente." : "Estás conectado a la jornada: confirma tu presencia ahora para que tu diploma pueda emitirse."}</p><button className="primary" disabled={saving || verified} onClick={verifyVirtual}>{verified ? "Asistencia verificada" : saving ? "Verificando…" : "Confirmar mi presencia virtual"}</button></>}{virtual && !state.selfCheckin && <p>La confirmación virtual está suspendida por la organización en este momento.</p>}{!virtual && !organizer && <p>La asistencia presencial se verifica con el equipo organizador en el lugar del evento.</p>}{organizer && <div className="organizer-checkin"><p><b>Organización:</b> {state.kiosk ? "abre el modo kiosko para consultar a cada persona por su teléfono y confirmar su asistencia sin salir de la pantalla." : "el modo kiosko está suspendido; la organización puede reactivarlo desde el panel."}</p><button className="secondary" disabled={!state.kiosk} onClick={() => { setOpen(true); nextPerson(); }}>Abrir modo kiosko</button></div>}{!open && result && <p className="community-success" role="status">{result}</p>}</div></details>

  {open && <div className="community-modal-backdrop attendance-kiosk-backdrop" role="presentation"><section className="community-modal attendance-kiosk" role="dialog" aria-modal="true" aria-labelledby="kiosk-title">
    <button className="community-modal-close" aria-label="Cerrar modo kiosko" onClick={closeKiosk}>×</button>
    <p className="section-kicker">CONTROL PRESENCIAL</p>
    <h2 id="kiosk-title">Verificación de asistencia</h2>

    {confirmed ? <div className="kiosk-done" role="status">
      <span className="kiosk-check" aria-hidden="true">✓</span>
      <b>{confirmed.alreadyVerified ? `${confirmed.name} ya estaba verificado` : `Asistencia confirmada: ${confirmed.name}`}</b>
      <p>{confirmed.alreadyVerified ? "Su asistencia ya estaba registrada, no se duplicó nada." : "Ya puede pasar. Continúa con la siguiente persona."}</p>
      <button className="primary" onClick={nextPerson}>Confirmar otro</button>
    </div> : <>
      <p>{state.organizersOnly ? "Verificación abierta solo para la organización: consulta el teléfono de una persona del equipo con inscripción presencial confirmada." : "Ingresa el número de teléfono, consulta a quién pertenece y confirma solo si es la persona correcta."}</p>

      <form onSubmit={lookup}>
        <label>Número de teléfono<input ref={phoneInput} autoFocus required minLength={8} inputMode="numeric" pattern="[0-9]*" value={phone} onChange={event => { setPhone(event.target.value.replace(/\D/g, "")); setMatch(null); setResult(""); }} /></label>
        {!match && <button className="primary" disabled={saving}>{saving ? "Consultando…" : "Consultar"}</button>}
      </form>

      {match && <div className="kiosk-match">
        <span>¿ES ESTA LA PERSONA?</span>
        <b>{match.name}</b>
        <small>{profileLine(match)}</small>
        {match.alreadyVerified && <p className="kiosk-warning">Ya tiene su asistencia verificada{verifiedLabel(match.verifiedAt) ? ` a las ${verifiedLabel(match.verifiedAt)}` : ""}.</p>}
        <div className="kiosk-actions">
          {match.alreadyVerified
            ? <button className="primary" onClick={nextPerson}>Confirmar otro</button>
            : <button className="primary" disabled={saving} onClick={confirmAttendance}>{saving ? "Confirmando…" : "Confirmar asistencia"}</button>}
          <button className="secondary" onClick={nextPerson} disabled={saving}>No es, buscar otro</button>
        </div>
      </div>}
    </>}

    {result && <p className="attendance-result error" role="status">{result}</p>}
    <button className="secondary kiosk-exit" onClick={closeKiosk}>Salir del modo kiosko</button>
  </section></div>}</>;
}
