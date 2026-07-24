import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const background = readFileSync(`${root}public/social-background-vertical.png`).toString("base64");
const qr = readFileSync("/private/tmp/encuentro-inscripcion-qr.png").toString("base64");
const output = `${root}public/artes-redes`;
mkdirSync(output, { recursive: true });

const designs = [
  ["facebook", 1200, 630, "Facebook · 1200 × 630", 76],
  ["instagram", 1080, 1350, "Instagram · 1080 × 1350", 72],
  ["tiktok", 1080, 1920, "TikTok · 1080 × 1920", 72],
  ["whatsapp", 1200, 1200, "WhatsApp · 1200 × 1200", 76],
];

for (const [slug, width, height, label, heading] of designs) {
  const compact = height < 900;
  const qrSize = compact ? 170 : 210;
  const left = compact ? 70 : 76;
  const textTop = compact ? 82 : 120;
  const qrY = height - qrSize - (compact ? 48 : 86);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#090d2e" stop-opacity=".76"/><stop offset=".55" stop-color="#0d1038" stop-opacity=".34"/><stop offset="1" stop-color="#0c0a27" stop-opacity=".8"/></linearGradient></defs>
  <image href="data:image/png;base64,${background}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${width}" height="${height}" fill="url(#shade)"/>
  <text x="${left}" y="${textTop}" fill="#e4bf72" font-family="Arial,Helvetica,sans-serif" font-size="${compact ? 21 : 23}" font-weight="700" letter-spacing="5">ENCUENTRO CLÍNICO DE PSICOLOGÍA</text>
  <text x="${left}" y="${textTop + (compact ? 92 : 112)}" fill="#fffaf1" font-family="Georgia,serif" font-size="${heading}" font-weight="400">CUANDO EL</text>
  <text x="${left}" y="${textTop + (compact ? 174 : 202)}" fill="#e6b55f" font-family="Georgia,serif" font-size="${heading}" font-weight="400">DUELO SE DETIENE</text>
  <line x1="${left}" y1="${textTop + (compact ? 202 : 234)}" x2="${compact ? 650 : 700}" y2="${textTop + (compact ? 202 : 234)}" stroke="#d7aa59" stroke-width="2"/>
  <text x="${left}" y="${textTop + (compact ? 246 : 284)}" fill="#f0e3d3" font-family="Georgia,serif" font-size="${compact ? 25 : 29}">Jornada Clínica sobre Duelo Prolongado</text>
  <text x="${left}" y="${textTop + (compact ? 284 : 328)}" fill="#edc16e" font-family="Arial,Helvetica,sans-serif" font-size="${compact ? 21 : 24}" font-weight="700" letter-spacing="3">15 DE AGOSTO 2026 · CHIMALTENANGO</text>
  <text x="${left}" y="${textTop + (compact ? 324 : 375)}" fill="#dedceb" font-family="Arial,Helvetica,sans-serif" font-size="${compact ? 18 : 21}">Modalidad híbrida · Presencial y virtual</text>
  <g transform="translate(${width - qrSize - (compact ? 56 : 70)},${qrY})"><rect x="-16" y="-16" width="${qrSize + 32}" height="${qrSize + 50}" rx="8" fill="#fffaf0"/><image href="data:image/png;base64,${qr}" width="${qrSize}" height="${qrSize}"/><text x="${qrSize / 2}" y="${qrSize + 23}" text-anchor="middle" fill="#172143" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700">INSCRIPCIÓN GRATUITA</text></g>
  <text x="${left}" y="${height - (compact ? 52 : 86)}" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="${compact ? 17 : 20}" font-weight="700">encuentropsicologico.vercel.app</text>
  <text x="${left}" y="${height - (compact ? 26 : 52)}" fill="#c5c2d8" font-family="Arial,Helvetica,sans-serif" font-size="13">${label}</text>
</svg>`;
  const svgPath = `${output}/${slug}.svg`;
  writeFileSync(svgPath, svg);
}
