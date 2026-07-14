import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cuando el Duelo se Detiene | Jornada Clínica 2026",
  description: "Jornada Clínica sobre Duelo Prolongado. 15 de agosto de 2026 en Chimaltenango, modalidad híbrida.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Cuando el Duelo se Detiene", description: "Jornada Clínica sobre Duelo Prolongado · 15 de agosto de 2026", images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "Cuando el Duelo se Detiene", description: "Jornada Clínica sobre Duelo Prolongado", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
