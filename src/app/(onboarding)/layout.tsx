"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user) router.push("/login");
    else if (user.role !== "OWNER") router.push("/barbeiro");
  }, [user, router, mounted]);

  if (!mounted || !user) return null;

  return <>{children}</>;
}
