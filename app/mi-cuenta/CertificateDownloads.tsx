"use client";

import { useState } from "react";
import { renderCertificateImage } from "../../lib/certificate-image";

/**
 * El diploma se descarga en PDF, que es el formato que garantiza que nada se
 * mueva ni falte. La imagen se dibuja en el teléfono a partir de ese mismo PDF,
 * para quien prefiera verla o compartirla como foto.
 */
const CERTIFICATE_URL = "/api/account/certificate";

function fileNameFrom(response: Response, extension: string) {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const base = (match?.[1] ?? "diploma-participacion.pdf").replace(/\.pdf$/i, "");
  return `${base}.${extension}`;
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function CertificateDownloads() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function downloadImage() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(CERTIFICATE_URL, { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        setError(await response.text() || "No se pudo preparar el diploma. Inténtalo de nuevo.");
        return;
      }
      const blob = await renderCertificateImage(new Uint8Array(await response.arrayBuffer()));
      if (!blob) {
        setError("No se pudo crear la imagen en este dispositivo. Descarga el PDF: es el mismo diploma.");
        return;
      }
      saveBlob(blob, fileNameFrom(response, "jpg"));
    } catch {
      setError("No se pudo crear la imagen. Descarga el PDF: es el mismo diploma.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="certificate-downloads">
      <div>
        <a className="primary" href={CERTIFICATE_URL}>Descargar diploma en PDF</a>
        <button className="secondary" type="button" disabled={busy} onClick={() => void downloadImage()}>
          {busy ? "Creando la imagen…" : "Descargar como imagen"}
        </button>
      </div>
      <small>El PDF es tamaño carta y está listo para imprimir. La imagen es el mismo diploma en JPG, para verlo o compartirlo desde el teléfono.</small>
      {error && <p className="certificate-download-error" role="alert">{error}</p>}
    </div>
  );
}
