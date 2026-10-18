"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import ClientFicha from "@/components/clientes/ClientFicha";

// Ficha do cliente em tela inteira (docs/design/Ficha-cliente-celular.dc.html).
// No computador a ficha abre ao lado da lista; esta página é o caminho do celular.
export default function FichaClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  return (
    <div className="max-w-xl mx-auto pb-6">
      <ClientFicha id={id} variant="page" onDeleted={() => router.replace("/painel/clientes")} />
    </div>
  );
}
