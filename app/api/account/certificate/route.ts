import { currentUser } from "../../../../lib/auth";
import { buildCertificateHtml, type CertificateSettings } from "../../../../lib/certificate-template";
import { supabaseServerFetch } from "../../../../lib/supabase-server";

export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const [profileResponse, certResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_profiles?select=full_name,attendee_type&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_certificates?select=certificate_number,attendance_confirmed,certificate_type,template_snapshot&user_id=eq.${user.id}&limit=1`),
  ]);
  const [profile] = await profileResponse.json() as Array<{ full_name:string; attendee_type: string }>;
  const [cert] = await certResponse.json() as Array<{ certificate_number?:string; attendance_confirmed:boolean; certificate_type?: string; template_snapshot?: CertificateSettings }>;
  if (!cert?.attendance_confirmed || !profile) return new Response("El diploma aún no está disponible.", { status: 403 });
  const professional = cert.certificate_type === "professional" || profile.attendee_type === "professional";
  const html = buildCertificateHtml({
    settings: cert.template_snapshot ?? {},
    type: professional ? "professional" : "general",
    fullName: profile.full_name,
    certificateNumber: cert.certificate_number ?? user.id.slice(0, 8).toUpperCase(),
    autoPrint: true,
  });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline; filename=diploma-participacion.html", "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
