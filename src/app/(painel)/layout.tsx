"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import Sidebar from "@/components/layout/Sidebar";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [branding, setBranding] = useState<{ 
    primaryColor: string; 
    secondaryColor: string;
    logoUrl?: string | null;
    name?: string | null;
  } | null>(null);

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
      <div className="flex min-h-screen bg-zinc-50">
        <Sidebar branding={branding || undefined} />
        <main className="flex-1 overflow-auto">
          <div className="p-4 pt-16 md:pt-6 md:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </>
  );
}
