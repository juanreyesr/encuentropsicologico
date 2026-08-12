"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { youtubeEmbedUrl } from "../lib/event";

type LiveState = { live: boolean; authenticated: boolean; title?: string; videoId?: string | null };

/**
 * Cuadro compacto con la transmisión en curso. Solo aparece para cuentas del
 * evento y cuando la organización tiene la sala abierta; en cualquier otro caso
 * se muestra lo que la página ya tenía previsto.
 */
export default function LiveBox({ fallback = null, showLink = true }: { fallback?: ReactNode; showLink?: boolean }) {
  const [state, setState] = useState<LiveState | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch("/api/live", { cache: "no-store" });
      if (!response.ok || !active) return;
      setState(await response.json());
    }
    void load();
    // La sala puede abrirse en cualquier momento desde el panel.
    const timer = window.setInterval(() => void load(), 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!state?.live || !state.authenticated || !state.videoId) return <>{fallback}</>;
  return <article className="live-box">
    <header><span className="live-dot" aria-hidden="true" /> EN VIVO<b>{state.title}</b></header>
    <div className="live-box-frame">
      <iframe
        src={youtubeEmbedUrl(state.videoId)}
        title={state.title ?? "Transmisión en vivo"}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
    {showLink && <footer><Link href="/transmision">Ver en grande →</Link><Link href="/preguntas">Enviar una pregunta →</Link></footer>}
  </article>;
}
