import { isEventAdmin } from "../../../../../lib/admin";
import { EXPORT_COLUMNS, EXPORT_FIELDS, fileNameFor, matches, readFilters, rowFor, type Certificate, type Registration } from "../../../../../lib/participant-export";
import { supabaseServerFetch } from "../../../../../lib/supabase-server";
import { buildXlsx } from "../../../../../lib/xlsx";

/**
 * Descarga en Excel el listado de inscritos con los filtros que se elijan en el
 * centro de control. El mismo endpoint responde el conteo (`preview=1`) para
 * que el panel muestre cuántas personas saldrán antes de descargar, sin repetir
 * la lógica de filtrado en dos lugares.
 */
export async function GET(request: Request) {
  if (!await isEventAdmin()) return Response.json({ error: "No autorizado" }, { status: 401 });
  const url = new URL(request.url);
  const filters = readFilters(url);

  const response = await supabaseServerFetch(`encuentro_psicologico_registrations?select=${EXPORT_FIELDS}&order=name.asc`);
  if (!response.ok) return Response.json({ error: "No se pudo leer el listado de inscritos." }, { status: 503 });
  const registrations = await response.json() as Registration[];
  const selected = registrations.filter(registration => matches(registration, filters));

  if (url.searchParams.get("preview") === "1") {
    // Las profesiones salen de los datos reales, para poder elegirlas sin
    // escribirlas a mano ni adivinar cómo quedaron escritas.
    const professions = [...new Set(registrations.map(item => String(item.profession ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    return Response.json({ count: selected.length, total: registrations.length, professions });
  }

  const certificates = new Map<string, Certificate>();
  const certificatesResponse = await supabaseServerFetch("encuentro_psicologico_certificates?select=user_id,certificate_number,certificate_type,issued_at");
  if (certificatesResponse.ok) {
    for (const certificate of await certificatesResponse.json() as Certificate[]) certificates.set(certificate.user_id, certificate);
  }

  const file = await buildXlsx({
    sheetName: "Inscritos",
    columns: EXPORT_COLUMNS,
    rows: selected.map(registration => rowFor(registration, registration.user_id ? certificates.get(registration.user_id) : undefined)),
  });

  return new Response(file as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileNameFor(filters)}"`,
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}
