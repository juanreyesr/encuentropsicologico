export type CertificateSignature = { name?: string; role?: string; image_url?: string };
const MAX_SPONSOR_LOGOS = 4;

/**
 * Cada función dentro de la actividad recibe su propio diploma: participación
 * profesional, participación general, reconocimiento a ponentes y
 * reconocimiento al equipo organizador.
 */
export const CERTIFICATE_TYPES = ["professional", "general", "speaker", "organizer"] as const;
export type CertificateType = (typeof CERTIFICATE_TYPES)[number];

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  professional: "Profesional",
  general: "General",
  speaker: "Ponente",
  organizer: "Organización",
};

/**
 * Las firmas laterales conservan su posición histórica (0 y 1) y la central se
 * guarda al final, de modo que los modelos ya guardados siguen intactos.
 */
export const SIGNATURE_SLOTS = [
  { index: 0, key: "left", label: "Firma izquierda" },
  { index: 2, key: "center", label: "Firma central" },
  { index: 1, key: "right", label: "Firma derecha" },
] as const;

export const SIGNATURE_DISPLAY_ORDER = SIGNATURE_SLOTS.map(slot => slot.index);
export const CENTER_SIGNATURE_INDEX = 2;

export function certificateType(value: unknown): CertificateType {
  return CERTIFICATE_TYPES.includes(value as CertificateType) ? value as CertificateType : "general";
}

export type CertificateSettings = {
  event_name?: string;
  event_date?: string;
  event_place?: string;
  professional_title?: string;
  general_title?: string;
  speaker_title?: string;
  organizer_title?: string;
  professional_body?: string;
  general_body?: string;
  speaker_body?: string;
  organizer_body?: string;
  signatures?: CertificateSignature[];
  sponsor_logos?: string[];
  seal_url?: string;
  seal_enabled?: boolean;
  seal_left_url?: string;
  seal_left_enabled?: boolean;
};

export const DEFAULT_CERTIFICATE_SETTINGS: Required<CertificateSettings> = {
  event_name: "Cuando el Duelo se Detiene: Jornada Clínica sobre Duelo Prolongado",
  event_date: "15 de agosto de 2026",
  event_place: "Chimaltenango, Guatemala",
  professional_title: "Diploma de participación profesional",
  general_title: "Diploma de participación",
  speaker_title: "Diploma de reconocimiento a ponente",
  organizer_title: "Diploma de reconocimiento al equipo organizador",
  professional_body: "Por su valiosa participación y actualización profesional en la jornada clínica.",
  general_body: "Por su valiosa participación en la jornada clínica.",
  speaker_body: "Por compartir su experiencia clínica como ponente de la jornada y aportar al crecimiento profesional de la comunidad.",
  organizer_body: "Por su dedicación y trabajo en la organización de la jornada clínica, que hizo posible este encuentro.",
  signatures: [{ name: "", role: "", image_url: "" }, { name: "", role: "", image_url: "" }, { name: "", role: "", image_url: "" }],
  sponsor_logos: [],
  seal_url: "",
  seal_enabled: false,
  seal_left_url: "",
  seal_left_enabled: false,
};

function cleanString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeCertificateSettings(value: unknown): Required<CertificateSettings> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const signatureInput = Array.isArray(source.signatures) ? source.signatures.slice(0, SIGNATURE_SLOTS.length) : [];
  const signatures = SIGNATURE_SLOTS.map((_, index) => {
    const item = signatureInput[index] && typeof signatureInput[index] === "object" ? signatureInput[index] as Record<string, unknown> : {};
    return { name: cleanString(item.name, 100), role: cleanString(item.role, 100), image_url: cleanString(item.image_url, 800) };
  });
  return {
    event_name: cleanString(source.event_name, 220) || DEFAULT_CERTIFICATE_SETTINGS.event_name,
    event_date: cleanString(source.event_date, 120) || DEFAULT_CERTIFICATE_SETTINGS.event_date,
    event_place: cleanString(source.event_place, 160) || DEFAULT_CERTIFICATE_SETTINGS.event_place,
    professional_title: cleanString(source.professional_title, 160) || DEFAULT_CERTIFICATE_SETTINGS.professional_title,
    general_title: cleanString(source.general_title, 160) || DEFAULT_CERTIFICATE_SETTINGS.general_title,
    speaker_title: cleanString(source.speaker_title, 160) || DEFAULT_CERTIFICATE_SETTINGS.speaker_title,
    organizer_title: cleanString(source.organizer_title, 160) || DEFAULT_CERTIFICATE_SETTINGS.organizer_title,
    professional_body: cleanString(source.professional_body, 700) || DEFAULT_CERTIFICATE_SETTINGS.professional_body,
    general_body: cleanString(source.general_body, 700) || DEFAULT_CERTIFICATE_SETTINGS.general_body,
    speaker_body: cleanString(source.speaker_body, 700) || DEFAULT_CERTIFICATE_SETTINGS.speaker_body,
    organizer_body: cleanString(source.organizer_body, 700) || DEFAULT_CERTIFICATE_SETTINGS.organizer_body,
    signatures,
    sponsor_logos: Array.isArray(source.sponsor_logos) ? source.sponsor_logos.map(item => cleanString(item, 800)).filter(Boolean).slice(0, MAX_SPONSOR_LOGOS) : [],
    seal_url: cleanString(source.seal_url, 800),
    seal_enabled: source.seal_enabled === true,
    seal_left_url: cleanString(source.seal_left_url, 800),
    seal_left_enabled: source.seal_left_enabled === true,
  };
}
