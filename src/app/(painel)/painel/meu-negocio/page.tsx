"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * "Meu Negócio" virou Configurações → Marca no redesign (decisão A, docs/redesign/fase-0-inventario.md).
 * Links antigos para /painel/meu-negocio são redirecionados.
 */
export default function MeuNegocioRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/painel/configuracoes/marca");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-ink-3 text-sm">Redirecionando para Configurações → Marca…</p>
    </div>
  );
}
