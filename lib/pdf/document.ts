/**
 * Escritor mínimo de PDF: objetos, flujos comprimidos, imágenes y texto con las
 * fuentes base del formato. Es lo justo para dibujar el diploma con medidas
 * fijas en puntos, de modo que el archivo se vea igual en cualquier teléfono,
 * computadora o impresora.
 */
import { textWidth, winAnsiCode, type PdfFontName } from "./fonts";

const ascii = new TextEncoder();

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

/** Los flujos de contenido llevan bytes sueltos (texto en WinAnsi), no UTF-8. */
function latin1(text: string) {
  const output = new Uint8Array(text.length);
  for (let index = 0; index < text.length; index += 1) output[index] = text.charCodeAt(index) & 0xff;
  return output;
}

/** Comprime con la API estándar de la plataforma; si no existe, va sin filtro. */
export async function deflate(data: Uint8Array): Promise<{ data: Uint8Array; filter: string | null }> {
  if (typeof CompressionStream !== "function") return { data, filter: null };
  try {
    const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate"));
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return { data: compressed, filter: "/FlateDecode" };
  } catch {
    return { data, filter: null };
  }
}

export function pdfNumber(value: number) {
  return (Math.round(value * 1000) / 1000).toString();
}

/** Texto literal de PDF: se escapan paréntesis, barras y bytes no imprimibles. */
export function pdfLiteral(text: string) {
  let output = "(";
  for (let index = 0; index < text.length; index += 1) {
    const code = winAnsiCode(text.charCodeAt(index));
    if (code === 0x28 || code === 0x29 || code === 0x5c) output += `\\${String.fromCharCode(code)}`;
    else if (code < 32 || code > 126) output += `\\${code.toString(8).padStart(3, "0")}`;
    else output += String.fromCharCode(code);
  }
  return `${output})`;
}

export class PdfWriter {
  private bodies: (Uint8Array | null)[] = [];

  reserve() {
    this.bodies.push(null);
    return this.bodies.length;
  }

  put(id: number, body: Uint8Array | string) {
    this.bodies[id - 1] = typeof body === "string" ? ascii.encode(body) : body;
  }

  add(body: Uint8Array | string) {
    const id = this.reserve();
    this.put(id, body);
    return id;
  }

  addStream(dictionary: string, data: Uint8Array) {
    return this.add(concat([
      ascii.encode(`<<${dictionary}/Length ${data.length}>>\nstream\n`),
      data,
      ascii.encode("\nendstream"),
    ]));
  }

  build(catalogId: number, infoId?: number) {
    const parts: Uint8Array[] = [ascii.encode("%PDF-1.7\n%\xE2\xE3\xCF\xD3\n")];
    let offset = parts[0].length;
    const offsets: number[] = [];
    this.bodies.forEach((body, index) => {
      offsets.push(offset);
      const chunk = concat([ascii.encode(`${index + 1} 0 obj\n`), body ?? ascii.encode("null"), ascii.encode("\nendobj\n")]);
      parts.push(chunk);
      offset += chunk.length;
    });
    let xref = `xref\n0 ${this.bodies.length + 1}\n0000000000 65535 f \n`;
    offsets.forEach(position => { xref += `${String(position).padStart(10, "0")} 00000 n \n`; });
    xref += `trailer\n<</Size ${this.bodies.length + 1}/Root ${catalogId} 0 R${infoId ? `/Info ${infoId} 0 R` : ""}>>\nstartxref\n${offset}\n%%EOF\n`;
    parts.push(ascii.encode(xref));
    return concat(parts);
  }
}

export type Color = [number, number, number];

/** Convierte "#rrggbb" al triple 0-1 que usa PDF. */
export function color(hex: string): Color {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

export type TextOptions = {
  font: PdfFontName;
  size: number;
  fill: Color;
  letterSpacing?: number;
};

/**
 * Lienzo de una página en coordenadas de arriba hacia abajo, que es como está
 * pensado el diseño del diploma. La conversión al sistema del PDF ocurre aquí.
 */
export class PdfCanvas {
  private operations: string[] = [];

  constructor(readonly width: number, readonly height: number) {}

  private y(top: number) {
    return this.height - top;
  }

  private setFill(fill: Color) {
    this.operations.push(`${pdfNumber(fill[0])} ${pdfNumber(fill[1])} ${pdfNumber(fill[2])} rg`);
  }

  rect(x: number, top: number, width: number, height: number, fill: Color) {
    this.setFill(fill);
    this.operations.push(`${pdfNumber(x)} ${pdfNumber(this.y(top + height))} ${pdfNumber(width)} ${pdfNumber(height)} re f`);
  }

  strokeRect(x: number, top: number, width: number, height: number, stroke: Color, lineWidth: number) {
    this.operations.push(`${pdfNumber(stroke[0])} ${pdfNumber(stroke[1])} ${pdfNumber(stroke[2])} RG ${pdfNumber(lineWidth)} w`);
    this.operations.push(`${pdfNumber(x)} ${pdfNumber(this.y(top + height))} ${pdfNumber(width)} ${pdfNumber(height)} re S`);
  }

  line(x1: number, top: number, x2: number, stroke: Color, lineWidth: number) {
    this.operations.push(`${pdfNumber(stroke[0])} ${pdfNumber(stroke[1])} ${pdfNumber(stroke[2])} RG ${pdfNumber(lineWidth)} w`);
    this.operations.push(`${pdfNumber(x1)} ${pdfNumber(this.y(top))} m ${pdfNumber(x2)} ${pdfNumber(this.y(top))} l S`);
  }

  /** Pinta el degradado del fondo recortado al rectángulo indicado. */
  shading(name: string, x: number, top: number, width: number, height: number) {
    this.operations.push(`q ${pdfNumber(x)} ${pdfNumber(this.y(top + height))} ${pdfNumber(width)} ${pdfNumber(height)} re W n /${name} sh Q`);
  }

  /** Dibuja el texto tomando `baseline` como línea base y `x` según la alineación. */
  text(value: string, x: number, baseline: number, options: TextOptions, align: "left" | "center" | "right" = "left") {
    if (!value) return;
    const spacing = options.letterSpacing ?? 0;
    const width = textWidth(value, options.font, options.size, spacing);
    const start = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
    this.setFill(options.fill);
    this.operations.push(
      `BT /${options.font.replace("-", "")} ${pdfNumber(options.size)} Tf ${spacing ? `${pdfNumber(spacing)} Tc ` : ""}`
      + `1 0 0 1 ${pdfNumber(start)} ${pdfNumber(this.y(baseline))} Tm ${pdfLiteral(value)} Tj${spacing ? " 0 Tc" : ""} ET`,
    );
  }

  /** Coloca una imagen ya registrada; el rectángulo se da en coordenadas de página. */
  image(name: string, x: number, top: number, width: number, height: number, rotation = 0, graphicsState?: string) {
    const bottom = this.y(top + height);
    this.operations.push("q");
    if (graphicsState) this.operations.push(`/${graphicsState} gs`);
    if (rotation) {
      const angle = (rotation * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const centerX = x + width / 2;
      const centerY = bottom + height / 2;
      // Se rota alrededor del centro de la imagen, igual que `transform: rotate`.
      const a = cos * width;
      const b = sin * width;
      const c = -sin * height;
      const d = cos * height;
      const e = centerX - (a + c) / 2;
      const f = centerY - (b + d) / 2;
      this.operations.push(`${pdfNumber(a)} ${pdfNumber(b)} ${pdfNumber(c)} ${pdfNumber(d)} ${pdfNumber(e)} ${pdfNumber(f)} cm`);
    } else {
      this.operations.push(`${pdfNumber(width)} 0 0 ${pdfNumber(height)} ${pdfNumber(x)} ${pdfNumber(bottom)} cm`);
    }
    this.operations.push(`/${name} Do Q`);
  }

  toBytes() {
    return latin1(this.operations.join("\n"));
  }
}
