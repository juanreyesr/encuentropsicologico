"use client";

import { useEffect, useState } from "react";

type Count = { total: number; available: number };
type Winner = { id: number; prize: string; scope: string; registration_id: number; winner_name: string; winner_license: string | null; winner_institution: string | null; winner_modality: string | null; delivered_at: string | null; created_at: string };
type Data = { pool: { all: Count; presencial: Count; verified: Count }; winners: Winner[] };
type Scope = "all" | "presencial" | "verified";

const SCOPES: Array<{ value: Scope; label: string; help: string }> = [
  { value: "presencial", label: "Presenciales", help: "Solo quienes se inscribieron para estar en la sala." },
  { value: "verified", label: "Con asistencia verificada", help: "Solo quienes ya pasaron por el registro de asistencia. Es la opción más segura: el ganador está en el lugar." },
  { value: "all", label: "Todos", help: "Presenciales y virtuales juntos. Útil para souvenirs que se entregan después." },
];

const SUSPENSE_MS = 1600;

const dateTime = new Intl.DateTimeFormat("es-GT", { hour: "2-digit", minute: "2-digit" });

export default function RaffleBox() {
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState(false);
  const [prize, setPrize] = useState("Souvenir");
  const [scope, setScope] = useState<Scope>("presencial");
  const [allowRepeat, setAllowRepeat] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/admin/raffle", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }
  useEffect(() => { const kickoff = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(kickoff); }, []);

  async function draw() {
    setDrawing(true); setError(""); setWinner(null);
    const started = Date.now();
    const response = await fetch("/api/admin/raffle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draw", prize, scope, allowRepeat }) });
    const result = await response.json() as Data & { winner?: Winner; error?: string };
    // La espera se completa siempre: el sorteo necesita su momento de tensión
    // aunque el servidor responda al instante.
    const rest = Math.max(0, SUSPENSE_MS - (Date.now() - started));
    window.setTimeout(() => {
      setDrawing(false);
      if (!response.ok) { setError(result.error ?? "No se pudo sortear."); return; }
      setWinner(result.winner ?? null);
      setData({ pool: result.pool, winners: result.winners });
    }, rest);
  }

  async function act(action: "deliver" | "discard", id: number, delivered?: boolean) {
    if (action === "discard" && !window.confirm("Se descarta este sorteo y la persona vuelve a entrar en las siguientes rifas. ¿Continuar?")) return;
    const response = await fetch("/api/admin/raffle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, delivered }) });
    if (!response.ok) { setError("No se pudo actualizar el sorteo."); return; }
    const result = await response.json() as Data;
    setData({ pool: result.pool, winners: result.winners });
    if (action === "discard" && winner?.id === id) setWinner(null);
    if (action === "deliver" && winner?.id === id) setWinner(current => current ? { ...current, delivered_at: delivered === false ? null : new Date().toISOString() } : current);
  }

  const counts = data?.pool[scope];
  const pending = data?.winners.filter(item => !item.delivered_at).length ?? 0;

  return <>
    <section className="panel control-group raffle-panel">
      <div className="panel-title"><h3>Rifas de souvenirs</h3><span className="online">{data?.pool.presencial.available ?? 0} disponibles</span></div>
      <p className="admin-note">Sorteo con filtro interno: solo entran profesionales que registraron su número de colegiado en la inscripción. Los participantes no ven ninguna condición; en pantalla la rifa se ve igual para todos.</p>
      <div className="raffle-summary">
        <article><span>Padrón de la rifa</span><b>{data?.pool.all.total ?? 0}</b><small>profesionales con colegiado</small></article>
        <article><span>En la sala</span><b>{data?.pool.presencial.total ?? 0}</b><small>{data?.pool.verified.total ?? 0} con asistencia verificada</small></article>
        <article><span>Souvenirs sorteados</span><b>{data?.winners.length ?? 0}</b><small>{pending ? `${pending} sin entregar` : "todo entregado"}</small></article>
      </div>
      <button className="primary raffle-open" onClick={() => { setOpen(true); setError(""); }}>Abrir rifas</button>
    </section>

    {open && <div className="community-modal-backdrop raffle-backdrop" role="presentation"><section className="community-modal raffle-stage" role="dialog" aria-modal="true" aria-labelledby="raffle-title">
      <button className="community-modal-close" aria-label="Cerrar rifas" onClick={() => setOpen(false)}>×</button>
      <p className="section-kicker">RIFA DE SOUVENIRS</p>
      <h2 id="raffle-title">{prize.trim() || "Souvenir"}</h2>

      <div className="raffle-setup">
        <label>Premio<input value={prize} maxLength={120} onChange={event => setPrize(event.target.value)} placeholder="Souvenir" /></label>
        <div className="raffle-scope">
          <b>¿Entre quiénes?</b>
          <div className="control-mode-options">
            {SCOPES.map(option => <button key={option.value} type="button" className={scope === option.value ? "selected" : ""} disabled={drawing} onClick={() => setScope(option.value)}>{option.label}</button>)}
          </div>
          <small>{SCOPES.find(option => option.value === scope)?.help} {counts ? `Participan ${counts.available} de ${counts.total}.` : ""}</small>
        </div>
        <label className="raffle-repeat"><input type="checkbox" checked={allowRepeat} onChange={event => setAllowRepeat(event.target.checked)} /> Permitir que alguien gane otra vez</label>
      </div>

      <button className="primary raffle-draw" disabled={drawing || !counts?.available && !allowRepeat} onClick={draw}>{drawing ? "Sorteando…" : "Sortear ganador"}</button>

      {drawing && <div className="raffle-drum" role="status"><span /><span /><span /><b>Sorteando entre {counts?.available ?? 0} participantes…</b></div>}

      {!drawing && winner && <div className="raffle-winner" role="status">
        <span>GANADOR · {winner.prize}</span>
        <b>{winner.winner_name}</b>
        <small>{[winner.winner_institution, winner.winner_modality === "virtual" ? "Participación virtual" : "Presencial"].filter(Boolean).join(" · ")}</small>
        <div className="raffle-winner-actions">
          <button className={winner.delivered_at ? "secondary" : "primary"} onClick={() => void act("deliver", winner.id, !winner.delivered_at)}>{winner.delivered_at ? "Entregado ✓" : "Marcar como entregado"}</button>
          <button className="secondary" onClick={() => void act("discard", winner.id)}>No está: volver a sortear</button>
        </div>
      </div>}

      {error && <p className="attendance-result error" role="status">{error}</p>}

      {(data?.winners.length ?? 0) > 0 && <div className="raffle-history">
        <b>Souvenirs ya sorteados</b>
        {data?.winners.map(item => <p key={item.id} className={item.delivered_at ? "delivered" : ""}>
          <span>{item.winner_name}<small>{item.prize} · {dateTime.format(new Date(item.created_at))}</small></span>
          <button className="raffle-mark" onClick={() => void act("deliver", item.id, !item.delivered_at)}>{item.delivered_at ? "Entregado ✓" : "Marcar entregado"}</button>
          <button className="danger-link" onClick={() => void act("discard", item.id)}>Descartar</button>
        </p>)}
      </div>}

      <button className="secondary raffle-exit" onClick={() => setOpen(false)}>Cerrar rifas</button>
    </section></div>}
  </>;
}
