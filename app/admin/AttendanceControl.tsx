"use client";

import { useEffect, useState } from "react";

type Data = { settings: { attendance_verification_enabled: boolean }; metrics: { verified: number; presencial: number; virtual: number; pending: number } };
export default function AttendanceControl() {
  const [data, setData] = useState<Data | null>(null); const [saving, setSaving] = useState(false);
  async function load() { const response = await fetch("/api/admin/attendance", { cache: "no-store" }); if (response.ok) setData(await response.json()); }
  useEffect(() => { const kickoff = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 30000); return () => { window.clearTimeout(kickoff); window.clearInterval(timer); }; }, []);
  async function toggle(value: boolean) { setSaving(true); const response = await fetch("/api/admin/attendance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendanceEnabled: value }) }); setSaving(false); if (response.ok) await load(); }
  const metrics = data?.metrics;
  return <div className="admin-content attendance-control"><div className="panel"><p className="admin-kicker">DÍA DEL EVENTO</p><h2>Verificación de asistencia</h2><p>Actívala cuando inicie el control de asistencia. Los organizadores podrán verificar a las personas presenciales desde su cuenta y las virtuales confirmarán su presencia desde la suya.</p><label className="live-toggle large"><div><b>{data?.settings.attendance_verification_enabled ? "Verificación habilitada" : "Verificación cerrada"}</b><small>{data?.settings.attendance_verification_enabled ? "Ya se registran asistencias y quedarán habilitados los diplomas correspondientes." : "Nadie puede confirmarse todavía."}</small></div><input type="checkbox" disabled={saving} checked={Boolean(data?.settings.attendance_verification_enabled)} onChange={event => toggle(event.target.checked)} /><i /></label></div><div className="stat-grid"><article><span>Asistencias verificadas</span><b>{metrics?.verified ?? 0}</b><small>En tiempo real</small></article><article><span>Presenciales</span><b>{metrics?.presencial ?? 0}</b><small>Verificadas por organización</small></article><article><span>Virtuales</span><b>{metrics?.virtual ?? 0}</b><small>Confirmadas desde su cuenta</small></article><article><span>Pendientes</span><b>{metrics?.pending ?? 0}</b><small>Inscripciones confirmadas</small></article></div></div>;
}
