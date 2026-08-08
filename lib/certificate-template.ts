export type CertificateSignature = { name?: string; role?: string; image_url?: string };
const MAX_SPONSOR_LOGOS = 3;
export type CertificateSettings = {
  event_name?: string;
  event_date?: string;
  event_place?: string;
  professional_title?: string;
  general_title?: string;
  professional_body?: string;
  general_body?: string;
  signatures?: CertificateSignature[];
  sponsor_logos?: string[];
};

export const DEFAULT_CERTIFICATE_SETTINGS: Required<CertificateSettings> = {
  event_name: "Cuando el Duelo se Detiene: Jornada Clínica sobre Duelo Prolongado",
  event_date: "15 de agosto de 2026",
  event_place: "Chimaltenango, Guatemala",
  professional_title: "Diploma de participación profesional",
  general_title: "Diploma de participación",
  professional_body: "Por su valiosa participación y actualización profesional en la jornada clínica.",
  general_body: "Por su valiosa participación en la jornada clínica.",
  signatures: [{ name: "", role: "", image_url: "" }, { name: "", role: "", image_url: "" }],
  sponsor_logos: [],
};

function cleanString(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

export function normalizeCertificateSettings(value: unknown): Required<CertificateSettings> {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const signatureInput = Array.isArray(source.signatures) ? source.signatures.slice(0, 2) : [];
  const signatures = [0, 1].map(index => {
    const item = signatureInput[index] && typeof signatureInput[index] === "object" ? signatureInput[index] as Record<string, unknown> : {};
    return { name: cleanString(item.name, 100), role: cleanString(item.role, 100), image_url: cleanString(item.image_url, 800) };
  });
  return {
    event_name: cleanString(source.event_name, 220) || DEFAULT_CERTIFICATE_SETTINGS.event_name,
    event_date: cleanString(source.event_date, 120) || DEFAULT_CERTIFICATE_SETTINGS.event_date,
    event_place: cleanString(source.event_place, 160) || DEFAULT_CERTIFICATE_SETTINGS.event_place,
    professional_title: cleanString(source.professional_title, 160) || DEFAULT_CERTIFICATE_SETTINGS.professional_title,
    general_title: cleanString(source.general_title, 160) || DEFAULT_CERTIFICATE_SETTINGS.general_title,
    professional_body: cleanString(source.professional_body, 700) || DEFAULT_CERTIFICATE_SETTINGS.professional_body,
    general_body: cleanString(source.general_body, 700) || DEFAULT_CERTIFICATE_SETTINGS.general_body,
    signatures,
    sponsor_logos: Array.isArray(source.sponsor_logos) ? source.sponsor_logos.map(item => cleanString(item, 800)).filter(Boolean).slice(0, MAX_SPONSOR_LOGOS) : [],
  };
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[<>&"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[character] ?? character);
}

export function buildCertificateHtml({
  settings,
  type,
  fullName,
  certificateNumber,
  autoPrint = false,
}: {
  settings: CertificateSettings;
  type: "professional" | "general";
  fullName: string;
  certificateNumber: string;
  autoPrint?: boolean;
}) {
  const template = normalizeCertificateSettings(settings);
  const title = type === "professional" ? template.professional_title : template.general_title;
  const body = type === "professional" ? template.professional_body : template.general_body;
  const signatures = template.signatures.slice(0, 2);
  const logos = template.sponsor_logos.slice(0, MAX_SPONSOR_LOGOS);
  const signatureHtml = signatures.map(signature => `<div class="signature">${signature.image_url ? `<img src="${escapeHtml(signature.image_url)}" alt="Firma de ${escapeHtml(signature.name || "representante")}" />` : ""}<div class="line"></div><b>${escapeHtml(signature.name)}</b><small>${escapeHtml(signature.role)}</small></div>`).join("");
  const logosHtml = logos.length ? `<div class="logos">${logos.map(url => `<img src="${escapeHtml(url)}" alt="Logo de institución participante" />`).join("")}</div>` : "";

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
@page{size:letter landscape;margin:0}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#f6f1e7;color:#17284a;font-family:Arial,sans-serif}
.diploma{min-height:100vh;padding:clamp(12px,3vw,34px);display:grid;place-items:center;background:radial-gradient(circle at 92% 8%,rgba(111,82,162,.18),transparent 27%),radial-gradient(circle at 8% 90%,rgba(215,169,109,.2),transparent 26%),#f6f1e7}
.frame{width:min(1120px,94vw);aspect-ratio:11/8.5;padding:clamp(26px,4vw,48px) clamp(34px,6vw,68px);border:2px solid #d6aa67;outline:10px solid #17284a;outline-offset:-22px;text-align:center;background:linear-gradient(135deg,#fffdf8,#f7f0df);overflow:hidden;display:grid;grid-template-rows:auto 1fr auto}
.brand{display:flex;justify-content:center;align-items:center;gap:12px;color:#8b6417}.brand img{width:54px;height:54px;object-fit:contain}.brand p{margin:0;font-size:11px;font-weight:700;letter-spacing:.21em}.brand span{display:block;margin-top:4px;font:italic 12px Georgia,serif;color:#65527d}
.certificate-core{align-self:center}.event{font:700 clamp(14px,1.65vw,19px) Georgia,serif;color:#17284a;margin:0 0 12px}.title{font:clamp(30px,4.3vw,48px) Georgia,serif;color:#17284a;margin:0}.lead{font-size:clamp(13px,1.5vw,17px);line-height:1.55;margin:clamp(14px,2.3vw,25px) auto 6px;max-width:760px;color:#4c5b74}.name{font:italic clamp(28px,3.8vw,42px) Georgia,serif;color:#b6802d;margin:clamp(11px,1.8vw,20px) auto;border-bottom:1px solid #d6aa67;padding:0 20px 10px;max-width:850px}.meta{font-size:clamp(12px,1.3vw,15px);color:#526078;margin:17px 0 0}.number{font-size:10px;letter-spacing:.13em;color:#8b6417;margin:8px 0 0}
.certificate-footer{align-self:end}.signatures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(36px,7vw,78px);margin:14px auto 12px;width:min(800px,86%)}.signature{min-height:88px;display:flex;flex-direction:column;justify-content:flex-end}.signature img{height:52px;max-width:190px;object-fit:contain;margin:0 auto -4px}.signature .line{border-top:1px solid #253555;margin-top:8px}.signature b{font-size:13px;margin-top:8px;color:#17284a}.signature small{font-size:10px;color:#655e73;margin-top:4px}.logos{display:flex;justify-content:center;align-items:center;gap:18px;min-height:52px}.logos img{width:118px;height:42px;object-fit:contain;filter:saturate(.9)}
@media(max-width:640px){.diploma{padding:8px}.frame{outline-width:6px;outline-offset:-14px;padding:22px 26px}.brand img{width:40px;height:40px}.brand p{font-size:8px}.event{font-size:14px}.title{font-size:28px}.signatures{gap:24px;width:92%}.signature{min-height:62px}.signature img{height:36px}.signature b{font-size:10px}.signature small{font-size:8px}.logos{gap:8px}.logos img{width:74px;height:27px}}
@media print{html,body{width:11in;height:8.5in;background:#fff}.diploma{width:11in;height:8.5in;min-height:0;padding:.22in;background:#fff}.frame{width:100%;height:100%;aspect-ratio:auto;padding:.36in .58in;outline-offset:-.17in}.brand img{width:.44in;height:.44in}.brand p{font-size:10px}.brand span{font-size:10px}.event{font-size:16px}.title{font-size:38px}.lead{font-size:14px;margin-top:.15in}.name{font-size:34px;margin:.11in auto}.meta{font-size:12px;margin-top:.1in}.signatures{margin:.12in auto .08in}.signature{min-height:.7in}.signature img{height:.42in}.signature b{font-size:11px}.signature small{font-size:9px}.logos{min-height:.38in;gap:.16in}.logos img{width:1.22in;height:.4in}}
</style></head><body><main class="diploma"><section class="frame"><header class="brand"><img src="/logo-duelo-arbol-morado.png" alt="Logo del Encuentro Clínico de Psicología" /><div><p>ENCUENTRO CLÍNICO DE PSICOLOGÍA</p><span>Cuando el Duelo se Detiene</span></div></header><section class="certificate-core"><p class="event">${escapeHtml(template.event_name)}</p><h1 class="title">${escapeHtml(title)}</h1><p class="lead">Se otorga el presente diploma a</p><h2 class="name">${escapeHtml(fullName)}</h2><p class="lead">${escapeHtml(body)}</p><p class="meta">${escapeHtml(template.event_date)} · ${escapeHtml(template.event_place)}</p><p class="number">No. ${escapeHtml(certificateNumber)}</p></section><footer class="certificate-footer"><div class="signatures">${signatureHtml}</div>${logosHtml}</footer></section></main>${autoPrint ? "<script>window.addEventListener('load',()=>window.print())</script>" : ""}</body></html>`;
}
