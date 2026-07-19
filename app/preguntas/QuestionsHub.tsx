"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Program = { id: number; start_time: string; end_time: string; type: string; title: string };
type InboxQuestion = { id: number; program_item_id: number; question: string; speaker_rating: number; event_rating: number; is_favorite: boolean; created_at: string };
type Data = { enabled: boolean; programs: Program[]; assignedProgramIds: number[]; inbox: InboxQuestion[] };

function time(item: Program) { return item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : item.type; }

export default function QuestionsHub() {
  const [data, setData] = useState<Data | null>(null);
  const [programItemId, setProgramItemId] = useState("");
  const [question, setQuestion] = useState("");
  const [speakerRating, setSpeakerRating] = useState(5);
  const [eventRating, setEventRating] = useState(5);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/questions", { cache: "no-store" });
    if (response.ok) setData(await response.json()); else setError("No se pudo cargar el espacio de preguntas.");
  }
  useEffect(() => { const kickoff = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(kickoff); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ programItemId: Number(programItemId), question, speakerRating, eventRating }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setError(result.error ?? "No se pudo enviar la pregunta."); return; }
    setQuestion(""); setProgramItemId(""); setMessage("Tu pregunta llegó al ponente. Gracias por participar.");
  }
  async function favorite(id: number, value: boolean) {
    const response = await fetch("/api/questions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, favorite: value }) });
    if (!response.ok) { setError("No se pudo actualizar la selección."); return; }
    await load();
  }
  const programName = (id: number) => data?.programs.find(item => item.id === id)?.title ?? "Conferencia";
  return <main className="questions-page"><header><Link href="/mi-cuenta" className="access-brand"><img src="/logo-duelo-arbol-morado.png" alt="" /> Encuentro Clínico</Link><Link className="login-link" href="/mi-cuenta">Mi cuenta</Link></header><section><p className="section-kicker">PARTICIPACIÓN EN VIVO</p><h1>Pregunta a un conferencista.</h1>{!data ? <p>Preparando el espacio…</p> : !data.enabled ? <div className="questions-closed"><h2>Las preguntas se habilitarán durante la jornada.</h2><p>Regresa a este mismo enlace cuando el equipo active la participación en vivo.</p></div> : <><p className="questions-intro">Selecciona la conferencia, comparte tu pregunta y valora la experiencia. Solo el ponente asignado recibirá tu mensaje.</p><form className="questions-form" onSubmit={submit}><label>Conferencia *<select required value={programItemId} onChange={event => setProgramItemId(event.target.value)}><option value="">Selecciona una conferencia</option>{data.programs.map(item => <option key={item.id} value={item.id}>{time(item)} · {item.title}</option>)}</select></label><label>Tu pregunta *<textarea required minLength={5} maxLength={1400} rows={6} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Escribe una pregunta clara y respetuosa para la conferencia." /></label><label className="rating-field">Califica esta conferencia: <b>{speakerRating}/5</b><input type="range" min="1" max="5" value={speakerRating} onChange={event => setSpeakerRating(Number(event.target.value))} /><small>5 es la valoración más alta.</small></label><label className="rating-field">Califica la actividad: <b>{eventRating}/5</b><input type="range" min="1" max="5" value={eventRating} onChange={event => setEventRating(Number(event.target.value))} /><small>5 es la valoración más alta.</small></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="community-success" role="status">{message}</p>}<button className="primary" disabled={saving}>{saving ? "Enviando…" : "Enviar pregunta →"}</button></form>{data.assignedProgramIds.length > 0 && <section className="speaker-inbox"><p className="section-kicker">ESPACIO DE PONENTE</p><h2>Preguntas recibidas</h2><p>Las favoritas aparecen primero; márcalas para prepararte para el panel en vivo.</p>{data.inbox.length ? data.inbox.map(item => <article key={item.id} className={item.is_favorite ? "favorite" : ""}><div><span>{programName(item.program_item_id)}</span><p>{item.question}</p><small>Valoración conferencia {item.speaker_rating}/5 · actividad {item.event_rating}/5</small></div><label><input type="checkbox" checked={item.is_favorite} onChange={event => favorite(item.id, event.target.checked)} /> Elegir para responder</label></article>) : <div className="questions-closed"><p>Aún no han llegado preguntas para tus conferencias.</p></div>}</section>}</>}</section></main>;
}
