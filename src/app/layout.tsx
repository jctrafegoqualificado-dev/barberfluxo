import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BarberFluxo — Sistema de Gestão e Agendamento",
  description: "Sistema completo de gestão, assinaturas e agendamento para prestadores de serviços",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body
        className={`${inter.className} min-h-full antialiased`}
        suppressHydrationWarning
      >{children}</body>
    </html>
  );
}
