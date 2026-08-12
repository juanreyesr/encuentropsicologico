"use client";

import { useEffect, useState } from "react";
import type { EventControls as Controls, MaterialsMode } from "../../lib/event-controls";

type Metrics = { confirmed: number; verified: number; presencial: number; virtual: number; pending: number; organizers: number; organizersVerified: number; speakers: number; questions: number };
type Data = { controls: Controls; metrics: Metrics };

const MATERIALS_MODES: Array<{ value: MaterialsMode; label: string; help: string }> = [
  { value: "auto", label: "Automático", help: "Cada material se libera al terminar su conferencia, solo para quienes tengan la asistencia verificada." },
  { value: "open", label: "Abierto ahora", help: "Todos los materiales quedan disponibles de inmediato para los participantes verificados." },
  { value: "closed", label: "Suspendido", help: "Nadie puede descargar materiales hasta que vuelvas a abrirlos." },
];

export default function EventControls() {
  const [data, setData] = useState<Data | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const response = await fetch("/api/admin/event-controls", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }
  useEffect(() => {
    const kickoff = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 30000);
    return () => { window.clearTimeout(kickoff); window.clearInterval(timer); };
  }, []);

  async function update(changes: Record<string, unknown>, note = "") {
    setSaving(true);
    const response = await fetch("/api/admin/event-controls", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    setSaving(false);
    if (!response.ok) { setMessage("No se pudo aplicar el cambio. Intenta de nuevo."); return; }
    const result = await response.json() as { controls: Controls };
    setData(current => current ? { ...current, controls: result.controls } : current);
    setMessage(note);
    window.setTimeout(() => setMessage(""), 2500);
    await load();
  }

  async function suspendAll() {
    if (!window.confirm("Se cerrarán asistencia, preguntas, diplomas, materiales y biblioteca. Nada de lo ya registrado se borra. ¿Continuar?")) return;
    await update({ action: "suspendAll" }, "Todo quedó suspendido. Puedes reabrir cada función cuando quieras.");
  }

  const controls = data?.controls;
  const metrics = data?.metrics;
  const attendanceSummary = !controls?.attendanceEnabled
    ? "Cerrada: nadie puede verificarse."
    : controls.attendanceOrganizersOnly
      ? "Abierta solo para el equipo organizador."
      : "Abierta para todas las personas inscritas.";

  function toggle(key: keyof Controls, title: string, description: string, note: string, disabled = false) {
    const value = Boolean(controls?.[key]);
    return <label className={`live-toggle${disabled ? " control-disabled" : ""}`}>
      <div><b>{title}</b><small>{description}</small></div>
      <input type="checkbox" disabled={saving || !controls || disabled} checked={value} onChange={event => void update({ [key]: event.target.checked }, note)} /><i />
    </label>;
  }

  return <div className="admin-content event-controls">
    <div className="panel control-master">
      <p className="admin-kicker">CENTRO DE CONTROL</p>
      <h2>Todo el evento se enciende y se apaga aquí.</h2>
      <p>Cada función de la jornada tiene su propio interruptor. Los procesos automáticos siguen trabajando, pero tú decides cuándo se abre o se suspende cada uno, sin perder la información ya registrada.</p>
      <div className="control-actions">
        <button className="danger-link" disabled={saving || !controls} onClick={suspendAll}>Suspender todo ahora</button>
        {message && <span className="control-message" role="status">{message}</span>}
      </div>
    </div>

    <div className="stat-grid control-metrics">
      <article><span>Asistencias verificadas</span><b>{metrics?.verified ?? 0}</b><small>de {metrics?.confirmed ?? 0} inscripciones confirmadas</small></article>
      <article><span>Organización verificada</span><b>{metrics?.organizersVerified ?? 0}</b><small>de {metrics?.organizers ?? 0} organizadores</small></article>
      <article><span>Presenciales / virtuales</span><b>{metrics?.presencial ?? 0} · {metrics?.virtual ?? 0}</b><small>Verificadas por modalidad</small></article>
      <article><span>Preguntas recibidas</span><b>{metrics?.questions ?? 0}</b><small>{metrics?.speakers ?? 0} ponentes asignados</small></article>
    </div>

    <section className="panel control-group">
      <div className="panel-title"><h3>Verificación de asistencia</h3><span className={controls?.attendanceEnabled ? "online" : "problem-count"}>{controls?.attendanceEnabled ? "Abierta" : "Cerrada"}</span></div>
      <p className="admin-note">{attendanceSummary}</p>
      {toggle("attendanceEnabled", "Verificación de asistencia", "Interruptor principal. Al cerrarlo nadie puede confirmar presencia, ni presencial ni virtual.", "Verificación de asistencia actualizada.")}
      {toggle("attendanceOrganizersOnly", "Solo para el equipo organizador", "Útil antes y durante el montaje: la verificación funciona de forma completa, pero únicamente para quienes tengan el rol de organizador. Su asistencia queda registrada de verdad.", "Alcance de la verificación actualizado.", !controls?.attendanceEnabled)}
      {toggle("kioskEnabled", "Modo kiosko para organizadores", "Permite que la organización registre asistentes presenciales por número de teléfono desde su propia cuenta.", "Modo kiosko actualizado.", !controls?.attendanceEnabled)}
      {toggle("selfCheckinEnabled", "Autoconfirmación de participantes virtuales", "Cada persona conectada confirma su presencia desde su cuenta.", "Autoconfirmación actualizada.", !controls?.attendanceEnabled)}
    </section>

    <section className="panel control-group">
      <div className="panel-title"><h3>Participación en vivo</h3><span className={controls?.questionsEnabled ? "online" : "problem-count"}>{controls?.questionsEnabled ? "Abierta" : "Cerrada"}</span></div>
      <p className="admin-note">Las preguntas llegan solo al usuario asignado como ponente de cada conferencia. El enlace y el QR pueden proyectarse desde la sección Preguntas aunque todavía esté cerrado.</p>
      {toggle("questionsEnabled", "Preguntas a conferencistas", "Abre o suspende el envío de preguntas y valoraciones durante la jornada.", "Espacio de preguntas actualizado.")}
    </section>

    <section className="panel control-group">
      <div className="panel-title"><h3>Diplomas y materiales</h3><span className={controls?.certificatesEnabled ? "online" : "problem-count"}>{controls?.certificatesEnabled ? "Descarga abierta" : "Descarga cerrada"}</span></div>
      <p className="admin-note">La emisión de diplomas se hace desde la sección Certificados. Este interruptor controla si las personas ya emitidas pueden descargarlos.</p>
      {toggle("certificatesEnabled", "Descarga de diplomas", "Al cerrarlo, los diplomas dejan de descargarse aunque ya estén emitidos. Nada se borra.", "Descarga de diplomas actualizada.")}
      <div className="control-mode">
        <b>Materiales de las conferencias</b>
        <div className="control-mode-options">
          {MATERIALS_MODES.map(mode => <button key={mode.value} type="button" className={controls?.materialsMode === mode.value ? "selected" : ""} disabled={saving || !controls} onClick={() => void update({ materialsMode: mode.value }, "Materiales del evento actualizados.")}>{mode.label}</button>)}
        </div>
        <small>{MATERIALS_MODES.find(mode => mode.value === controls?.materialsMode)?.help}</small>
      </div>
      {toggle("libraryEnabled", "Biblioteca de la comunidad", "Controla el acceso de participantes a los recursos compartidos y al envío de nuevos aportes.", "Biblioteca comunitaria actualizada.")}
    </section>

    <section className="panel control-group">
      <div className="panel-title"><h3>Vista previa del equipo organizador</h3></div>
      <p className="admin-note">Con esta opción activa, quienes tengan el rol de organizador ven en su cuenta todos los módulos aunque estén cerrados, con un aviso de que aún no están disponibles. Así conocen de antemano lo que tendrán el día del evento. Los demás participantes no ven nada hasta que abras cada función.</p>
      {toggle("organizerPreviewEnabled", "Mostrar módulos cerrados a organizadores", "Visibles, explicados y sin posibilidad de usarlos hasta que los habilites.", "Vista previa de organizadores actualizada.")}
    </section>
  </div>;
}
