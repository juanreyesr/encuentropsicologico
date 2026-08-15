/**
 * pdfjs-dist solo publica los tipos de su punto de entrada principal. El
 * diploma usa la compilación `legacy`, que es la que funciona en los teléfonos
 * con navegadores más antiguos, así que aquí se reutilizan esos mismos tipos.
 */
declare module "pdfjs-dist/legacy/build/pdf.min.mjs" {
  export * from "pdfjs-dist";
}
