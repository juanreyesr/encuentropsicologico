"use client";

import { useEffect, useRef, useState } from "react";

type Summary = { average: number | null; count: number; distribution: number[] };
type SpeakerRating = Summary & { id: number; title: string; timeLabel: string; speakerName: string; answered: number; favorites: number; lastAt: string | null };
type Recent = { id: number; title: string; speakerName: string; speakerRating: number; eventRating: number; createdAt: string };
type FutureInterest = { answered: number; yes: number; no: number; topics: Array<{ id: number; text: string; createdAt: string }> };
type Data = {
  updatedAt: string;
  future: FutureInterest;
  totals: { questions: number; answered: number; favorites: number; participants: number; lastAt: string | null };
  event: Summary;
  speakers: SpeakerRating[];
  recent: Recent[];
};

const REFRESH_MS = 15000;

function Stars({ value }: { value: number | null }) {
  const filled = Math.round(value ?? 0);
  return <span className="rating-stars" aria-hidden="true">{[1, 2, 3, 4, 5].map(step => <i key={step} className={step <= filled ? "on" : ""}>★</i>)}</span>;
}

function Distribution({ distribution, count }: { distribution: number[]; count: number }) {
  return <div className="rating-distribution">{[5, 4, 3, 2, 1].map(step => {
    const value = distribution[step - 1] ?? 0;
    return <p key={step}><span>{step}★</span><b style={{ width: `${count ? Math.round((value / count) * 100) : 0}%` }} /><em>{value}</em></p>;
  })}</div>;
}

function elapsed(value: string | null) {
  if (!value) return "sin registros";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "hace unos segundos";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function RatingsDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [pulse, setPulse] = useState(false);
  const [tick, setTick] = useState(0);
  const lastCount = useRef(0);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch("/api/admin/ratings", { cache: "no-store" });
      if (!response.ok || !active) return;
      const fresh = await response.json() as Data;
      setData(current => {
        // Un destello marca la llegada de valoraciones nuevas sin interrumpir la lectura.
        if (current && fresh.totals.questions > lastCount.current) { setPulse(true); window.setTimeout(() => setPulse(false), 1200); }
        lastCount.current = fresh.totals.questions;
        return fresh;
      });
    }
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    // Mantiene frescos los "hace X min" aunque no lleguen datos nuevos.
    const clock = window.setInterval(() => setTick(value => value + 1), 30000);
    return () => { active = false; window.clearInterval(timer); window.clearInterval(clock); };
  }, []);

  const ranked = [...(data?.speakers ?? [])].sort((first, second) => (second.average ?? -1) - (first.average ?? -1) || second.count - first.count);
  const best = ranked.find(item => item.count > 0) ?? null;
  const answerRate = data?.totals.questions ? Math.round((data.totals.answered / data.totals.questions) * 100) : 0;

  return <section className={`panel ratings-dashboard${pulse ? " pulse" : ""}`} data-tick={tick}>
    <div className="panel-title">
      <h3>Valoraciones en vivo</h3>
      <span className="online">{data ? `Actualizado ${elapsed(data.updatedAt)}` : "Cargando…"}</span>
    </div>

    <div className="ratings-hero">
      <article className="ratings-score">
        <span>VALORACIÓN GENERAL DE LA ACTIVIDAD</span>
        <b>{data?.event.average ?? "—"}<em>/5</em></b>
        <Stars value={data?.event.average ?? null} />
        <small>{data?.event.count ?? 0} valoración{(data?.event.count ?? 0) === 1 ? "" : "es"} recibidas</small>
      </article>
      <article className="ratings-breakdown">
        <span>CÓMO SE REPARTEN</span>
        <Distribution distribution={data?.event.distribution ?? []} count={data?.event.count ?? 0} />
      </article>
      <article className="ratings-highlights">
        <p><span>Preguntas recibidas</span><b>{data?.totals.questions ?? 0}</b></p>
        <p><span>Respondidas por ponentes</span><b>{data?.totals.answered ?? 0}<i>{answerRate}%</i></b></p>
        <p><span>Elegidas para el panel</span><b>{data?.totals.favorites ?? 0}</b></p>
        <p><span>Personas participando</span><b>{data?.totals.participants ?? 0}</b></p>
        <small>Última pregunta {elapsed(data?.totals.lastAt ?? null)}</small>
      </article>
    </div>

    <div className="ratings-speakers">
      <div className="ratings-subtitle"><h4>Valoración individual por conferencia</h4>{best && <span>Mejor valorada: {best.speakerName} · {best.average}/5</span>}</div>
      {ranked.length === 0 ? <div className="admin-empty"><b>Aún no hay valoraciones.</b><p>Aparecerán aquí en cuanto los participantes empiecen a enviar preguntas.</p></div> : <div className="ratings-speaker-list">
        {ranked.map(item => <article key={item.id} className={item.count ? "" : "empty"}>
          <header>
            <div><b>{item.speakerName}</b><small>{item.timeLabel ? `${item.timeLabel} · ` : ""}{item.title}</small></div>
            <div className="ratings-speaker-score"><b>{item.average ?? "—"}</b><Stars value={item.average} /></div>
          </header>
          <div className="ratings-bar"><b style={{ width: `${item.average ? (item.average / 5) * 100 : 0}%` }} /></div>
          <footer><span>{item.count} valoración{item.count === 1 ? "" : "es"}</span><span>{item.answered} respondida{item.answered === 1 ? "" : "s"}</span><span>{item.favorites} para el panel</span><span>{elapsed(item.lastAt)}</span></footer>
        </article>)}
      </div>}
    </div>

    {(data?.future.answered ?? 0) > 0 && <div className="ratings-future">
      <div className="ratings-subtitle"><h4>¿Quieren otra actividad como esta?</h4><span>{data?.future.answered} persona{data?.future.answered === 1 ? "" : "s"} respondió</span></div>
      <div className="ratings-future-counts">
        <article className="yes"><span>Sí</span><b>{data?.future.yes ?? 0}</b><small>{data?.future.answered ? Math.round(((data?.future.yes ?? 0) / data.future.answered) * 100) : 0}%</small></article>
        <article><span>No</span><b>{data?.future.no ?? 0}</b><small>{data?.future.answered ? Math.round(((data?.future.no ?? 0) / data.future.answered) * 100) : 0}%</small></article>
      </div>
      {(data?.future.topics.length ?? 0) > 0 && <div className="ratings-topics">
        <b>Temas que proponen</b>
        {data?.future.topics.map(topic => <p key={topic.id}>{topic.text}<small>{elapsed(topic.createdAt)}</small></p>)}
      </div>}
    </div>}

    {(data?.recent.length ?? 0) > 0 && <div className="ratings-feed">
      <div className="ratings-subtitle"><h4>Últimas valoraciones</h4></div>
      {data?.recent.map(item => <p key={item.id}><span>{item.speakerName} · {item.title}</span><b>{item.speakerRating}★ conferencia</b><b>{item.eventRating}★ actividad</b><small>{elapsed(item.createdAt)}</small></p>)}
    </div>}
  </section>;
}
