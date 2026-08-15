import { isEventAdmin } from "../../../../lib/admin";
import { currentUser } from "../../../../lib/auth";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export type RaffleScope = "all" | "presencial" | "verified";
const SCOPES: RaffleScope[] = ["all", "presencial", "verified"];

// Filtro interno de las rifas: solo participan profesionales que dejaron su
// número de colegiado en la inscripción. No se anuncia en ninguna pantalla de
// participantes; el sorteo se ve igual para todo el mundo.
const PROFESSIONAL_FILTER = "status=eq.confirmed&attendee_type=eq.professional";
const POOL_COLUMNS = "id,name,license,institution,modality,attendance_verified_at";

type PoolRow = { id: number; name: string; license: string | null; institution: string | null; modality: string; attendance_verified_at: string | null };
type RaffleRow = { id: number; prize: string; scope: string; registration_id: number; winner_name: string; winner_license: string | null; winner_institution: string | null; winner_modality: string | null; delivered_at: string | null; created_at: string };

async function eligiblePool() {
  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=${POOL_COLUMNS}&${PROFESSIONAL_FILTER}`);
  if (!response.ok) return null;
  const rows = await response.json() as PoolRow[];
  // El colegiado se guarda como texto ya limpio de símbolos: quien no lo puso
  // queda con cadena vacía, así que se descarta aquí y no en el filtro remoto.
  return rows.filter(row => String(row.license ?? "").trim() !== "");
}

function inScope(row: PoolRow, scope: RaffleScope) {
  if (scope === "presencial") return row.modality === "presencial";
  if (scope === "verified") return Boolean(row.attendance_verified_at);
  return true;
}

async function history() {
  const response = await supabaseServerFetch("encuentro_psicologico_raffles?select=id,prize,scope,registration_id,winner_name,winner_license,winner_institution,winner_modality,delivered_at,created_at&order=created_at.desc");
  return response.ok ? await response.json() as RaffleRow[] : [];
}

function payload(pool: PoolRow[], winners: RaffleRow[]) {
  const already = new Set(winners.map(winner => winner.registration_id));
  const counts = (scope: RaffleScope) => {
    const list = pool.filter(row => inScope(row, scope));
    return { total: list.length, available: list.filter(row => !already.has(row.id)).length };
  };
  return { pool: { all: counts("all"), presencial: counts("presencial"), verified: counts("verified") }, winners };
}

export async function GET() {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const [pool, winners] = await Promise.all([eligiblePool(), history()]);
  if (!pool) return Response.json({ error: "No se pudo leer el padrón de participantes." }, { status: 503 });
  return Response.json(payload(pool, winners));
}

// Sorteo con el generador criptográfico del sistema: sin sesgo y sin depender
// del orden en que la base devuelva las filas.
function pick<T>(list: T[]) {
  return list[Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * list.length)];
}

export async function POST(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json() as { action?: string; prize?: string; scope?: RaffleScope; allowRepeat?: boolean; id?: number; delivered?: boolean };

  if (body.action === "deliver") {
    if (!body.id) return Response.json({ error: "Falta el sorteo a marcar." }, { status: 400 });
    const response = await supabaseServerFetch(`encuentro_psicologico_raffles?id=eq.${Number(body.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ delivered_at: body.delivered === false ? null : new Date().toISOString() }) });
    if (!response.ok) return Response.json({ error: "No se pudo actualizar la entrega." }, { status: 503 });
  } else if (body.action === "discard") {
    // Descartar devuelve a la persona al sorteo: sirve cuando el ganador ya no
    // está en la sala y hay que volver a sortear ese souvenir.
    if (!body.id) return Response.json({ error: "Falta el sorteo a descartar." }, { status: 400 });
    const response = await supabaseServerFetch(`encuentro_psicologico_raffles?id=eq.${Number(body.id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
    if (!response.ok) return Response.json({ error: "No se pudo descartar el sorteo." }, { status: 503 });
  } else if (body.action === "draw") {
    const prize = String(body.prize ?? "").trim() || "Souvenir";
    if (prize.length > 120) return Response.json({ error: "El nombre del premio es demasiado largo." }, { status: 400 });
    const scope: RaffleScope = SCOPES.includes(body.scope as RaffleScope) ? body.scope as RaffleScope : "presencial";
    const [pool, winners] = await Promise.all([eligiblePool(), history()]);
    if (!pool) return Response.json({ error: "No se pudo leer el padrón de participantes." }, { status: 503 });
    const already = new Set(winners.map(winner => winner.registration_id));
    const candidates = pool.filter(row => inScope(row, scope) && (body.allowRepeat || !already.has(row.id)));
    if (!candidates.length) {
      return Response.json({ error: already.size && !body.allowRepeat ? "Ya no queda nadie sin premio en este grupo. Puedes permitir repetir ganadores o cambiar el grupo." : "Todavía no hay participantes que cumplan el filtro en este grupo." }, { status: 409 });
    }
    const winner = pick(candidates);
    const user = await currentUser();
    const insert = await supabaseServerFetch("encuentro_psicologico_raffles", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ prize, scope, registration_id: winner.id, winner_name: winner.name, winner_license: winner.license, winner_institution: winner.institution, winner_modality: winner.modality, drawn_by: user?.id ?? null }),
    });
    if (!insert.ok) return Response.json({ error: "No se pudo guardar el resultado del sorteo." }, { status: 503 });
    const [row] = await insert.json() as RaffleRow[];
    const fresh = await history();
    return Response.json({ ok: true, winner: row, candidates: candidates.length, ...payload(pool, fresh) });
  } else {
    return Response.json({ error: "Acción de rifa no reconocida." }, { status: 400 });
  }

  const [pool, winners] = await Promise.all([eligiblePool(), history()]);
  if (!pool) return Response.json({ error: "No se pudo leer el padrón de participantes." }, { status: 503 });
  return Response.json({ ok: true, ...payload(pool, winners) });
}
