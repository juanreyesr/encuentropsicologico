import Link from "next/link";
import { requireUser } from "../../lib/auth";
import { supabaseServerFetch } from "../../lib/supabase-server";

export const dynamic = "force-dynamic";
function youtubeId(value: string) { try { const url = new URL(value); if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null; if (!url.hostname.endsWith("youtube.com") && !url.hostname.endsWith("www.youtube.com")) return null; const fromQuery = url.searchParams.get("v"); if (fromQuery) return fromQuery; const parts = url.pathname.split("/").filter(Boolean); const index = parts.findIndex(part => ["live", "embed", "shorts"].includes(part)); return index >= 0 ? parts[index + 1] ?? null : null; } catch { return null; } }

export default async function LivePage() {
  await requireUser("/transmision");
  const response = await supabaseServerFetch("encuentro_psicologico_content?select=payload&id=eq.site&limit=1");
  const [row] = response.ok ? await response.json() as Array<{ payload: Record<string, unknown> }> : [];
  const payload = row?.payload ?? {}; const live = Boolean(payload.live); const title = String(payload.liveTitle ?? "Encuentro en vivo"); const id = youtubeId(String(payload.liveUrl ?? ""));
  return <main className="live-room"><header><Link href="/mi-cuenta" className="access-brand"><img src="/logo-duelo-arbol-morado.png" alt="" /> Encuentro Clínico</Link><Link href="/preguntas" className="secondary">Preguntas a ponentes →</Link></header><section>{live && id ? <><p className="section-kicker">ACCESO DE PARTICIPANTES</p><h1>{title}</h1><p className="live-room-intro">Estás dentro del encuentro. Mantén esta ventana abierta para seguir la transmisión y participa con tus preguntas desde tu cuenta.</p><div className="youtube-frame"><iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=0&rel=0`} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></> : <div className="live-room-empty"><p className="section-kicker">TRANSMISIÓN PRIVADA</p><h1>La sala aún no está disponible.</h1><p>El equipo organizador habilitará el acceso cuando la transmisión esté lista.</p><Link className="primary" href="/mi-cuenta">Volver a mi cuenta</Link></div>}</section></main>;
}
