"use client";

import { useEffect, useMemo, useState } from "react";

type Data = { settings: { questions_enabled: boolean }; metrics: { total: number; favorites: number; speakerRating: number | null; eventRating: number | null } };
export default function QuestionControl() {
  const [data, setData] = useState<Data | null>(null); const [saving, setSaving] = useState(false); const [copied, setCopied] = useState("");
  const url = useMemo(() => typeof window === "undefined" ? "/preguntas" : `${window.location.origin}/preguntas`, []);
  async function load() { const response = await fetch("/api/admin/questions", { cache: "no-store" }); if (response.ok) setData(await response.json()); }
  useEffect(() => { const kickoff = window.setTimeout(() => { void load(); }, 0); const timer = window.setInterval(() => { void load(); }, 30000); return () => { window.clearTimeout(kickoff); window.clearInterval(timer); }; }, []);
  async function toggle(value: boolean) { setSaving(true); const response = await fetch("/api/admin/questions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionsEnabled: value }) }); setSaving(false); if (response.ok) await load(); }
  async function copy() { await navigator.clipboard?.writeText(url); setCopied("Enlace copiado"); window.setTimeout(() => setCopied(""), 2000); }
  const metric = data?.metrics;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&format=png&data=${encodeURIComponent(url)}`;
  return <div className="admin-content question-control"><div className="panel"><p className="admin-kicker">PARTICIPACIÓN EN VIVO</p><h2>Preguntas a conferencistas</h2><p>Activa este control únicamente durante la jornada. Las preguntas llegan solo al usuario asignado como ponente de cada conferencia.</p><label className="live-toggle large"><div><b>{data?.settings.questions_enabled ? "Preguntas habilitadas" : "Preguntas cerradas"}</b><small>{data?.settings.questions_enabled ? "El enlace y el QR ya reciben preguntas." : "El enlace puede proyectarse, pero no recibe preguntas aún."}</small></div><input type="checkbox" disabled={saving} checked={Boolean(data?.settings.questions_enabled)} onChange={event => toggle(event.target.checked)} /><i /></label></div><div className="questions-admin-grid"><article className="panel qr-panel"><img src={qr} alt="Código QR para abrir el espacio de preguntas" /><div><b>Enlace directo</b><code>{url}</code><button className="secondary" onClick={copy}>{copied || "Copiar enlace"}</button></div></article><div className="stat-grid"><article><span>Preguntas recibidas</span><b>{metric?.total ?? 0}</b><small>Actualiza cada 30 segundos</small></article><article><span>Favoritas</span><b>{metric?.favorites ?? 0}</b><small>Elegidas por ponentes</small></article><article><span>Valoración ponencias</span><b>{metric?.speakerRating ?? "—"}</b><small>Promedio sobre 5</small></article><article><span>Valoración actividad</span><b>{metric?.eventRating ?? "—"}</b><small>Promedio sobre 5</small></article></div></div></div>;
}
