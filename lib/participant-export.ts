/**
 * Listado de participantes para descargar en Excel: qué columnas lleva, cómo se
 * filtra y cómo se nombra el archivo. Vive aparte de la ruta para poder
 * probarlo sin pasar por la autenticación del panel.
 */
import type { XlsxCell } from "./xlsx";

export const EXPORT_FIELDS = "id,user_id,modality,name,email,phone,gender,attendee_type,profession,license,institution,country,department,status,professional_network_opt_in,event_roles,attendance_verified_at,attendance_verification_method,created_at";

export type Registration = {
  id: number;
  user_id: string | null;
  modality: string;
  name: string;
  email: string;
  phone: string;
  gender: string | null;
  attendee_type: string;
  profession: string | null;
  license: string | null;
  institution: string | null;
  country: string;
  department: string | null;
  status: string;
  professional_network_opt_in: boolean;
  event_roles: string[] | null;
  attendance_verified_at: string | null;
  attendance_verification_method: string | null;
  created_at: string;
};

export type Certificate = { user_id: string; certificate_number: string | null; certificate_type: string | null; issued_at: string | null };

export type ExportFilters = {
  profile: string;
  profession: string;
  modality: string;
  status: string;
  attendance: string;
  license: string;
  role: string;
};

const MODALITY_LABELS: Record<string, string> = { presencial: "Presencial", virtual: "Virtual" };
const STATUS_LABELS: Record<string, string> = { confirmed: "Confirmada", waitlist: "Lista de espera", cancelled: "Cancelada" };
const PROFILE_LABELS: Record<string, string> = { professional: "Profesional", student: "Estudiante", general: "General" };
const ROLE_LABELS: Record<string, string> = { speaker: "Ponente", organizer: "Organización" };
const CERTIFICATE_LABELS: Record<string, string> = { professional: "Participación profesional", general: "Participación", speaker: "Reconocimiento a ponente", organizer: "Reconocimiento al equipo organizador" };
const METHOD_LABELS: Record<string, string> = { kiosk: "Kiosko", self: "Autoconfirmación", organizer: "Organización", admin: "Panel" };

export function readFilters(url: URL): ExportFilters {
  const value = (key: string) => (url.searchParams.get(key) ?? "all").trim();
  return {
    profile: value("profile"),
    profession: (url.searchParams.get("profession") ?? "").trim(),
    modality: value("modality"),
    status: value("status"),
    attendance: value("attendance"),
    license: value("license"),
    role: value("role"),
  };
}

export function matches(registration: Registration, filters: ExportFilters) {
  const hasLicense = Boolean(String(registration.license ?? "").trim());
  const attended = Boolean(registration.attendance_verified_at);
  const roles = registration.event_roles ?? [];
  if (filters.profile !== "all" && registration.attendee_type !== filters.profile) return false;
  if (filters.profession && String(registration.profession ?? "").trim() !== filters.profession) return false;
  if (filters.modality !== "all" && registration.modality !== filters.modality) return false;
  if (filters.status !== "all" && registration.status !== filters.status) return false;
  if (filters.attendance === "verified" && !attended) return false;
  if (filters.attendance === "pending" && attended) return false;
  if (filters.license === "with" && !hasLicense) return false;
  if (filters.license === "without" && hasLicense) return false;
  if (filters.role !== "all" && !roles.includes(filters.role)) return false;
  return true;
}

function dateTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "short", timeStyle: "short", timeZone: "America/Guatemala" }).format(new Date(value));
}

export const EXPORT_COLUMNS = [
  { header: "No.", width: 7 },
  { header: "Nombre", width: 32 },
  { header: "Correo", width: 30 },
  { header: "Teléfono", width: 14 },
  { header: "Género", width: 10 },
  { header: "Modalidad", width: 12 },
  { header: "Estado", width: 15 },
  { header: "Perfil", width: 13 },
  { header: "Profesión", width: 20 },
  { header: "No. de colegiado", width: 16 },
  { header: "Institución", width: 28 },
  { header: "Departamento", width: 18 },
  { header: "País", width: 14 },
  { header: "Función en la actividad", width: 20 },
  { header: "Asistió", width: 9 },
  { header: "Fecha de asistencia", width: 18 },
  { header: "Forma de verificación", width: 18 },
  { header: "Diploma emitido", width: 15 },
  { header: "No. de diploma", width: 16 },
  { header: "Tipo de diploma", width: 28 },
  { header: "Red profesional", width: 14 },
  { header: "Fecha de inscripción", width: 18 },
];

export function rowFor(registration: Registration, certificate: Certificate | undefined): XlsxCell[] {
  const roles = (registration.event_roles ?? []).map(role => ROLE_LABELS[role] ?? role).join(" · ");
  return [
    registration.id,
    registration.name,
    registration.email,
    registration.phone,
    registration.gender ?? "",
    MODALITY_LABELS[registration.modality] ?? registration.modality,
    STATUS_LABELS[registration.status] ?? registration.status,
    PROFILE_LABELS[registration.attendee_type] ?? registration.attendee_type,
    registration.profession ?? "",
    registration.license ?? "",
    registration.institution ?? "",
    registration.department ?? "",
    registration.country,
    roles || "Participante",
    registration.attendance_verified_at ? "Sí" : "No",
    dateTime(registration.attendance_verified_at),
    registration.attendance_verification_method ? METHOD_LABELS[registration.attendance_verification_method] ?? registration.attendance_verification_method : "",
    certificate?.issued_at ? "Sí" : "No",
    certificate?.certificate_number ?? "",
    certificate?.certificate_type ? CERTIFICATE_LABELS[certificate.certificate_type] ?? certificate.certificate_type : "",
    registration.professional_network_opt_in ? "Sí" : "No",
    dateTime(registration.created_at),
  ];
}

/** Resumen corto de los filtros, para el nombre del archivo. */
export function fileNameFor(filters: ExportFilters) {
  const parts = ["inscritos"];
  if (filters.profession) parts.push(filters.profession);
  if (filters.profile !== "all") parts.push(PROFILE_LABELS[filters.profile] ?? filters.profile);
  if (filters.modality !== "all") parts.push(MODALITY_LABELS[filters.modality] ?? filters.modality);
  if (filters.status !== "all") parts.push(STATUS_LABELS[filters.status] ?? filters.status);
  if (filters.attendance === "verified") parts.push("asistieron");
  if (filters.attendance === "pending") parts.push("sin asistencia");
  if (filters.license === "with") parts.push("con colegiado");
  if (filters.license === "without") parts.push("sin colegiado");
  if (filters.role !== "all") parts.push(ROLE_LABELS[filters.role] ?? filters.role);
  const slug = parts.join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

