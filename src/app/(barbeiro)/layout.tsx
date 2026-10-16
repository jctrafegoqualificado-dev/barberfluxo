"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import Sidebar from "@/components/layout/Sidebar";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

export default function BarbeiroLayout({ children }: { children: React.ReactNode }) {
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

  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : null;
  }

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!token) return;
    fetch("/api/barbershop/settings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.primaryColor) {
          setBranding({
            primaryColor: data.primaryColor,
            secondaryColor: data.secondaryColor || data.primaryColor,
            logoUrl: data.logoUrl,
            name: data.name,
          });
        }
      });
  }, [token]);

  useEffect(() => {
    if (!mounted) return;
    if (!user) router.push("/login");
    else if (user.role !== "BARBER" && !user.isBarber) router.push("/painel");
  }, [user, router, mounted]);

  if (!mounted) return null;
  if (!user || (user.role !== "BARBER" && !user.isBarber)) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --primary: ${branding?.primaryColor ? hexToRgb(branding.primaryColor) : "201, 79, 12"};
          --secondary: ${branding?.secondaryColor ? hexToRgb(branding.secondaryColor) : "161, 98, 7"};
        }
      `}} />
      <div className="flex min-h-screen bg-ground">
        <Sidebar branding={branding || undefined} />
        <main className="flex-1 min-w-0 overflow-auto">
          {/* pb-28 no celular: espaço para a barra inferior */}
          <div className="px-4 pt-5 pb-28 md:p-6 max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </>
  );
}
