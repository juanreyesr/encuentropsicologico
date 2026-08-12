import { supabaseServerFetch } from "./supabase-server";

/**
 * Un solo lugar decide qué está abierto durante la jornada. La organización
 * enciende o suspende cada función desde el panel y tanto las páginas como las
 * API leen exactamente el mismo estado.
 */
export type MaterialsMode = "auto" | "open" | "closed";

export type EventControls = {
  attendanceEnabled: boolean;
  attendanceOrganizersOnly: boolean;
  kioskEnabled: boolean;
  selfCheckinEnabled: boolean;
  questionsEnabled: boolean;
  certificatesEnabled: boolean;
  materialsMode: MaterialsMode;
  libraryEnabled: boolean;
  organizerPreviewEnabled: boolean;
};

export const EVENT_CONTROL_COLUMNS = "attendance_verification_enabled,attendance_verification_organizers_only,attendance_kiosk_enabled,attendance_self_checkin_enabled,questions_enabled,certificates_enabled,materials_mode,library_enabled,organizer_preview_enabled";

export const DEFAULT_EVENT_CONTROLS: EventControls = {
  attendanceEnabled: false,
  attendanceOrganizersOnly: false,
  kioskEnabled: true,
  selfCheckinEnabled: true,
  questionsEnabled: false,
  certificatesEnabled: true,
  materialsMode: "auto",
  libraryEnabled: true,
  organizerPreviewEnabled: true,
};

type SettingsRow = Record<string, unknown>;

function flag(row: SettingsRow, column: string, fallback: boolean) {
  return typeof row[column] === "boolean" ? row[column] as boolean : fallback;
}

export function normalizeEventControls(row: SettingsRow | null | undefined): EventControls {
  const source = row ?? {};
  const mode = source.materials_mode;
  return {
    attendanceEnabled: flag(source, "attendance_verification_enabled", DEFAULT_EVENT_CONTROLS.attendanceEnabled),
    attendanceOrganizersOnly: flag(source, "attendance_verification_organizers_only", DEFAULT_EVENT_CONTROLS.attendanceOrganizersOnly),
    kioskEnabled: flag(source, "attendance_kiosk_enabled", DEFAULT_EVENT_CONTROLS.kioskEnabled),
    selfCheckinEnabled: flag(source, "attendance_self_checkin_enabled", DEFAULT_EVENT_CONTROLS.selfCheckinEnabled),
    questionsEnabled: flag(source, "questions_enabled", DEFAULT_EVENT_CONTROLS.questionsEnabled),
    certificatesEnabled: flag(source, "certificates_enabled", DEFAULT_EVENT_CONTROLS.certificatesEnabled),
    materialsMode: mode === "open" || mode === "closed" ? mode : "auto",
    libraryEnabled: flag(source, "library_enabled", DEFAULT_EVENT_CONTROLS.libraryEnabled),
    organizerPreviewEnabled: flag(source, "organizer_preview_enabled", DEFAULT_EVENT_CONTROLS.organizerPreviewEnabled),
  };
}

export async function loadEventControls(): Promise<EventControls> {
  const response = await supabaseServerFetch(`encuentro_psicologico_event_settings?select=${EVENT_CONTROL_COLUMNS}&id=eq.true&limit=1`);
  if (!response.ok) return { ...DEFAULT_EVENT_CONTROLS };
  const [row] = await response.json() as SettingsRow[];
  return normalizeEventControls(row);
}

export function controlsToColumns(controls: Partial<EventControls>): Record<string, unknown> {
  const columns: Record<string, unknown> = {};
  if (typeof controls.attendanceEnabled === "boolean") columns.attendance_verification_enabled = controls.attendanceEnabled;
  if (typeof controls.attendanceOrganizersOnly === "boolean") columns.attendance_verification_organizers_only = controls.attendanceOrganizersOnly;
  if (typeof controls.kioskEnabled === "boolean") columns.attendance_kiosk_enabled = controls.kioskEnabled;
  if (typeof controls.selfCheckinEnabled === "boolean") columns.attendance_self_checkin_enabled = controls.selfCheckinEnabled;
  if (typeof controls.questionsEnabled === "boolean") columns.questions_enabled = controls.questionsEnabled;
  if (typeof controls.certificatesEnabled === "boolean") columns.certificates_enabled = controls.certificatesEnabled;
  if (controls.materialsMode === "auto" || controls.materialsMode === "open" || controls.materialsMode === "closed") columns.materials_mode = controls.materialsMode;
  if (typeof controls.libraryEnabled === "boolean") columns.library_enabled = controls.libraryEnabled;
  if (typeof controls.organizerPreviewEnabled === "boolean") columns.organizer_preview_enabled = controls.organizerPreviewEnabled;
  return columns;
}

/**
 * Estado de un módulo para una cuenta concreta: `enabled` cuando puede usarse y
 * `preview` cuando el equipo organizador debe verlo, aún cerrado, para conocer
 * de antemano lo que tendrá disponible.
 */
export type ModuleState = { enabled: boolean; preview: boolean };

function moduleState(enabled: boolean, isOrganizer: boolean, controls: EventControls): ModuleState {
  return { enabled, preview: !enabled && isOrganizer && controls.organizerPreviewEnabled };
}

export function accountModules(controls: EventControls, isOrganizer: boolean) {
  const attendance = controls.attendanceEnabled && (!controls.attendanceOrganizersOnly || isOrganizer);
  return {
    attendance: moduleState(attendance, isOrganizer, controls),
    kiosk: moduleState(attendance && controls.kioskEnabled && isOrganizer, isOrganizer, controls),
    selfCheckin: moduleState(attendance && controls.selfCheckinEnabled, isOrganizer, controls),
    questions: moduleState(controls.questionsEnabled, isOrganizer, controls),
    certificates: moduleState(controls.certificatesEnabled, isOrganizer, controls),
    materials: moduleState(controls.materialsMode !== "closed", isOrganizer, controls),
    library: moduleState(controls.libraryEnabled, isOrganizer, controls),
  };
}

export async function isEventOrganizer(userId: string) {
  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=id&user_id=eq.${encodeURIComponent(userId)}&event_roles=cs.%7Borganizer%7D&status=eq.confirmed&limit=1`);
  if (!response.ok) return false;
  return (await response.json() as unknown[]).length > 0;
}
