"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import Sidebar from "@/components/layout/Sidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useTokenRefresh();
  const [branding, setBranding] = useState<{
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string | null;
    name?: string | null;
  } | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [saasExpiresInDays, setSaasExpiresInDays] = useState<number | null>(null);

  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
      `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
      null;
  }

  useEffect(() => {
    setMounted(true);
    if (token) {
      fetch("/api/barbershop/settings", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(data => {
        if (data.primaryColor) {
          setBranding({
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor || data.primaryColor,
            logoUrl: data.logoUrl,
            name: data.name
          });
        }

        // ── Gate de onboarding ───────────────────────────────────────────
        if (data.onboardingCompleted === false) {
          router.push("/onboarding");
          return;
        }

        // ── Enforcement de plano ─────────────────────────────────────────
        const saasPlan: string  = data.saasPlan  || "BASIC";
        const saasStatus: string = data.saasStatus || "TRIAL";
        const isPaid = saasPlan === "PRO" || saasPlan === "ELITE" || saasPlan === "PREMIUM";
        const trialEndsAt    = data.trialEndsAt    ? new Date(data.trialEndsAt)    : null;
        const saasExpiresAt  = data.saasExpiresAt  ? new Date(data.saasExpiresAt)  : null;
        const isOnAssinatura = window.location.pathname.includes("/painel/assinatura");

        // 1. Plano pago vencido (OVERDUE / CANCELLED)
        if (saasStatus === "OVERDUE" || saasStatus === "CANCELLED") {
          if (!isOnAssinatura) {
            router.push("/painel/assinatura?expired=true");
          }
          return;
        }

        // 2. Trial expirado (plano BASIC sem pagamento)
        if (!isPaid && trialEndsAt) {
          if (trialEndsAt < new Date()) {
            if (!isOnAssinatura) {
              router.push("/painel/assinatura?trial=expired");
            }
          } else {
            // Trial ativo → mostra banner com dias restantes
            const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            setTrialDaysLeft(daysLeft);
          }
        }

        // 3. Plano pago mas próximo do vencimento (≤ 5 dias)
        if (isPaid && saasExpiresAt) {
          const daysLeft = Math.ceil((saasExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft > 0 && daysLeft <= 5) {
            setSaasExpiresInDays(daysLeft);
          }
        }
      });
    }
  }, [token]);

  useEffect(() => {
    if (!mounted) return;
    if (!user) {
      router.push("/login");
      return;
    }

    if (user.role !== "OWNER") {
      router.push("/barbeiro");
      return;
    }

    // Interceptor Global de Fetch para deslogar em 401
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof URL ? args[0].href : (args[0] as Request)?.url);

      if (response.status === 401 && url?.includes('/api/')) {
        useAuthStore.getState().clearAuth();
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        router.push("/login");
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [user, router, mounted]);

  if (!mounted) return null;
  if (!user) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --primary: ${branding?.primaryColor ? hexToRgb(branding.primaryColor) : "245, 158, 11"};
          --secondary: ${branding?.secondaryColor ? hexToRgb(branding.secondaryColor) : "251, 191, 36"};
        }
      `}} />
      {trialDaysLeft !== null && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-center text-sm font-semibold py-2 px-4">
          ⚡ Período de teste: {trialDaysLeft} dia{trialDaysLeft !== 1 ? "s" : ""} restante{trialDaysLeft !== 1 ? "s" : ""} —{" "}
          <a href="/painel/assinatura" className="underline font-bold hover:text-amber-100">Assine agora e continue</a>
        </div>
      )}
      {saasExpiresInDays !== null && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white text-center text-sm font-semibold py-2 px-4">
          🔔 Seu plano vence em {saasExpiresInDays} dia{saasExpiresInDays !== 1 ? "s" : ""} —{" "}
          <a href="/painel/assinatura" className="underline font-bold hover:text-orange-100">Renovar agora</a>
        </div>
      )}
      <div className={`flex min-h-screen bg-zinc-50${trialDaysLeft !== null || saasExpiresInDays !== null ? " pt-9" : ""}`}>
        <Sidebar branding={branding || undefined} />
        <main className="flex-1 overflow-auto">
          <div className="p-4 pt-16 md:pt-6 md:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </>
  );
}
