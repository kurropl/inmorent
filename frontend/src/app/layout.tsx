import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropTech Locator — Oportunidades Inmobiliarias",
  description: "Detección de locales comerciales convertibles a vivienda en costa de Huelva",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
