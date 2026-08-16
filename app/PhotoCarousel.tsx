"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Carrusel de fotografías del encuentro. Se desliza con el dedo, con las
 * flechas del teclado o con los botones, y al tocar una foto se abre en grande.
 */

type Photo = { id: number; image_url: string; caption: string | null };

const AUTOPLAY_MS = 6000;

export default function PhotoCarousel() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    let active = true;
    fetch("/api/gallery")
      .then(response => response.json())
      .then(data => { if (active) setPhotos(data.photos ?? []); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const goTo = useCallback((next: number) => {
    const element = track.current;
    if (!element || !photos.length) return;
    const target = (next + photos.length) % photos.length;
    element.scrollTo({ left: target * element.clientWidth, behavior: "smooth" });
    setIndex(target);
  }, [photos.length]);

  // Avanza sola, pero se detiene mientras se mira una foto o se interactúa.
  useEffect(() => {
    if (photos.length < 2 || open !== null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => { if (!paused.current) goTo(index + 1); }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [photos.length, index, open, goTo]);

  // Al deslizar con el dedo, el punto activo sigue a la foto que quedó centrada.
  function onScroll() {
    const element = track.current;
    if (!element || !element.clientWidth) return;
    setIndex(Math.round(element.scrollLeft / element.clientWidth));
  }

  useEffect(() => {
    if (open === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight") setOpen(current => current === null ? null : (current + 1) % photos.length);
      if (event.key === "ArrowLeft") setOpen(current => current === null ? null : (current - 1 + photos.length) % photos.length);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);

  if (!photos.length) return null;
  const current = open === null ? null : photos[open];

  return <section id="galeria" className="gallery-section section-pad">
    <div className="section-head">
      <div><p className="section-kicker">MEMORIA DE LA JORNADA</p><h2>Así se vivió<br /><em>el encuentro.</em></h2></div>
      <p className="side-copy dark-copy">Un recorrido por los momentos de la jornada clínica: las conferencias, los espacios de encuentro y quienes hicieron posible este día.</p>
    </div>

    <div
      className="carousel"
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
      onFocusCapture={() => { paused.current = true; }}
      onBlurCapture={() => { paused.current = false; }}
    >
      <div className="carousel-track" ref={track} onScroll={onScroll} tabIndex={0} role="group" aria-label="Fotografías del encuentro"
        onKeyDown={event => {
          if (event.key === "ArrowRight") { event.preventDefault(); goTo(index + 1); }
          if (event.key === "ArrowLeft") { event.preventDefault(); goTo(index - 1); }
        }}>
        {photos.map((photo, position) => <figure key={photo.id}>
          <button type="button" onClick={() => setOpen(position)} aria-label={photo.caption ? `Ver en grande: ${photo.caption}` : `Ver en grande la fotografía ${position + 1}`}>
            <img src={photo.image_url} alt={photo.caption ?? `Fotografía ${position + 1} del encuentro`} loading={position < 2 ? "eager" : "lazy"} />
          </button>
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>)}
      </div>

      {photos.length > 1 && <>
        <button type="button" className="carousel-arrow prev" onClick={() => goTo(index - 1)} aria-label="Fotografía anterior">←</button>
        <button type="button" className="carousel-arrow next" onClick={() => goTo(index + 1)} aria-label="Fotografía siguiente">→</button>
        <div className="carousel-dots" role="tablist" aria-label="Ir a una fotografía">
          {photos.map((photo, position) => <button
            key={photo.id}
            type="button"
            role="tab"
            aria-selected={position === index}
            aria-label={`Fotografía ${position + 1} de ${photos.length}`}
            className={position === index ? "active" : ""}
            onClick={() => goTo(position)}
          />)}
        </div>
      </>}
    </div>

    {current && <div className="carousel-lightbox" role="dialog" aria-modal="true" aria-label={current.caption ?? "Fotografía del encuentro"} onMouseDown={event => { if (event.target === event.currentTarget) setOpen(null); }}>
      <button type="button" className="carousel-close" onClick={() => setOpen(null)} aria-label="Cerrar">×</button>
      {photos.length > 1 && <button type="button" className="carousel-arrow prev" onClick={() => setOpen((open! - 1 + photos.length) % photos.length)} aria-label="Fotografía anterior">←</button>}
      <figure>
        <img src={current.image_url} alt={current.caption ?? "Fotografía del encuentro"} />
        {current.caption && <figcaption>{current.caption}</figcaption>}
      </figure>
      {photos.length > 1 && <button type="button" className="carousel-arrow next" onClick={() => setOpen((open! + 1) % photos.length)} aria-label="Fotografía siguiente">→</button>}
    </div>}
  </section>;
}
