"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import Sidebar from "@/components/layout/Sidebar";

export default function BarbeiroLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) router.push("/login");
    else if (user.role !== "BARBER" && !user.isBarber) router.push("/painel");
  }, [user, router, mounted]);

  if (!mounted) return null;
  if (!user || (user.role !== "BARBER" && !user.isBarber)) return null;

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
