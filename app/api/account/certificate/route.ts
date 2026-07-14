import { currentUser } from "../../../../lib/auth";
import { supabaseServerFetch } from "../../../../lib/supabase-server";
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  const [profileResponse, certResponse] = await Promise.all([
    supabaseServerFetch(`encuentro_psicologico_profiles?select=full_name&user_id=eq.${user.id}&limit=1`),
    supabaseServerFetch(`encuentro_psicologico_certificates?select=certificate_number,attendance_confirmed&user_id=eq.${user.id}&limit=1`),
  ]);
  const [profile] = await profileResponse.json() as Array<{ full_name:string }>;
  const [cert] = await certResponse.json() as Array<{ certificate_number?:string; attendance_confirmed:boolean }>;
  if (!cert?.attendance_confirmed) return new Response("La constancia aún no está disponible.", { status: 403 });
  const safeName = profile.full_name.replace(/[<>&"]/g, "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Constancia</title><style>body{font-family:Georgia,serif;background:#101a34;color:#fff;display:grid;place-items:center;height:100vh;margin:0}.c{width:900px;padding:80px;border:2px solid #d7ad4b;text-align:center;background:#162744}.c h1{font-size:54px;color:#efc75e}.c h2{font-size:42px}.c p{font:20px Arial;line-height:1.6}.n{margin-top:60px;color:#efc75e}@media print{body{background:#fff}.c{break-inside:avoid}}</style></head><body><div class="c"><p>ENCUENTRO CLÍNICO DE PSICOLOGÍA</p><h1>Constancia de participación</h1><p>Se otorga la presente a</p><h2>${safeName}</h2><p>por su participación en “Cuando el Duelo se Detiene: Jornada Clínica sobre Duelo Prolongado”, realizada el 15 de agosto de 2026.</p><p class="n">No. ${cert.certificate_number ?? user.id.slice(0,8).toUpperCase()}</p><script>window.print()</script></div></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": "inline; filename=constancia.html" } });
}
