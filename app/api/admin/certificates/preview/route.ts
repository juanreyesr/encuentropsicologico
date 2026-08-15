import { isEventAdmin } from "../../../../../lib/admin";
import { buildCertificatePdf } from "../../../../../lib/certificate-pdf";
import { certificateType, normalizeCertificateSettings } from "../../../../../lib/certificate-template";

export async function POST(request: Request) {
  if (!await isEventAdmin()) return new Response("No autorizado", { status: 401 });
  const body = await request.json() as { settings?: unknown; type?: unknown; fullName?: unknown };
  const type = certificateType(body.type);
  const fullName = String(body.fullName ?? "María Fernanda López").trim().slice(0, 160) || "María Fernanda López";
  // La vista previa usa el mismo generador que la descarga, así lo que se
  // revisa aquí es exactamente el archivo que recibirá cada participante.
  try {
    const pdf = await buildCertificatePdf({
      settings: normalizeCertificateSettings(body.settings),
      type,
      fullName,
      certificateNumber: "VISTA-PREVIA",
      origin: new URL(request.url).origin,
    });
    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline; filename=\"vista-previa-diploma.pdf\"",
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch {
    return new Response("No se pudo generar la vista previa. Inténtalo de nuevo.", { status: 503 });
  }
}
