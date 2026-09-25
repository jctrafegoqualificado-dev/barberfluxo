import type { Metadata } from "next";
import { Bricolage_Grotesque, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const bodyFont = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-body" });
const displayFont = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display-face" });

export const metadata: Metadata = {
  title: "IA de Barbearia — Gestão Completa + Agente de IA",
  description: "Sistema completo de gestão, assinaturas e agendamento para barbearias",
};

import { Toaster } from 'sonner';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full ${bodyFont.variable} ${displayFont.variable}`}>
      <body
        className={`${bodyFont.className} min-h-full antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
