"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Descarga en Excel el listado de inscritos con los filtros que se elijan.
 * El conteo lo calcula el mismo endpoint que arma el archivo, así lo que se ve
 * antes de descargar es exactamente lo que va a salir.
 */

type Filters = {
  profile: string;
  profession: string;
  modality: string;
  status: string;
  attendance: string;
  license: string;
  role: string;
};

const EMPTY: Filters = { profile: "all", profession: "", modality: "all", status: "all", attendance: "all", license: "all", role: "all" };

const CHOICES: Array<{ key: keyof Filters; label: string; options: Array<{ value: string; label: string }> }> = [
  { key: "profile", label: "Perfil", options: [{ value: "all", label: "Todos" }, { value: "professional", label: "Profesional" }, { value: "student", label: "Estudiante" }, { value: "general", label: "General" }] },
  { key: "attendance", label: "Asistencia", options: [{ value: "all", label: "Todos" }, { value: "verified", label: "Solo quienes asistieron" }, { value: "pending", label: "Solo quienes no asistieron" }] },
  { key: "license", label: "Número de colegiado", options: [{ value: "all", label: "Todos" }, { value: "with", label: "Solo con número" }, { value: "without", label: "Solo sin número" }] },
  { key: "modality", label: "Modalidad", options: [{ value: "all", label: "Todas" }, { value: "presencial", label: "Presencial" }, { value: "virtual", label: "Virtual" }] },
  { key: "status", label: "Estado de la inscripción", options: [{ value: "all", label: "Todos" }, { value: "confirmed", label: "Confirmada" }, { value: "waitlist", label: "Lista de espera" }, { value: "cancelled", label: "Cancelada" }] },
  { key: "role", label: "Función en la actividad", options: [{ value: "all", label: "Todas" }, { value: "speaker", label: "Ponentes" }, { value: "organizer", label: "Equipo organizador" }] },
];

function query(filters: Filters) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) search.set(key, value);
  return search.toString();
}

export default function ParticipantExport() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [professions, setProfessions] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  // Cada conteo lleva su número: si se cambia un filtro mientras el anterior
  // sigue en camino, la respuesta que llega tarde se descarta y el número que
  // se ve siempre corresponde a los filtros elegidos.
  const lastRequest = useRef(0);

  const refresh = useCallback(async (current: Filters) => {
    const request = lastRequest.current + 1;
    lastRequest.current = request;
    setCounting(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/registrations/export?preview=1&${query(current)}`, { cache: "no-store" });
      if (request !== lastRequest.current) return;
      if (!response.ok) { setError("No se pudo calcular el listado. Intenta de nuevo."); return; }
      const result = await response.json() as { count: number; total: number; professions: string[] };
      if (request !== lastRequest.current) return;
      setCount(result.count);
      setTotal(result.total);
      setProfessions(result.professions);
    } catch {
      if (request === lastRequest.current) setError("No se pudo calcular el listado. Comprueba tu conexión.");
    } finally {
      if (request === lastRequest.current) setCounting(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(filters), 250);
    return () => window.clearTimeout(timer);
  }, [filters, refresh]);

  async function download() {
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/registrations/export?${query(filters)}`, { cache: "no-store" });
      if (!response.ok) { setError("No se pudo generar el archivo. Intenta de nuevo."); return; }
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "inscritos.xlsx";
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("No se pudo generar el archivo. Comprueba tu conexión.");
    } finally {
      setDownloading(false);
    }
  }

  const filtered = count !== null && total !== null && count !== total;

  return <section className="panel control-group participant-export">
    <div className="panel-title"><h3>Listado de participantes</h3><span>{counting ? "Contando…" : `${count ?? 0} personas`}</span></div>
    <p className="admin-note">Elige lo que necesites y descárgalo en Excel. Cada archivo trae los datos de contacto, el perfil, el número de colegiado, la asistencia y el diploma de cada persona.</p>

    <div className="export-filters">
      {CHOICES.map(choice => <label key={choice.key}>
        {choice.label}
        <select value={filters[choice.key]} onChange={event => setFilters({ ...filters, [choice.key]: event.target.value })}>
          {choice.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>)}
      <label>
        Profesión
        <select value={filters.profession} onChange={event => setFilters({ ...filters, profession: event.target.value })}>
          <option value="">Todas</option>
          {professions.map(profession => <option key={profession} value={profession}>{profession}</option>)}
        </select>
      </label>
    </div>

    <div className="export-actions">
      <div className="export-count">
        <b>{count ?? 0}</b>
        <span>{filtered ? `de ${total} inscritos cumplen los filtros` : "inscritos en total"}</span>
      </div>
      <div className="export-buttons">
        {filtered && <button type="button" className="secondary" onClick={() => setFilters(EMPTY)}>Quitar filtros</button>}
        <button type="button" className="admin-save" disabled={downloading || counting || !count} onClick={() => void download()}>
          {downloading ? "Preparando el archivo…" : "Descargar en Excel"}
        </button>
      </div>
    </div>
    {error && <p className="certificate-preview-error" role="alert">{error}</p>}
  </section>;
}
