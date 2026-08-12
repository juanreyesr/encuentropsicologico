import { isEventAdmin } from "../../../../../lib/admin";
import { buildCertificateHtml, certificateType, normalizeCertificateSettings } from "../../../../../lib/certificate-template";

export async function POST(request: Request) {
  if (!await isEventAdmin()) return new Response("No autorizado", { status: 401 });
  const body = await request.json() as { settings?: unknown; type?: unknown; fullName?: unknown };
  const type = certificateType(body.type);
  const fullName = String(body.fullName ?? "María Fernanda López").trim().slice(0, 160) || "María Fernanda López";
  const html = buildCertificateHtml({
    settings: normalizeCertificateSettings(body.settings),
    type,
    fullName,
    certificateNumber: "VISTA-PREVIA",
  });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
