import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encuentro Clínico de Psicología 2026",
  description: "Dos días de aprendizaje, conexión y herramientas para transformar la práctica clínica.",
  icons: { icon: "/favicon.svg" },
  openGraph: { title: "Encuentro Clínico de Psicología 2026", description: "La ciencia de encontrarnos.", images: [{ url: "/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", title: "Encuentro Clínico de Psicología 2026", description: "La ciencia de encontrarnos.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
