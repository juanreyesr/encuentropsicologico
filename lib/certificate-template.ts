export type CertificateSignature = { name?: string; role?: string; image_url?: string };
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
    sponsor_logos: Array.isArray(source.sponsor_logos) ? source.sponsor_logos.map(item => cleanString(item, 800)).filter(Boolean).slice(0, 12) : [],
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
  const logos = template.sponsor_logos.slice(0, 12);
  const signatureHtml = signatures.map(signature => `<div class="signature">${signature.image_url ? `<img src="${escapeHtml(signature.image_url)}" alt="Firma de ${escapeHtml(signature.name || "representante")}" />` : ""}<div class="line"></div><b>${escapeHtml(signature.name)}</b><small>${escapeHtml(signature.role)}</small></div>`).join("");
  const logosHtml = logos.length ? `<div class="logos">${logos.map(url => `<img src="${escapeHtml(url)}" alt="Logo de institución participante" />`).join("")}</div>` : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
@page{size:letter landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#e9e4dc;color:#152342;font-family:Arial,sans-serif}.diploma{min-height:100vh;padding:clamp(12px,3vw,34px);display:grid;place-items:center;background:radial-gradient(circle at 92% 8%,rgba(216,174,76,.25),transparent 26%),radial-gradient(circle at 7% 88%,rgba(52,69,133,.22),transparent 29%),#f6f1e7}.frame{width:min(1120px,94vw);aspect-ratio:11/8.5;padding:clamp(28px,4.8vw,54px) clamp(34px,6vw,68px);border:2px solid #d8ad4a;outline:10px solid #162848;outline-offset:-22px;text-align:center;background:linear-gradient(135deg,#fffdf8,#f7f0df);position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:center}.eyebrow{letter-spacing:.22em;font-size:clamp(9px,1.1vw,12px);font-weight:700;color:#8b6417;margin:0 0 clamp(18px,3vw,34px)}.event{font:700 clamp(14px,1.7vw,19px) Georgia,serif;color:#17284a;margin:0 0 12px}.title{font:clamp(30px,4.3vw,48px) Georgia,serif;color:#14233f;margin:0}.lead{font-size:clamp(13px,1.5vw,17px);line-height:1.55;margin:clamp(16px,2.6vw,30px) auto 6px;max-width:760px;color:#3f4d66}.name{font:italic clamp(28px,3.8vw,42px) Georgia,serif;color:#a8751f;margin:clamp(12px,2vw,22px) auto;border-bottom:1px solid #d8ad4a;padding:0 20px 10px;max-width:850px}.meta{font-size:clamp(12px,1.3vw,15px);color:#526078;margin:18px 0 0}.number{font-size:10px;letter-spacing:.13em;color:#7c5c1d;margin-top:9px}.signatures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(30px,6vw,64px);margin:clamp(24px,4vw,42px) auto 16px;width:min(760px,85%)}.signature{min-height:82px;display:flex;flex-direction:column;justify-content:flex-end}.signature img{height:50px;max-width:180px;object-fit:contain;margin:0 auto -5px}.signature .line{border-top:1px solid #253555;margin-top:8px}.signature b{font-size:12px;margin-top:7px}.signature small{font-size:10px;color:#56637a;margin-top:3px}.logos{display:flex;justify-content:center;align-items:center;gap:14px;flex-wrap:wrap;margin-top:7px}.logos img{max-height:32px;max-width:100px;object-fit:contain;filter:saturate(.86)}
@media(max-width:640px){.diploma{padding:8px}.frame{outline-width:6px;outline-offset:-14px;padding:22px 26px}.signatures{margin-top:18px}.signature{min-height:58px}.signature img{height:34px}.logos img{max-height:24px;max-width:74px}}
@media print{html,body{width:11in;height:8.5in;background:#fff}.diploma{width:11in;height:8.5in;min-height:0;padding:.22in;background:#fff}.frame{width:100%;height:100%;aspect-ratio:auto;padding:.42in .58in;outline-offset:-.17in}.eyebrow{font-size:10px;margin-bottom:.18in}.event{font-size:16px}.title{font-size:38px}.lead{font-size:14px;margin-top:.17in}.name{font-size:34px;margin:.12in auto}.meta{font-size:12px;margin-top:.12in}.signatures{margin:.24in auto .1in}.signature{min-height:.68in}.signature img{height:.42in}.logos img{max-height:.28in}}
</style></head><body><main class="diploma"><section class="frame"><p class="eyebrow">ENCUENTRO CLÍNICO DE PSICOLOGÍA</p><p class="event">${escapeHtml(template.event_name)}</p><h1 class="title">${escapeHtml(title)}</h1><p class="lead">Se otorga el presente diploma a</p><h2 class="name">${escapeHtml(fullName)}</h2><p class="lead">${escapeHtml(body)}</p><p class="meta">${escapeHtml(template.event_date)} · ${escapeHtml(template.event_place)}</p><p class="number">No. ${escapeHtml(certificateNumber)}</p><div class="signatures">${signatureHtml}</div>${logosHtml}</section></main>${autoPrint ? "<script>window.addEventListener('load',()=>window.print())</script>" : ""}</body></html>`;
}
