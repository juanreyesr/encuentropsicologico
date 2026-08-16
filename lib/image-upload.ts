/**
 * Prepara una fotografía en el navegador antes de subirla: la rota según venga
 * de la cámara, la reduce a un tamaño razonable para la web y baja la calidad
 * lo justo hasta que pese poco.
 *
 * La idea es que se pueda subir la foto tal como salió del teléfono, sin tener
 * que redimensionarla ni comprimirla en otro programa.
 */

/** Lo que acepta la carga directa del servidor, con margen para la petición. */
const MAX_BYTES = 3 * 1024 * 1024;
/** Suficiente para verse nítida en pantallas grandes sin cargar de más. */
const SIZES = [1920, 1600, 1280, 1024];
const QUALITIES = [0.85, 0.75, 0.62];

export type PreparedImage = { file: File; width: number; height: number; originalBytes: number };

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[^\p{L}\p{N} _-]+/gu, " ").trim().slice(0, 60) || "foto";
}

async function encode(source: ImageBitmap, largestSide: number, quality: number, name: string) {
  const scale = Math.min(1, largestSide / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen.");
  context.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
  canvas.width = 0;
  canvas.height = 0;
  return blob ? { file: new File([blob], `${name}.jpg`, { type: "image/jpeg" }), width, height } : null;
}

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo no es una imagen.");
  // `from-image` respeta la orientación EXIF: las fotos verticales del teléfono
  // no salen acostadas.
  const source = await createImageBitmap(file, { imageOrientation: "from-image" });
  const name = baseName(file.name);
  try {
    let best: { file: File; width: number; height: number } | null = null;
    for (const size of SIZES) {
      for (const quality of QUALITIES) {
        const attempt = await encode(source, size, quality, name);
        if (!attempt) continue;
        best = attempt;
        if (attempt.file.size <= MAX_BYTES) return { ...attempt, originalBytes: file.size };
      }
    }
    if (!best) throw new Error("No se pudo preparar la imagen.");
    if (best.file.size > MAX_BYTES) throw new Error("La imagen es demasiado grande incluso reducida. Prueba con otra.");
    return { ...best, originalBytes: file.size };
  } finally {
    source.close();
  }
}
