/**
 * Copia a `public/` las fuentes base que necesita pdf.js para dibujar el
 * diploma como imagen. Se ejecuta antes de compilar, así siempre coinciden con
 * la versión instalada de la librería y no hay que guardarlas en el repositorio.
 */
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist", "standard_fonts");
const target = join(root, "public", "pdfjs", "standard_fonts");

// Solo las que corresponden a las dos familias del diploma: Helvetica y Times.
const files = [
  "LiberationSans-Regular.ttf",
  "LiberationSans-Bold.ttf",
  "FoxitSerif.pfb",
  "FoxitSerifBold.pfb",
  "FoxitSerifItalic.pfb",
  "LICENSE_FOXIT",
  "LICENSE_LIBERATION",
];

await mkdir(target, { recursive: true });
for (const file of files) {
  await copyFile(join(source, file), join(target, file));
}
const { version } = JSON.parse(await readFile(join(root, "node_modules", "pdfjs-dist", "package.json"), "utf8"));
console.log(`pdf.js ${version}: ${files.length} archivos copiados a public/pdfjs/standard_fonts/`);
