/**
 * Convierte el PDF del diploma en una imagen JPG dentro del navegador. La
 * imagen sale del mismo archivo que se descarga, así el JPG y el PDF son
 * siempre el mismo diploma y no hay dos diseños que puedan separarse.
 *
 * Se usa la compilación `legacy` de pdf.js, que es la que funciona en los
 * teléfonos con navegadores más antiguos.
 */

/** 200 puntos por pulgada: nítido para imprimir y liviano para compartir. */
const RESOLUTIONS = [200, 150, 110];
const QUALITY = 0.92;

export async function renderCertificateImage(data: Uint8Array): Promise<Blob | null> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.min.mjs");
  const worker = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  pdfjs.GlobalWorkerOptions.workerPort = worker;
  try {
    const file = await pdfjs.getDocument({ data, standardFontDataUrl: "/pdfjs/standard_fonts/" }).promise;
    const page = await file.getPage(1);
    // Si el teléfono no puede con el lienzo más grande, se baja la resolución
    // antes de rendirse.
    for (const dpi of RESOLUTIONS) {
      const viewport = page.getViewport({ scale: dpi / 72 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      let blob: Blob | null = null;
      try {
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", QUALITY));
      } catch {
        blob = null;
      }
      canvas.width = 0;
      canvas.height = 0;
      if (blob) return blob;
    }
    return null;
  } finally {
    worker.terminate();
  }
}
