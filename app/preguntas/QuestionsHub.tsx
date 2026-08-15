"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type Program = { id: number; start_time: string; end_time: string; type: string; title: string; speakerName: string };
type InboxQuestion = { id: number; program_item_id: number; question: string; speaker_rating: number; event_rating: number; is_favorite: boolean; answer: string | null; answered_at: string | null; created_at: string; askerName: string };
type AskedQuestion = { id: number; program_item_id: number; question: string; answer: string | null; answered_at: string | null; created_at: string; speakerName: string };
type Data = { enabled: boolean; programs: Program[]; programTitles: Record<string, string>; assignedProgramIds: number[]; inbox: InboxQuestion[]; asked: AskedQuestion[] };

function time(item: Program) { return item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : item.type; }
function when(value: string) { return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default function QuestionsHub() {
  const [data, setData] = useState<Data | null>(null);
  const [programItemId, setProgramItemId] = useState("");
  const [question, setQuestion] = useState("");
  const [speakerRating, setSpeakerRating] = useState(5);
  const [eventRating, setEventRating] = useState(5);
  const [wantsFuture, setWantsFuture] = useState<boolean | null>(null);
  const [futureTopic, setFutureTopic] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyingId, setReplyingId] = useState<number | null>(null);

  async function load() {
    const response = await fetch("/api/questions", { cache: "no-store" });
    if (response.ok) setData(await response.json()); else setError("No se pudo cargar el espacio de preguntas.");
  }
  useEffect(() => {
    const kickoff = window.setTimeout(() => { void load(); }, 0);
    // Las respuestas del ponente aparecen solas mientras la página está abierta.
    const timer = window.setInterval(() => { void load(); }, 25000);
    return () => { window.clearTimeout(kickoff); window.clearInterval(timer); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    const response = await fetch("/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ programItemId: Number(programItemId), question, speakerRating, eventRating, wantsFutureEvent: wantsFuture, futureTopic }) });
    const result = await response.json(); setSaving(false);
    if (!response.ok) { setError(result.error ?? "No se pudo enviar la pregunta."); return; }
    setQuestion(""); setProgramItemId(""); setWantsFuture(null); setFutureTopic(""); setMessage("Tu pregunta llegó al ponente. Gracias por participar.");
    await load();
  }
  async function favorite(id: number, value: boolean) {
    const response = await fetch("/api/questions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, favorite: value }) });
    if (!response.ok) { setError("No se pudo actualizar la selección."); return; }
    await load();
  }
  async function sendReply(id: number) {
    const text = (replyDrafts[id] ?? "").trim();
    if (!text) return;
    setReplyingId(id); setError("");
    const response = await fetch("/api/questions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, answer: text }) });
    setReplyingId(null);
    if (!response.ok) { const result = await response.json(); setError(result.error ?? "No se pudo enviar la respuesta."); return; }
    setReplyDrafts(current => ({ ...current, [id]: "" }));
    await load();
  }
  async function removeReply(id: number) {
    setReplyingId(id);
    const response = await fetch("/api/questions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, answer: "" }) });
    setReplyingId(null);
    if (!response.ok) { setError("No se pudo retirar la respuesta."); return; }
    await load();
  }

  const programName = (id: number) => data?.programTitles?.[String(id)] ?? data?.programs.find(item => item.id === id)?.title ?? "Conferencia";
  // Es ponente quien tenga preguntas recibidas, aunque ya no esté asignado a
  // una conferencia en el panel.
  const isSpeaker = (data?.assignedProgramIds.length ?? 0) > 0 || (data?.inbox.length ?? 0) > 0;
  // Al cerrar el módulo solo dejan de entrar preguntas nuevas: las que ya
  // existen se siguen viendo y respondiendo.
  const canAsk = Boolean(data?.enabled) && (data?.programs.length ?? 0) > 0;
  const hasHistory = isSpeaker || (data?.asked.length ?? 0) > 0;

  const inboxSection = <section className="speaker-inbox">
    <p className="section-kicker">ESPACIO DE PONENTE</p>
    <h2>Preguntas para ti</h2>
    <p>Las favoritas aparecen primero; márcalas para prepararte para el panel en vivo. También puedes responder en privado a quien te escribió.</p>
    {data?.inbox.length ? data.inbox.map(item => <article key={item.id} className={item.is_favorite ? "favorite" : ""}>
      <div>
        <span>{programName(item.program_item_id)} · de {item.askerName}</span>
        <p>{item.question}</p>
        <small>Valoración conferencia {item.speaker_rating}/5 · actividad {item.event_rating}/5 · {when(item.created_at)}</small>
        {item.answer && <div className="question-answer"><b>Tu respuesta</b><p>{item.answer}</p><small>Enviada el {item.answered_at ? when(item.answered_at) : ""} · solo la ve {item.askerName}</small><button type="button" className="danger-link" disabled={replyingId === item.id} onClick={() => removeReply(item.id)}>Retirar respuesta</button></div>}
        {!item.answer && <div className="question-reply">
          <label>Responder a {item.askerName}<textarea rows={3} maxLength={1400} value={replyDrafts[item.id] ?? ""} onChange={event => setReplyDrafts(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Escribe tu respuesta. Solo esta persona la verá en su espacio." /></label>
          <button type="button" className="primary" disabled={replyingId === item.id || !(replyDrafts[item.id] ?? "").trim()} onClick={() => sendReply(item.id)}>{replyingId === item.id ? "Enviando…" : "Enviar respuesta"}</button>
        </div>}
      </div>
      <label className="favorite-check"><input type="checkbox" checked={item.is_favorite} onChange={event => favorite(item.id, event.target.checked)} /> Elegir para responder en vivo</label>
    </article>) : <div className="questions-closed"><p>Aún no han llegado preguntas para tus conferencias.</p></div>}
  </section>;

  return <main className="questions-page">
    <header><Link href="/mi-cuenta" className="access-brand"><img src="/logo-duelo-arbol-morado.png" alt="" /> Encuentro Clínico</Link><Link className="login-link" href="/mi-cuenta">Mi cuenta</Link></header>
    <section>
      <p className="section-kicker">PARTICIPACIÓN EN VIVO</p>
      <h1>{isSpeaker ? "Responde a quienes te preguntaron." : "Pregunta a un conferencista."}</h1>
      {!data ? <p>Preparando el espacio…</p> : <>
        {error && <p className="form-error" role="alert">{error}</p>}

        {/* Quien expuso entra directo a lo suyo: su bandeja va antes que nada. */}
        {isSpeaker && inboxSection}

        {data.asked.length > 0 && <section className="my-questions">
          <p className="section-kicker">TUS PREGUNTAS</p>
          <h2>Lo que enviaste y sus respuestas</h2>
          <p>Cuando el ponente te responda, su mensaje aparecerá aquí. Solo tú lo ves.</p>
          {data.asked.map(item => <article key={item.id} className={item.answer ? "answered" : ""}>
            <div><span>{programName(item.program_item_id)} · {item.speakerName}</span><p>{item.question}</p><small>Enviada el {when(item.created_at)}</small></div>
            {item.answer ? <div className="question-answer"><b>Respuesta de {item.speakerName}</b><p>{item.answer}</p><small>{item.answered_at ? when(item.answered_at) : ""}</small></div> : <p className="question-pending">Sin respuesta todavía.</p>}
          </article>)}
        </section>}

        {canAsk ? <>
          <p className="questions-intro">Selecciona la conferencia, comparte tu pregunta y valora la experiencia. Solo el ponente asignado recibirá tu mensaje, y podrá responderte directamente aquí mismo.</p>
          <form className="questions-form" onSubmit={submit}>
            <label>Conferencia y ponente *<select required value={programItemId} onChange={event => setProgramItemId(event.target.value)}><option value="">Selecciona una conferencia</option>{data.programs.map(item => <option key={item.id} value={item.id}>{time(item)} · {item.title} · {item.speakerName}</option>)}</select></label>
            <label>Tu pregunta *<textarea required minLength={5} maxLength={1400} rows={6} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Escribe una pregunta clara y respetuosa para la conferencia." /></label>
            <label className="rating-field">Califica esta conferencia: <b>{speakerRating}/5</b><input type="range" min="1" max="5" value={speakerRating} onChange={event => setSpeakerRating(Number(event.target.value))} /><small>5 es la valoración más alta.</small></label>
            <label className="rating-field">Califica la actividad: <b>{eventRating}/5</b><input type="range" min="1" max="5" value={eventRating} onChange={event => setEventRating(Number(event.target.value))} /><small>5 es la valoración más alta.</small></label>
            <div className="future-event-field">
              <b>¿Te gustaría otra actividad como esta en el futuro?</b>
              <div className="future-event-options">
                <button type="button" className={wantsFuture === true ? "selected" : ""} aria-pressed={wantsFuture === true} onClick={() => setWantsFuture(wantsFuture === true ? null : true)}>Sí</button>
                <button type="button" className={wantsFuture === false ? "selected" : ""} aria-pressed={wantsFuture === false} onClick={() => { setWantsFuture(wantsFuture === false ? null : false); setFutureTopic(""); }}>No</button>
              </div>
              {wantsFuture === true && <label>¿Sobre qué tema te gustaría?<textarea rows={3} maxLength={600} value={futureTopic} onChange={event => setFutureTopic(event.target.value)} placeholder="Opcional. Cuéntanos qué tema te interesaría para una próxima jornada." /><small>Opcional: puedes enviar tu pregunta sin llenarlo.</small></label>}
            </div>
            {message && <p className="community-success" role="status">{message}</p>}
            <button className="primary" disabled={saving}>{saving ? "Enviando…" : "Enviar pregunta →"}</button>
          </form>
        </> : <div className="questions-closed">
          {!data.enabled
            ? hasHistory
              ? <p>Ya no se reciben preguntas nuevas. Las preguntas de aquí arriba siguen abiertas: puedes responderlas y leer las respuestas cuando quieras.</p>
              : <><h2>Las preguntas se habilitarán durante la jornada.</h2><p>Regresa a este mismo enlace cuando el equipo active la participación en vivo.</p></>
            : <><h2>Todavía no hay conferencias que reciban preguntas.</h2><p>Aparecerán aquí en cuanto la organización asigne a cada ponente su conferencia.</p></>}
        </div>}
      </>}
    </section>
  </main>;
}
