/**
 * Lectura de las imágenes del diploma (logos, firmas y sellos) para colocarlas
 * dentro del PDF.
 *
 * El PNG se descomprime por filas y se reduce al tamaño exacto con el que se
 * imprime, así una firma de ocho mil píxeles de ancho no obliga a sostener la
 * imagen completa en memoria ni engorda el archivo que descarga la persona.
 */

export type RasterImage =
  | { kind: "raw"; width: number; height: number; rgb: Uint8Array; alpha: Uint8Array | null }
  | { kind: "jpeg"; width: number; height: number; data: Uint8Array; components: number };

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function isPng(bytes: Uint8Array) {
  return PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  return distanceUp <= distanceUpLeft ? up : upLeft;
}

function unfilter(row: Uint8Array, previous: Uint8Array, filter: number, bytesPerPixel: number) {
  const length = row.length;
  if (filter === 1) {
    for (let index = bytesPerPixel; index < length; index += 1) row[index] = (row[index] + row[index - bytesPerPixel]) & 255;
  } else if (filter === 2) {
    for (let index = 0; index < length; index += 1) row[index] = (row[index] + previous[index]) & 255;
  } else if (filter === 3) {
    for (let index = 0; index < length; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      row[index] = (row[index] + ((left + previous[index]) >> 1)) & 255;
    }
  } else if (filter === 4) {
    for (let index = 0; index < length; index += 1) {
      const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
      const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;
      row[index] = (row[index] + paeth(left, previous[index], upLeft)) & 255;
    }
  }
}

type PngHeader = {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  interlace: number;
  palette: Uint8Array | null;
  paletteAlpha: Uint8Array | null;
  data: Uint8Array[];
};

function readPngChunks(bytes: Uint8Array): PngHeader | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let position = 8;
  let header: Omit<PngHeader, "data" | "palette" | "paletteAlpha"> | null = null;
  let palette: Uint8Array | null = null;
  let paletteAlpha: Uint8Array | null = null;
  const data: Uint8Array[] = [];
  while (position + 8 <= bytes.length) {
    const length = view.getUint32(position);
    const type = String.fromCharCode(bytes[position + 4], bytes[position + 5], bytes[position + 6], bytes[position + 7]);
    const start = position + 8;
    if (start + length > bytes.length) break;
    if (type === "IHDR") {
      header = {
        width: view.getUint32(start),
        height: view.getUint32(start + 4),
        bitDepth: bytes[start + 8],
        colorType: bytes[start + 9],
        interlace: bytes[start + 12],
      };
    } else if (type === "PLTE") palette = bytes.subarray(start, start + length);
    else if (type === "tRNS") paletteAlpha = bytes.subarray(start, start + length);
    else if (type === "IDAT") data.push(bytes.subarray(start, start + length));
    else if (type === "IEND") break;
    position = start + length + 4;
  }
  return header ? { ...header, palette, paletteAlpha, data } : null;
}

/** Reduce la imagen promediando los píxeles de origen que caen en cada destino. */
class Downscaler {
  private readonly sums: Float64Array;
  private readonly counts: Uint32Array;

  constructor(readonly width: number, readonly height: number) {
    this.sums = new Float64Array(width * height * 4);
    this.counts = new Uint32Array(width * height);
  }

  add(targetIndex: number, red: number, green: number, blue: number, alpha: number) {
    const base = targetIndex * 4;
    // Se acumula el color multiplicado por la opacidad para que los bordes
    // transparentes no arrastren un halo del color de fondo.
    this.sums[base] += red * alpha;
    this.sums[base + 1] += green * alpha;
    this.sums[base + 2] += blue * alpha;
    this.sums[base + 3] += alpha;
    this.counts[targetIndex] += 1;
  }

  finish(withAlpha: boolean) {
    const pixels = this.width * this.height;
    const rgb = new Uint8Array(pixels * 3);
    const alpha = withAlpha ? new Uint8Array(pixels) : null;
    let opaque = true;
    for (let index = 0; index < pixels; index += 1) {
      const base = index * 4;
      const alphaSum = this.sums[base + 3];
      const count = this.counts[index] || 1;
      if (alphaSum > 0) {
        rgb[index * 3] = Math.min(255, Math.round(this.sums[base] / alphaSum));
        rgb[index * 3 + 1] = Math.min(255, Math.round(this.sums[base + 1] / alphaSum));
        rgb[index * 3 + 2] = Math.min(255, Math.round(this.sums[base + 2] / alphaSum));
      } else {
        rgb[index * 3] = 255;
        rgb[index * 3 + 1] = 255;
        rgb[index * 3 + 2] = 255;
      }
      if (alpha) {
        const value = Math.min(255, Math.round(alphaSum / count));
        alpha[index] = value;
        if (value < 255) opaque = false;
      }
    }
    return { rgb, alpha: alpha && !opaque ? alpha : null };
  }
}

async function decodePng(bytes: Uint8Array, maxWidth: number, maxHeight: number): Promise<RasterImage | null> {
  const png = readPngChunks(bytes);
  if (!png || !png.data.length) return null;
  const { width, height, bitDepth, colorType, interlace, palette, paletteAlpha } = png;
  const channels = CHANNELS[colorType];
  if (!channels || bitDepth !== 8 || interlace !== 0 || !width || !height) return null;
  if (colorType === 3 && !palette) return null;

  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const columns = new Int32Array(width);
  for (let x = 0; x < width; x += 1) columns[x] = Math.min(targetWidth - 1, Math.floor((x * targetWidth) / width));
  const withAlpha = colorType === 4 || colorType === 6 || (colorType === 3 && Boolean(paletteAlpha));
  const scaler = new Downscaler(targetWidth, targetHeight);

  const rowLength = width * channels;
  const buffer = new Uint8Array(rowLength + 1);
  let previous = new Uint8Array(rowLength);
  let current = new Uint8Array(rowLength);
  let filled = 0;
  let row = 0;

  const compressed = new Blob(png.data as BlobPart[]).stream();
  const reader = compressed.pipeThrough(new DecompressionStream("deflate")).getReader();

  const flushRow = () => {
    current.set(buffer.subarray(1));
    unfilter(current, previous, buffer[0], channels);
    const targetRow = Math.min(targetHeight - 1, Math.floor((row * targetHeight) / height)) * targetWidth;
    for (let x = 0; x < width; x += 1) {
      const offset = x * channels;
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 255;
      if (colorType === 0) { red = green = blue = current[offset]; }
      else if (colorType === 2) { red = current[offset]; green = current[offset + 1]; blue = current[offset + 2]; }
      else if (colorType === 3) {
        const entry = current[offset] * 3;
        red = palette![entry];
        green = palette![entry + 1];
        blue = palette![entry + 2];
        alpha = paletteAlpha && current[offset] < paletteAlpha.length ? paletteAlpha[current[offset]] : 255;
      } else if (colorType === 4) { red = green = blue = current[offset]; alpha = current[offset + 1]; }
      else { red = current[offset]; green = current[offset + 1]; blue = current[offset + 2]; alpha = current[offset + 3]; }
      scaler.add(targetRow + columns[x], red, green, blue, alpha);
    }
    const swap = previous;
    previous = current;
    current = swap;
    filled = 0;
    row += 1;
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    let consumed = 0;
    while (consumed < value.length && row < height) {
      const take = Math.min(buffer.length - filled, value.length - consumed);
      buffer.set(value.subarray(consumed, consumed + take), filled);
      filled += take;
      consumed += take;
      if (filled === buffer.length) flushRow();
    }
    if (row >= height) { await reader.cancel().catch(() => undefined); break; }
  }
  if (row === 0) return null;

  const { rgb, alpha } = scaler.finish(withAlpha);
  return { kind: "raw", width: targetWidth, height: targetHeight, rgb, alpha };
}

/** El JPEG se incrusta tal cual: el visor de PDF sabe leerlo sin convertirlo. */
function readJpeg(bytes: Uint8Array): RasterImage | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let position = 2;
  while (position + 4 < bytes.length) {
    if (bytes[position] !== 0xff) { position += 1; continue; }
    const marker = bytes[position + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { position += 2; continue; }
    const length = view.getUint16(position + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      const components = bytes[position + 9];
      if (components !== 1 && components !== 3) return null;
      return { kind: "jpeg", width: view.getUint16(position + 7), height: view.getUint16(position + 5), data: bytes, components };
    }
    position += 2 + length;
  }
  return null;
}

/**
 * Devuelve la imagen lista para el PDF, reducida al tamaño con el que se
 * imprimirá. Si el formato no se puede leer devuelve `null` y el diploma se
 * dibuja sin esa pieza en lugar de fallar por completo.
 */
export async function readImage(bytes: Uint8Array, maxWidth: number, maxHeight: number): Promise<RasterImage | null> {
  try {
    if (isPng(bytes)) return await decodePng(bytes, maxWidth, maxHeight);
    return readJpeg(bytes);
  } catch {
    return null;
  }
}
