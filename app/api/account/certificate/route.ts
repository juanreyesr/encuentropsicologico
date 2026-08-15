import { currentUser } from "../../../../lib/auth";
import { buildCertificatePdf, certificateFileName } from "../../../../lib/certificate-pdf";
import { certificateType, type CertificateSettings } from "../../../../lib/certificate-template";
import { loadEventControls } from "../../../../lib/event-controls";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const [controls, profileResponse, certResponse] = await Promise.all([
    loadEventControls(),
    supabaseServerFetch(`encuentro_psicologico_profiles?select=full_name,attendee_type&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_certificates?select=certificate_number,attendance_confirmed,certificate_type,template_snapshot&user_id=eq.${user.id}&limit=1`),
  ]);
  if (!controls.certificatesEnabled) return new Response("La descarga de diplomas está suspendida por la organización.", { status: 403 });
  const [profile] = await profileResponse.json() as Array<{ full_name:string; attendee_type: string }>;
  const [cert] = await certResponse.json() as Array<{ certificate_number?:string; attendance_confirmed:boolean; certificate_type?: string; template_snapshot?: CertificateSettings }>;
  if (!cert?.attendance_confirmed || !profile) return new Response("El diploma aún no está disponible.", { status: 403 });
  const type = cert.certificate_type ? certificateType(cert.certificate_type) : (profile.attendee_type === "professional" ? "professional" : "general");
  const certificateNumber = cert.certificate_number ?? user.id.slice(0, 8).toUpperCase();
  // El diploma se entrega como PDF de tamaño carta: se descarga, se ve igual en
  // el teléfono que en la computadora y se imprime sin que nada se recorte.
  try {
    const pdf = await buildCertificatePdf({
      settings: cert.template_snapshot ?? {},
      type,
      fullName: profile.full_name,
      certificateNumber,
      origin: new URL(request.url).origin,
    });
    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${certificateFileName(profile.full_name, certificateNumber)}"`,
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
  } catch {
    return new Response("No se pudo preparar el diploma en este momento. Inténtalo de nuevo en unos minutos.", { status: 503 });
  }
}
