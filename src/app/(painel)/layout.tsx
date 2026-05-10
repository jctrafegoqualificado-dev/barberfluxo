"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import Sidebar from "@/components/layout/Sidebar";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) router.push("/login");
  }, [user, router, mounted]);

  if (!mounted) return null;
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 pt-16 md:pt-6 md:p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
