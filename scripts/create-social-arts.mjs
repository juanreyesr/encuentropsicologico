import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const background = readFileSync(`${root}public/social-background-vertical.png`).toString("base64");
const qr = readFileSync("/private/tmp/encuentro-inscripcion-qr.png").toString("base64");
const output = `${root}public/artes-redes`;
mkdirSync(output, { recursive: true });

const designs = [
  { slug: "facebook", width: 1200, height: 630, format: "horizontal" },
  { slug: "instagram", width: 1080, height: 1350, format: "vertical" },
  { slug: "instagram-cuadrado", width: 1080, height: 1080, format: "instagram-square" },
  { slug: "tiktok", width: 1080, height: 1920, format: "story" },
  { slug: "whatsapp", width: 1200, height: 1200, format: "square" },
];

const sharedDefs = (width, height) => `<defs>
  <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#080c2d" stop-opacity=".86"/>
    <stop offset=".48" stop-color="#11113f" stop-opacity=".52"/>
    <stop offset="1" stop-color="#080822" stop-opacity=".9"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
    <stop stop-color="#f2d391"/>
    <stop offset="1" stop-color="#d59b48"/>
  </linearGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
  <clipPath id="frame"><rect width="${width}" height="${height}" rx="${height < 700 ? 0 : 22}"/></clipPath>
</defs>`;

const base = (width, height) => `<g clip-path="url(#frame)">
  <image href="data:image/png;base64,${background}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
  <rect width="${width}" height="${height}" fill="url(#shade)"/>
  <circle cx="${width * 0.83}" cy="${height * 0.23}" r="${height * 0.2}" fill="#8a62d5" opacity=".13" filter="url(#soft)"/>
</g>`;

const qrBlock = ({ x, y, size, captionSize = 15 }) => `<g transform="translate(${x},${y})">
  <rect x="-18" y="-18" width="${size + 36}" height="${size + 62}" rx="12" fill="#fffaf0"/>
  <image href="data:image/png;base64,${qr}" width="${size}" height="${size}"/>
  <text x="${size / 2}" y="${size + 30}" text-anchor="middle" fill="#172143" font-family="Arial,Helvetica,sans-serif" font-size="${captionSize}" font-weight="800" letter-spacing="1">INSCRÍBETE GRATIS</text>
</g>`;

function horizontalArt(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${sharedDefs(width, height)}
  ${base(width, height)}
  <rect x="38" y="38" width="1124" height="554" rx="18" fill="#080b2b" opacity=".32" stroke="#e1b867" stroke-opacity=".28"/>

  <text x="66" y="80" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" letter-spacing="4">ENCUENTRO CLÍNICO DE PSICOLOGÍA</text>
  <text x="66" y="155" fill="#fffaf1" font-family="Georgia,serif" font-size="61">CUANDO EL DUELO</text>
  <text x="66" y="224" fill="url(#gold)" font-family="Georgia,serif" font-size="61" font-style="italic">SE DETIENE</text>
  <text x="66" y="270" fill="#f0e4d7" font-family="Georgia,serif" font-size="24">Jornada Clínica sobre Duelo Prolongado</text>
  <line x1="66" y1="298" x2="635" y2="298" stroke="#d9a956" stroke-width="2"/>
  <text x="66" y="337" fill="#efc776" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="800" letter-spacing="2">15 DE AGOSTO 2026 · 8:30 A. M. – 12:00 M.</text>
  <text x="66" y="373" fill="#e6e2ed" font-family="Arial,Helvetica,sans-serif" font-size="19">Chimaltenango · Modalidad presencial y virtual</text>

  <rect x="66" y="415" width="575" height="122" rx="10" fill="#161943" opacity=".78" stroke="#b79be8" stroke-opacity=".35"/>
  <text x="88" y="449" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="800" letter-spacing="2">6 CONFERENCIAS CLÍNICAS</text>
  <text x="88" y="482" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="17">Diagnóstico · Atención primaria · Abordaje familiar</text>
  <text x="88" y="512" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="17">Síntomas físicos · Manejo psiquiátrico · Abordaje local</text>

  <text x="696" y="100" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" letter-spacing="3">TU INSCRIPCIÓN INCLUYE</text>
  <text x="696" y="146" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="20">✓ Acceso a la jornada</text>
  <text x="696" y="184" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="20">✓ Diploma de participación</text>
  <text x="696" y="222" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="20">✓ Materiales y recursos</text>
  <text x="696" y="274" fill="#cfc9de" font-family="Arial,Helvetica,sans-serif" font-size="16">Escanea el código y reserva tu lugar.</text>
  ${qrBlock({ x: 926, y: 344, size: 164, captionSize: 14 })}
  <text x="696" y="304" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700">encuentropsicologico.vercel.app</text>
</svg>`;
}

function instagramSquareArt(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${sharedDefs(width, height)}
  ${base(width, height)}
  <rect x="42" y="42" width="996" height="996" rx="24" fill="#080b2b" opacity=".3" stroke="#e1b867" stroke-opacity=".26"/>

  <text x="68" y="82" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="800" letter-spacing="4">ENCUENTRO CLÍNICO DE PSICOLOGÍA</text>
  <text x="68" y="150" fill="#fffaf1" font-family="Georgia,serif" font-size="61">CUANDO EL DUELO</text>
  <text x="68" y="216" fill="url(#gold)" font-family="Georgia,serif" font-size="61" font-style="italic">SE DETIENE</text>
  <text x="68" y="260" fill="#f0e4d7" font-family="Georgia,serif" font-size="24">Jornada Clínica sobre Duelo Prolongado</text>
  <line x1="68" y1="288" x2="1012" y2="288" stroke="#d9a956" stroke-width="2"/>

  <text x="68" y="329" fill="#efc776" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="800" letter-spacing="2">15 DE AGOSTO 2026</text>
  <text x="68" y="366" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="20" font-weight="700">8:30 A. M. – 12:00 M. · CHIMALTENANGO</text>
  <text x="68" y="400" fill="#d9d5e4" font-family="Arial,Helvetica,sans-serif" font-size="19">Modalidad presencial y virtual</text>

  <rect x="68" y="438" width="944" height="188" rx="14" fill="#171943" opacity=".82" stroke="#b79be8" stroke-opacity=".38"/>
  <text x="94" y="476" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="800" letter-spacing="3">6 CONFERENCIAS CLÍNICAS</text>
  <text x="94" y="518" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="18">Diagnóstico · Atención primaria · Abordaje familiar</text>
  <text x="94" y="554" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="18">Síntomas físicos · Manejo psiquiátrico · Abordaje local</text>
  <text x="94" y="594" fill="#c8c2d7" font-family="Arial,Helvetica,sans-serif" font-size="17">Una mirada clínica e integral al duelo prolongado.</text>

  <text x="68" y="674" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="800" letter-spacing="3">TU INSCRIPCIÓN GRATUITA INCLUYE</text>
  <text x="68" y="712" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="19">Acceso · Diploma de participación · Materiales</text>

  ${qrBlock({ x: 68, y: 784, size: 180, captionSize: 14 })}
  <text x="305" y="832" fill="#fffaf1" font-family="Georgia,serif" font-size="28">Reserva tu lugar</text>
  <text x="305" y="873" fill="#d7d2e1" font-family="Arial,Helvetica,sans-serif" font-size="18">Escanea el QR y elige tu modalidad.</text>
  <text x="305" y="912" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="700">encuentropsicologico.vercel.app</text>
</svg>`;
}

function verticalArt(width, height, format) {
  const story = format === "story";
  const square = format === "square";
  const titleTop = story ? 244 : square ? 130 : 135;
  const titleSize = story ? 82 : square ? 71 : 68;
  const infoTop = titleTop + (story ? 250 : 205);
  const programTop = infoTop + (story ? 175 : 145);
  const programHeight = story ? 280 : square ? 205 : 220;
  const includeTop = programTop + programHeight + (story ? 70 : 48);
  const qrSize = story ? 235 : square ? 205 : 205;
  const qrY = height - qrSize - (story ? 180 : 110);
  const contentLeft = story ? 82 : 72;
  const contentWidth = width - contentLeft * 2;
  const summaryFont = story ? 22 : square ? 19 : 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${sharedDefs(width, height)}
  ${base(width, height)}
  <rect x="${contentLeft - 24}" y="${story ? 150 : 54}" width="${contentWidth + 48}" height="${height - (story ? 260 : 108)}" rx="26" fill="#080b2b" opacity=".3" stroke="#e1b867" stroke-opacity=".25"/>

  <text x="${contentLeft}" y="${titleTop - 78}" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 23 : 20}" font-weight="800" letter-spacing="5">ENCUENTRO CLÍNICO DE PSICOLOGÍA</text>
  <text x="${contentLeft}" y="${titleTop}" fill="#fffaf1" font-family="Georgia,serif" font-size="${titleSize}">CUANDO EL DUELO</text>
  <text x="${contentLeft}" y="${titleTop + titleSize + 10}" fill="url(#gold)" font-family="Georgia,serif" font-size="${titleSize}" font-style="italic">SE DETIENE</text>
  <text x="${contentLeft}" y="${titleTop + titleSize + 67}" fill="#f0e4d7" font-family="Georgia,serif" font-size="${story ? 32 : 27}">Jornada Clínica sobre Duelo Prolongado</text>

  <line x1="${contentLeft}" y1="${infoTop - 36}" x2="${width - contentLeft}" y2="${infoTop - 36}" stroke="#d9a956" stroke-width="2"/>
  <text x="${contentLeft}" y="${infoTop}" fill="#efc776" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 29 : 23}" font-weight="800" letter-spacing="2">15 DE AGOSTO 2026</text>
  <text x="${contentLeft}" y="${infoTop + 44}" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 25 : 21}" font-weight="700">8:30 A. M. – 12:00 M. · CHIMALTENANGO</text>
  <text x="${contentLeft}" y="${infoTop + 82}" fill="#d9d5e4" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 23 : 20}">Modalidad presencial y virtual</text>

  <rect x="${contentLeft}" y="${programTop}" width="${contentWidth}" height="${programHeight}" rx="16" fill="#171943" opacity=".82" stroke="#b79be8" stroke-opacity=".38"/>
  <text x="${contentLeft + 28}" y="${programTop + 45}" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 23 : 20}" font-weight="800" letter-spacing="3">6 CONFERENCIAS CLÍNICAS</text>
  <text x="${contentLeft + 28}" y="${programTop + 91}" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="${summaryFont}">Diagnóstico · Atención primaria</text>
  <text x="${contentLeft + 28}" y="${programTop + 129}" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="${summaryFont}">Abordaje familiar · Síntomas físicos</text>
  <text x="${contentLeft + 28}" y="${programTop + 167}" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="${summaryFont}">Manejo psiquiátrico · Abordaje local</text>
${story ? `  <text x="${contentLeft + 28}" y="${programTop + 220}" fill="#c8c2d7" font-family="Arial,Helvetica,sans-serif" font-size="20">Una mirada clínica e integral al duelo prolongado.</text>` : ""}

  <text x="${contentLeft}" y="${includeTop}" fill="#e9c779" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 23 : 20}" font-weight="800" letter-spacing="3">TU INSCRIPCIÓN GRATUITA INCLUYE</text>
  <text x="${contentLeft}" y="${includeTop + 46}" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 24 : 20}">Acceso · Diploma de participación · Materiales</text>

  ${qrBlock({ x: contentLeft, y: qrY, size: qrSize, captionSize: story ? 17 : 15 })}
  <text x="${contentLeft + qrSize + 55}" y="${qrY + 58}" fill="#fffaf1" font-family="Georgia,serif" font-size="${story ? 31 : 25}">Reserva tu lugar</text>
  <text x="${contentLeft + qrSize + 55}" y="${qrY + 100}" fill="#d7d2e1" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 21 : 18}">Escanea el código QR</text>
  <text x="${contentLeft + qrSize + 55}" y="${qrY + 135}" fill="#d7d2e1" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 21 : 18}">y elige tu modalidad.</text>
  <text x="${story ? contentLeft : contentLeft + qrSize + 55}" y="${story ? height - 92 : qrY + 180}" fill="#fffaf1" font-family="Arial,Helvetica,sans-serif" font-size="${story ? 21 : 18}" font-weight="700">encuentropsicologico.vercel.app</text>
</svg>`;
}

for (const design of designs) {
  const svg = design.format === "horizontal"
    ? horizontalArt(design.width, design.height)
    : design.format === "instagram-square"
      ? instagramSquareArt(design.width, design.height)
    : verticalArt(design.width, design.height, design.format);
  writeFileSync(`${output}/${design.slug}.svg`, svg);
}
