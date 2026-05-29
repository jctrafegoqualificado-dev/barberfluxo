import type { Metadata } from "next";
import WhatsAppManager from "@/components/whatsapp/WhatsAppManager";

export const metadata: Metadata = {
  title: "WhatsApp — IaDeBarbearia",
};

export default function WhatsAppConfigPage() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Configuração do WhatsApp</h1>
        <p className="text-zinc-500">Gerencie a conexão do robô de agendamentos.</p>
      </div>
      
      <WhatsAppManager />
    </div>
  );
}
