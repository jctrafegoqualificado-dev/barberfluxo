import type { Metadata } from "next";
import WhatsAppOverview from "@/components/whatsapp/WhatsAppOverview";

export const metadata: Metadata = {
  title: "WhatsApp — IaDeBarbearia",
};

export default function WhatsAppPage() {
  return <WhatsAppOverview />;
}
