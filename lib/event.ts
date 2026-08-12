export const EVENT_START = "2026-08-15T08:30:00-06:00";
export const EVENT_CAPACITY = 250;

export function eventDaysRemaining(now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(EVENT_START).getTime() - now) / 86_400_000));
}

export type EventSpeaker = {
  id: number;
  name: string;
  professional_title: string;
  talk_title: string;
  talk_time: string;
  program_item_id: number | null;
  bio: string;
  photo_url: string | null;
  video_url: string | null;
  contact_email: string;
  contact_phone: string;
  contact_website: string;
  display_order: number;
  is_published: boolean;
};

export type EventProgramItem = {
  id: number;
  start_time: string;
  end_time: string;
  type: string;
  title: string;
  description: string;
  details: string;
  display_order: number;
  is_published: boolean;
};

export const DEFAULT_PROGRAM: EventProgramItem[] = [
  { id: 1, start_time: "8:30", end_time: "9:00", type: "Registro", title: "Registro e inscripciones", description: "Recepción de participantes", details: "Ingreso, verificación de inscripción y ubicación de participantes.", display_order: 1, is_published: true },
  { id: 2, start_time: "9:00", end_time: "9:10", type: "Apertura", title: "Apertura institucional", description: "Bienvenida a la jornada", details: "Palabras de bienvenida, encuadre académico y presentación general de la jornada.", display_order: 2, is_published: true },
  { id: 3, start_time: "9:10", end_time: "9:30", type: "Charla 1", title: "Diagnóstico", description: "Duelo normal vs. trastorno de duelo prolongado · DSM-5-TR / CIE-11", details: "Criterios clínicos, señales de alarma y diagnóstico diferencial.", display_order: 3, is_published: true },
  { id: 4, start_time: "9:30", end_time: "9:50", type: "Charla 2", title: "Impacto corporal", description: "Somatización del duelo no resuelto", details: "Manifestaciones corporales y lectura clínica del impacto del duelo detenido.", display_order: 4, is_published: true },
  { id: 5, start_time: "9:50", end_time: "10:10", type: "Charla 3", title: "Manejo terapéutico", description: "Intervención clínica individual", details: "Recursos de intervención y acompañamiento psicoterapéutico.", display_order: 5, is_published: true },
  { id: 6, start_time: "10:10", end_time: "10:25", type: "Receso", title: "Coffee break", description: "Pausa y encuentro", details: "Coffee break para participantes presenciales y pausa técnica para participantes virtuales.", display_order: 6, is_published: true },
  { id: 7, start_time: "10:25", end_time: "10:45", type: "Charla 4", title: "Manejo familiar", description: "El sistema familiar frente al duelo detenido", details: "Dinámicas familiares, recursos de apoyo y abordaje sistémico.", display_order: 7, is_published: true },
  { id: 8, start_time: "10:45", end_time: "11:05", type: "Charla 5", title: "Psiquiatría", description: "Cuándo se requiere manejo farmacológico", details: "Criterios de referencia, manejo interdisciplinario y acompañamiento médico.", display_order: 8, is_published: true },
  { id: 9, start_time: "11:05", end_time: "11:25", type: "Charla 6", title: "Cierre comunitario", description: "Resiliencia y rol del psicólogo local", details: "Cierre comunitario, mirada local y continuidad del acompañamiento.", display_order: 9, is_published: true },
  { id: 10, start_time: "11:25", end_time: "12:00", type: "Cierre", title: "Panel de preguntas y entrega de constancias", description: "Conversación con los 6 ponentes · cierre institucional", details: "Panel integrador, preguntas del público, cierre institucional y entrega de constancias.", display_order: 10, is_published: true },
];

export function programTimeLabel(item: Pick<EventProgramItem, "start_time" | "end_time">) {
  return item.start_time && item.end_time ? `${item.start_time}–${item.end_time}` : item.start_time || item.end_time || "Horario pendiente";
}

/**
 * Acepta los formatos que la organización suele copiar de YouTube: enlace
 * normal, youtu.be, /live y /embed, con o sin parámetros añadidos.
 */
export function youtubeVideoId(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "youtube-nocookie.com") return null;
    const fromQuery = url.searchParams.get("v");
    if (fromQuery) return fromQuery;
    const parts = url.pathname.split("/").filter(Boolean);
    const index = parts.findIndex(part => ["live", "embed", "shorts", "v"].includes(part));
    return index >= 0 ? parts[index + 1] ?? null : null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(videoId: string, options: { autoplay?: boolean } = {}) {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&autoplay=${options.autoplay ? 1 : 0}`;
}
