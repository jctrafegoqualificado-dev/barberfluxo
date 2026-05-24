"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * A página "Identidade Visual" foi unificada em "Meu Negócio".
 * Qualquer link antigo que aponte para /painel/configuracoes/marca
 * é redirecionado automaticamente.
 */
export default function MarcaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/painel/meu-negocio");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
      <p className="text-zinc-500 text-sm">Redirecionando para Meu Negócio…</p>
    </div>
  );
}
