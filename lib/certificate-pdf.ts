/**
 * Dibuja el diploma en PDF, tamaño carta horizontal, con medidas fijas en
 * puntos. Al ser un documento y no una página web, el diploma se ve igual en el
 * teléfono, en la computadora y al imprimirlo: nada se acomoda al ancho de la
 * pantalla y los logos, las firmas y los sellos quedan siempre en su lugar.
 */
import { CENTER_SIGNATURE_INDEX, SIGNATURE_DISPLAY_ORDER, certificateType, normalizeCertificateSettings, type CertificateSettings, type CertificateType } from "./certificate-template";
import { PdfCanvas, PdfWriter, color, deflate, pdfNumber, type TextOptions } from "./pdf/document";
import { textWidth, type PdfFontName } from "./pdf/fonts";
import { readImage, type RasterImage } from "./pdf/images";

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const CENTER_X = PAGE_WIDTH / 2;
const FRAME_MARGIN = 15.84;
const FRAME_WIDTH = PAGE_WIDTH - FRAME_MARGIN * 2;
const FRAME_HEIGHT = PAGE_HEIGHT - FRAME_MARGIN * 2;
const OUTLINE_INSET = 12.24;
const OUTLINE_WIDTH = 7.5;
const PADDING_X = 41.76;
const PADDING_Y = 25.92;
const CONTENT_WIDTH = FRAME_WIDTH - PADDING_X * 2;
const CONTENT_TOP = FRAME_MARGIN + PADDING_Y;
const CONTENT_BOTTOM = FRAME_MARGIN + FRAME_HEIGHT - PADDING_Y;

const BRAND_LOGO_SIZE = 92.16;
const BRAND_GAP = 13.5;
const BRAND_URL = "/logo-duelo-arbol-morado.png";
const BRAND_TITLE = "ENCUENTRO CLÍNICO DE PSICOLOGÍA";
const BRAND_SUBTITLE = "Cuando el Duelo se Detiene";

/**
 * El diseño original mide varias piezas en `cqw`, el uno por ciento del ancho
 * interior del marco. Aquí se conserva esa misma unidad para que las columnas,
 * los sellos y los textos guarden las proporciones de siempre.
 */
const CQW = (FRAME_WIDTH - PADDING_X * 2 - 3) / 100;
const SIGNATURES_WIDTH = 75 * CQW;
const SIGNATURE_GAP = 7.5 * CQW;
const SIGNATURE_IMAGE_HEIGHT = 37.44;
const SIGNATURE_IMAGE_WIDTH = 20.5 * CQW;
const SIGNATURE_LINE_OFFSET = 0.63 * CQW;
const SIGNATURE_IMAGE_OVERLAP = 0.45 * CQW;
const SIGNATURE_NAME_GAP = 0.63 * CQW;
const SIGNATURE_ROLE_GAP = 0.27 * CQW;
const NAME_MAX_WIDTH = 75.9 * CQW;
const NAME_PADDING_X = 1.79 * CQW;
const NAME_PADDING_BOTTOM = 0.89 * CQW;
const LEAD_MAX_WIDTH = 67.9 * CQW;
const NUMBER_SIZE = 0.89 * CQW;
const NUMBER_GAP = 0.71 * CQW;
const SPONSOR_LOGO_WIDTH = 106.56;
const SPONSOR_LOGO_HEIGHT = 36;
const SPONSOR_LOGO_GAP = 12.96;
const FOOTER_MARGIN = 8.64;
const SEAL_RIGHT_WIDTH = 104.4;
const SEAL_LEFT_WIDTH = 68.4;

const INK = color("#17284a");
const GOLD_DARK = color("#8b6417");
const GOLD_BORDER = color("#d6aa67");
const GOLD_NAME = color("#b6802d");
const PURPLE = color("#65527d");
const LEAD = color("#4c5b74");
const META = color("#526078");
const SIGNATURE_LINE = color("#253555");
const ROLE = color("#655e73");
const PAPER_LIGHT = color("#fffdf8");
const PAPER_DARK = color("#f7f0df");

/** Proporción de la altura de la letra que queda sobre la línea base. */
const ASCENT = 0.76;
/** Los visores imprimen a 300 puntos por pulgada; nada más hace falta. */
const PIXELS_PER_POINT = 300 / 72;

type Signature = { name: string; role: string; image_url: string };

function baselineOf(top: number, lineHeight: number, size: number) {
  return top + (lineHeight - size) / 2 + size * ASCENT;
}

function breakLongWord(word: string, font: PdfFontName, size: number, maxWidth: number) {
  const pieces: string[] = [];
  let piece = "";
  for (const character of word) {
    if (piece && textWidth(piece + character, font, size) > maxWidth) { pieces.push(piece); piece = character; }
    else piece += character;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

function wrapText(text: string, font: PdfFontName, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, font, size) > maxWidth) {
      lines.push(line);
      line = "";
    }
    if (!line && textWidth(word, font, size) > maxWidth) {
      const pieces = breakLongWord(word, font, size, maxWidth);
      lines.push(...pieces.slice(0, -1));
      line = pieces[pieces.length - 1] ?? "";
      continue;
    }
    line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Busca el primer tamaño que entra en el número de líneas previsto. */
function fitText(text: string, font: PdfFontName, sizes: number[], maxWidth: number, maxLines: number) {
  let result = { size: sizes[0], lines: wrapText(text, font, sizes[0], maxWidth) };
  for (const size of sizes) {
    result = { size, lines: wrapText(text, font, size, maxWidth) };
    if (result.lines.length <= maxLines) break;
  }
  return result;
}

function containBox(image: RasterImage, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { width: image.width * scale, height: image.height * scale };
}

const imageCache = new Map<string, RasterImage | null>();

async function loadImage(url: string, origin: string, maxWidth: number, maxHeight: number) {
  if (!url) return null;
  const target = url.startsWith("/") ? `${origin}${url}` : url;
  const key = `${target}|${Math.round(maxWidth)}x${Math.round(maxHeight)}`;
  const cached = imageCache.get(key);
  if (cached !== undefined) return cached;
  let image: RasterImage | null = null;
  try {
    const response = await fetch(target, { signal: AbortSignal.timeout(12_000) });
    if (response.ok) {
      image = await readImage(new Uint8Array(await response.arrayBuffer()), maxWidth * PIXELS_PER_POINT, maxHeight * PIXELS_PER_POINT);
    }
  } catch {
    image = null;
  }
  // Solo se recuerdan los aciertos: un fallo de red no debe dejar el diploma
  // sin firma para todas las descargas siguientes.
  if (image) {
    if (imageCache.size > 40) imageCache.clear();
    imageCache.set(key, image);
  }
  return image;
}

/** Registra la imagen dentro del PDF y devuelve el nombre con el que se dibuja. */
async function registerImage(writer: PdfWriter, image: RasterImage, name: string, resources: Map<string, number>) {
  if (image.kind === "jpeg") {
    const id = writer.addStream(
      `/Type/XObject/Subtype/Image/Width ${image.width}/Height ${image.height}`
      + `/ColorSpace${image.components === 1 ? "/DeviceGray" : "/DeviceRGB"}/BitsPerComponent 8/Filter/DCTDecode`,
      image.data,
    );
    resources.set(name, id);
    return;
  }
  let mask = "";
  if (image.alpha) {
    const compressed = await deflate(image.alpha);
    const id = writer.addStream(
      `/Type/XObject/Subtype/Image/Width ${image.width}/Height ${image.height}`
      + `/ColorSpace/DeviceGray/BitsPerComponent 8${compressed.filter ? `/Filter${compressed.filter}` : ""}`,
      compressed.data,
    );
    mask = `/SMask ${id} 0 R`;
  }
  const compressed = await deflate(image.rgb);
  const id = writer.addStream(
    `/Type/XObject/Subtype/Image/Width ${image.width}/Height ${image.height}`
    + `/ColorSpace/DeviceRGB/BitsPerComponent 8${compressed.filter ? `/Filter${compressed.filter}` : ""}${mask}`,
    compressed.data,
  );
  resources.set(name, id);
}

export type CertificatePdfInput = {
  settings: CertificateSettings;
  type: CertificateType | string;
  fullName: string;
  certificateNumber: string;
  /** Origen del sitio, para poder leer el logo que vive en `public/`. */
  origin: string;
};

export async function buildCertificatePdf({ settings, type, fullName, certificateNumber, origin }: CertificatePdfInput) {
  const template = normalizeCertificateSettings(settings);
  const kind = certificateType(type);
  const title = { professional: template.professional_title, general: template.general_title, speaker: template.speaker_title, organizer: template.organizer_title }[kind];
  const body = { professional: template.professional_body, general: template.general_body, speaker: template.speaker_body, organizer: template.organizer_body }[kind];
  const name = String(fullName ?? "").trim();

  const sealRight = template.seal_enabled && template.seal_url ? template.seal_url : "";
  const sealLeft = template.seal_left_enabled && template.seal_left_url ? template.seal_left_url : "";
  const hasSeal = Boolean(sealRight || sealLeft);
  const centerSignature = template.signatures[CENTER_SIGNATURE_INDEX];
  const ordered = SIGNATURE_DISPLAY_ORDER.map(index => template.signatures[index] ?? { name: "", role: "", image_url: "" }) as Signature[];
  const filled = ordered.filter(signature => signature.name || signature.role || signature.image_url || (hasSeal && signature === centerSignature));
  const signatures = (filled.length ? filled : [template.signatures[0], template.signatures[1]]) as Signature[];
  const centerColumn = signatures.indexOf(centerSignature as Signature);
  const sponsorLogos = template.sponsor_logos;

  // Todas las imágenes se piden a la vez y ya reducidas al tamaño impreso.
  const [brandImage, signatureImages, sponsorImages, sealRightImage, sealLeftImage] = await Promise.all([
    loadImage(BRAND_URL, origin, BRAND_LOGO_SIZE, BRAND_LOGO_SIZE),
    Promise.all(signatures.map(signature => loadImage(signature.image_url, origin, SIGNATURE_IMAGE_WIDTH, SIGNATURE_IMAGE_HEIGHT))),
    Promise.all(sponsorLogos.map(url => loadImage(url, origin, SPONSOR_LOGO_WIDTH, SPONSOR_LOGO_HEIGHT))),
    loadImage(sealRight, origin, SEAL_RIGHT_WIDTH, SEAL_RIGHT_WIDTH),
    loadImage(sealLeft, origin, SEAL_LEFT_WIDTH, SEAL_LEFT_WIDTH * 2),
  ]);

  const writer = new PdfWriter();
  const canvas = new PdfCanvas(PAGE_WIDTH, PAGE_HEIGHT);
  const xobjects = new Map<string, number>();

  // ---- Fondo y marco -------------------------------------------------------
  canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, [1, 1, 1]);
  canvas.shading("Paper", FRAME_MARGIN, FRAME_MARGIN, FRAME_WIDTH, FRAME_HEIGHT);
  canvas.strokeRect(FRAME_MARGIN + 0.75, FRAME_MARGIN + 0.75, FRAME_WIDTH - 1.5, FRAME_HEIGHT - 1.5, GOLD_BORDER, 1.5);
  const outlineOffset = OUTLINE_INSET + OUTLINE_WIDTH / 2;
  canvas.strokeRect(
    FRAME_MARGIN + outlineOffset,
    FRAME_MARGIN + outlineOffset,
    FRAME_WIDTH - outlineOffset * 2,
    FRAME_HEIGHT - outlineOffset * 2,
    INK,
    OUTLINE_WIDTH,
  );

  // ---- Encabezado ----------------------------------------------------------
  const brandTitleOptions: TextOptions = { font: "Helvetica-Bold", size: 7.5, fill: GOLD_DARK, letterSpacing: 1.575 };
  const brandSubtitleOptions: TextOptions = { font: "Times-Italic", size: 7.5, fill: PURPLE };
  const brandTitleWidth = textWidth(BRAND_TITLE, brandTitleOptions.font, brandTitleOptions.size, brandTitleOptions.letterSpacing);
  const brandSubtitleWidth = textWidth(BRAND_SUBTITLE, brandSubtitleOptions.font, brandSubtitleOptions.size);
  const brandTextWidth = Math.max(brandTitleWidth, brandSubtitleWidth);
  const brandWidth = (brandImage ? BRAND_LOGO_SIZE + BRAND_GAP : 0) + brandTextWidth;
  const brandLeft = CENTER_X - brandWidth / 2;
  if (brandImage) {
    const box = containBox(brandImage, BRAND_LOGO_SIZE, BRAND_LOGO_SIZE);
    await registerImage(writer, brandImage, "Brand", xobjects);
    canvas.image("Brand", brandLeft + (BRAND_LOGO_SIZE - box.width) / 2, CONTENT_TOP + (BRAND_LOGO_SIZE - box.height) / 2, box.width, box.height);
  }
  const brandTextCenter = brandLeft + (brandImage ? BRAND_LOGO_SIZE + BRAND_GAP : 0) + brandTextWidth / 2;
  const brandTextHeight = 7.5 * 1.3 + 3.75 + 7.5 * 1.3;
  const brandTextTop = CONTENT_TOP + (BRAND_LOGO_SIZE - brandTextHeight) / 2;
  canvas.text(BRAND_TITLE, brandTextCenter, baselineOf(brandTextTop, 7.5 * 1.3, 7.5), brandTitleOptions, "center");
  canvas.text(BRAND_SUBTITLE, brandTextCenter, baselineOf(brandTextTop + 7.5 * 1.3 + 3.75, 7.5 * 1.3, 7.5), brandSubtitleOptions, "center");

  // ---- Pie: logos, firmas y sellos ----------------------------------------
  const drawableSponsors = sponsorImages.filter(Boolean) as RasterImage[];
  const sponsorsHeight = drawableSponsors.length ? SPONSOR_LOGO_HEIGHT : 0;
  const sponsorsTop = CONTENT_BOTTOM - FOOTER_MARGIN - sponsorsHeight;
  const signaturesBottom = sponsorsTop - (drawableSponsors.length ? 7.2 : 0);

  const columnWidth = (SIGNATURES_WIDTH - SIGNATURE_GAP * (signatures.length - 1)) / signatures.length;
  const signaturesLeft = CENTER_X - SIGNATURES_WIDTH / 2;
  const nameOptions: TextOptions = { font: "Helvetica-Bold", size: 9, fill: INK };
  const roleOptions: TextOptions = { font: "Helvetica", size: 7.5, fill: ROLE };
  const roleLineHeight = 7.5 * 1.25;
  const roleLines = signatures.map(signature => wrapText(signature.role, roleOptions.font, roleOptions.size, columnWidth));
  const maxRoleLines = Math.max(1, ...roleLines.map(lines => (lines[0] ? lines.length : 0)));
  // La regla de todas las firmas queda a la misma altura, sin importar cuántas
  // líneas ocupe cada cargo.
  const lineY = signaturesBottom - SIGNATURE_NAME_GAP - 9 * 1.25 - SIGNATURE_ROLE_GAP - maxRoleLines * roleLineHeight;
  const signatureImageBottom = lineY - (SIGNATURE_LINE_OFFSET - SIGNATURE_IMAGE_OVERLAP);
  const signatureContentTop = signatureImages.some(Boolean) ? signatureImageBottom - SIGNATURE_IMAGE_HEIGHT : lineY - SIGNATURE_LINE_OFFSET;
  const signatureBoxTop = Math.min(signatureContentTop, signaturesBottom - 59.04);
  const signatureBoxHeight = signaturesBottom - signatureBoxTop;

  for (let index = 0; index < signatures.length; index += 1) {
    const columnLeft = signaturesLeft + index * (columnWidth + SIGNATURE_GAP);
    const columnCenter = columnLeft + columnWidth / 2;
    const image = signatureImages[index];
    if (image) {
      const box = containBox(image, SIGNATURE_IMAGE_WIDTH, SIGNATURE_IMAGE_HEIGHT);
      await registerImage(writer, image, `Sig${index}`, xobjects);
      canvas.image(`Sig${index}`, columnCenter - box.width / 2, signatureImageBottom - box.height, box.width, box.height);
    }
    canvas.line(columnLeft, lineY, columnLeft + columnWidth, SIGNATURE_LINE, 0.75);
    canvas.text(signatures[index].name, columnCenter, baselineOf(lineY + SIGNATURE_NAME_GAP, 9 * 1.25, 9), nameOptions, "center");
    const roleTop = lineY + SIGNATURE_NAME_GAP + 9 * 1.25 + SIGNATURE_ROLE_GAP;
    roleLines[index].forEach((line, position) => {
      canvas.text(line, columnCenter, baselineOf(roleTop + position * roleLineHeight, roleLineHeight, roleOptions.size), roleOptions, "center");
    });
  }

  // Cada logo ocupa una casilla del mismo tamaño y se ajusta dentro sin
  // deformarse, así ninguno se ve más grande que los demás.
  if (drawableSponsors.length) {
    const rowWidth = drawableSponsors.length * SPONSOR_LOGO_WIDTH + (drawableSponsors.length - 1) * SPONSOR_LOGO_GAP;
    for (let index = 0; index < drawableSponsors.length; index += 1) {
      const box = containBox(drawableSponsors[index], SPONSOR_LOGO_WIDTH, SPONSOR_LOGO_HEIGHT);
      const slotLeft = CENTER_X - rowWidth / 2 + index * (SPONSOR_LOGO_WIDTH + SPONSOR_LOGO_GAP);
      await registerImage(writer, drawableSponsors[index], `Logo${index}`, xobjects);
      canvas.image(`Logo${index}`, slotLeft + (SPONSOR_LOGO_WIDTH - box.width) / 2, sponsorsTop + (SPONSOR_LOGO_HEIGHT - box.height) / 2, box.width, box.height);
    }
  }

  // Los sellos se estampan sobre la firma central, como en el diploma impreso.
  if (centerColumn >= 0) {
    const columnLeft = signaturesLeft + centerColumn * (columnWidth + SIGNATURE_GAP);
    const middle = signatureBoxTop + signatureBoxHeight / 2;
    if (sealRightImage) {
      const height = (SEAL_RIGHT_WIDTH * sealRightImage.height) / sealRightImage.width;
      await registerImage(writer, sealRightImage, "SealRight", xobjects);
      canvas.image("SealRight", columnLeft + columnWidth + SIGNATURE_GAP - SEAL_RIGHT_WIDTH, middle - height * 0.62, SEAL_RIGHT_WIDTH, height, -4.5, "Seal");
    }
    if (sealLeftImage) {
      const height = (SEAL_LEFT_WIDTH * sealLeftImage.height) / sealLeftImage.width;
      await registerImage(writer, sealLeftImage, "SealLeft", xobjects);
      canvas.image("SealLeft", columnLeft - columnWidth * 0.19 - SEAL_LEFT_WIDTH / 2, middle - height * 0.62, SEAL_LEFT_WIDTH, height, -3.5, "Seal");
    }
  }

  // ---- Cuerpo del diploma --------------------------------------------------
  const eventOptions: TextOptions = { font: "Times-Bold", size: 12, fill: INK };
  const titleFit = fitText(title, "Times-Roman", [28.5, 24, 20.25, 17], CONTENT_WIDTH, 1);
  const bodyFit = fitText(body, "Helvetica", [10.5, 9.75, 9], LEAD_MAX_WIDTH, 3);
  const nameFit = fitText(name, "Times-Italic", [25.5, 22.5, 19.5, 16.5], NAME_MAX_WIDTH - NAME_PADDING_X * 2, 1);
  const eventLines = wrapText(template.event_name, eventOptions.font, eventOptions.size, CONTENT_WIDTH);
  const introLines = wrapText("Se otorga el presente diploma a", "Helvetica", 10.5, LEAD_MAX_WIDTH);
  const numberOptions: TextOptions = { font: "Helvetica", size: NUMBER_SIZE, fill: GOLD_DARK, letterSpacing: NUMBER_SIZE * 0.13 };

  const eventLineHeight = 12 * 1.3;
  const titleLineHeight = titleFit.size * 1.2;
  const leadLineHeight = 10.5 * 1.55;
  const bodyLineHeight = bodyFit.size * 1.55;
  const nameLineHeight = nameFit.size * 1.2;
  const metaLineHeight = 9 * 1.3;
  const numberLineHeight = NUMBER_SIZE * 1.3;
  const NAME_MARGIN = 7.92;
  const LEAD_MARGIN_TOP = 10.8;
  const LEAD_MARGIN_BOTTOM = 4.5;
  const coreHeight = eventLines.length * eventLineHeight + 9
    + titleFit.lines.length * titleLineHeight + LEAD_MARGIN_TOP
    + introLines.length * leadLineHeight + LEAD_MARGIN_BOTTOM + NAME_MARGIN
    + nameFit.lines.length * nameLineHeight + NAME_PADDING_BOTTOM + 0.75 + NAME_MARGIN + LEAD_MARGIN_TOP
    + bodyFit.lines.length * bodyLineHeight + LEAD_MARGIN_BOTTOM + 7.2
    + metaLineHeight + NUMBER_GAP + numberLineHeight;

  const coreRegionTop = CONTENT_TOP + BRAND_LOGO_SIZE;
  const coreRegionBottom = signatureBoxTop - FOOTER_MARGIN;
  let cursor = Math.max(coreRegionTop, coreRegionTop + (coreRegionBottom - coreRegionTop - coreHeight) / 2);

  eventLines.forEach(line => {
    canvas.text(line, CENTER_X, baselineOf(cursor, eventLineHeight, eventOptions.size), eventOptions, "center");
    cursor += eventLineHeight;
  });
  cursor += 9;
  titleFit.lines.forEach(line => {
    canvas.text(line, CENTER_X, baselineOf(cursor, titleLineHeight, titleFit.size), { font: "Times-Roman", size: titleFit.size, fill: INK }, "center");
    cursor += titleLineHeight;
  });
  cursor += LEAD_MARGIN_TOP;
  introLines.forEach(line => {
    canvas.text(line, CENTER_X, baselineOf(cursor, leadLineHeight, 10.5), { font: "Helvetica", size: 10.5, fill: LEAD }, "center");
    cursor += leadLineHeight;
  });
  cursor += LEAD_MARGIN_BOTTOM + NAME_MARGIN;
  nameFit.lines.forEach(line => {
    canvas.text(line, CENTER_X, baselineOf(cursor, nameLineHeight, nameFit.size), { font: "Times-Italic", size: nameFit.size, fill: GOLD_NAME }, "center");
    cursor += nameLineHeight;
  });
  cursor += NAME_PADDING_BOTTOM;
  const underlineWidth = Math.min(NAME_MAX_WIDTH, CONTENT_WIDTH);
  canvas.line(CENTER_X - underlineWidth / 2, cursor, CENTER_X + underlineWidth / 2, GOLD_BORDER, 0.75);
  cursor += 0.75 + NAME_MARGIN + LEAD_MARGIN_TOP;
  bodyFit.lines.forEach(line => {
    canvas.text(line, CENTER_X, baselineOf(cursor, bodyLineHeight, bodyFit.size), { font: "Helvetica", size: bodyFit.size, fill: LEAD }, "center");
    cursor += bodyLineHeight;
  });
  cursor += LEAD_MARGIN_BOTTOM + 7.2;
  canvas.text(`${template.event_date} \u00b7 ${template.event_place}`, CENTER_X, baselineOf(cursor, metaLineHeight, 9), { font: "Helvetica", size: 9, fill: META }, "center");
  cursor += metaLineHeight + NUMBER_GAP;
  canvas.text(`No. ${certificateNumber}`, CENTER_X, baselineOf(cursor, numberLineHeight, NUMBER_SIZE), numberOptions, "center");

  // ---- Ensamblado del archivo ---------------------------------------------
  const content = await deflate(canvas.toBytes());
  const contentId = writer.addStream(content.filter ? `/Filter${content.filter}` : "", content.data);
  const fonts: PdfFontName[] = ["Helvetica", "Helvetica-Bold", "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic"];
  const fontEntries = fonts
    .map(font => `/${font.replace("-", "")} ${writer.add(`<</Type/Font/Subtype/Type1/BaseFont/${font}/Encoding/WinAnsiEncoding>>`)} 0 R`)
    .join("");
  const shading = `/Paper<</ShadingType 2/ColorSpace/DeviceRGB/Coords[${pdfNumber(FRAME_MARGIN)} ${pdfNumber(PAGE_HEIGHT - FRAME_MARGIN)} ${pdfNumber(PAGE_WIDTH - FRAME_MARGIN)} ${pdfNumber(FRAME_MARGIN)}]`
    + `/Function<</FunctionType 2/Domain[0 1]/C0[${PAPER_LIGHT.map(pdfNumber).join(" ")}]/C1[${PAPER_DARK.map(pdfNumber).join(" ")}]/N 1>>/Extend[true true]>>`;
  const xobjectEntries = [...xobjects].map(([name, id]) => `/${name} ${id} 0 R`).join("");
  const resources = `<</Font<<${fontEntries}>>/Shading<<${shading}>>`
    + `/ExtGState<</Seal<</BM/Multiply/ca 0.94>>>>`
    + (xobjectEntries ? `/XObject<<${xobjectEntries}>>` : "")
    + ">>";

  const pagesId = writer.reserve();
  const pageId = writer.add(
    `<</Type/Page/Parent ${pagesId} 0 R/MediaBox[0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]/Resources ${resources}/Contents ${contentId} 0 R>>`,
  );
  writer.put(pagesId, `<</Type/Pages/Kids[${pageId} 0 R]/Count 1>>`);
  const infoId = writer.add(`<</Title ${pdfText(`${title} · ${name}`)}/Author ${pdfText(template.event_name)}/Creator ${pdfText(BRAND_TITLE)}>>`);
  const catalogId = writer.add(`<</Type/Catalog/Pages ${pagesId} 0 R>>`);
  return writer.build(catalogId, infoId);
}

/** Cadena de texto para los metadatos del archivo. */
function pdfText(value: string) {
  const bytes = [0xfe, 0xff];
  for (const character of value) {
    const code = character.codePointAt(0) ?? 63;
    if (code > 0xffff) continue;
    bytes.push(code >> 8, code & 255);
  }
  return `<${bytes.map(byte => byte.toString(16).padStart(2, "0")).join("")}>`;
}

/** Nombre sugerido al descargar, sin acentos ni signos que compliquen a Windows. */
export function certificateFileName(fullName: string, certificateNumber: string) {
  const slug = String(fullName ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60);
  const suffix = String(certificateNumber ?? "").replace(/[^a-zA-Z0-9-]/g, "");
  return `diploma-${slug || "participacion"}${suffix ? `-${suffix}` : ""}.pdf`;
}
