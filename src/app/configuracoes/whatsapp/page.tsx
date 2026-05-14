import type { Metadata } from "next";
import WhatsAppManager from "@/components/whatsapp/WhatsAppManager";

export const metadata: Metadata = {
  title: "WhatsApp — Configurações",
};

export default function WhatsAppConfigPage() {
  return <WhatsAppManager />;
}
