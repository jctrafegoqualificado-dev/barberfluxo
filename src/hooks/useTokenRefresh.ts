"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

// Renova o token automaticamente quando estiver a < 2h de expirar.
// Chamado nos layouts autenticados (painel, barbeiro, plataforma).
export function useTokenRefresh() {
  const refreshAuth = useAuthStore((s) => s.refreshAuth);

  useEffect(() => {
    // Tenta renovar ao montar o layout (ex: usuário abre o app após horas)
    refreshAuth().catch(() => {
      // Falha silenciosa — o interceptor de 401 no layout vai deslogar se necessário
    });

    // Verifica a cada 30 minutos enquanto a aba estiver aberta
    const interval = setInterval(() => {
      refreshAuth().catch(() => {});
    }, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refreshAuth]);
}
