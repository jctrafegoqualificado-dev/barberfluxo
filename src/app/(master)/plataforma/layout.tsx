"use client";
import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Activity, Users, Settings, LogOut, Code2 } from "lucide-react";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

export default function MasterLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  useTokenRefresh();

  if (!user) {
    router.push("/login");
    return null;
  }

  if (user.role !== "PLATFORM_ADMIN" && !user.isPlatformAdmin) {
    router.push("/painel");
    return null;
  }

  const links = [
    { href: "/plataforma", label: "Painel Administrativo", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex font-sans selection:bg-indigo-500/30">
      {/* Sidebar Master */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col hidden md:flex">
        <div className="h-20 flex items-center px-6 border-b border-zinc-800">
          <Code2 className="w-8 h-8 text-indigo-500 mr-2" />
          <div>
            <h2 className="font-bold text-lg tracking-tight text-white leading-none">IaDe<span className="text-indigo-500">Barbearia</span></h2>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Admin</span>
          </div>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-1">
          {links.map(l => {
            const active = pathname === l.href;
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? "bg-indigo-500/10 text-indigo-400" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"}`}>
                <Icon className={`w-5 h-5 ${active ? "text-indigo-400" : "text-zinc-500"}`} />
                {l.label}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-zinc-800/30 mb-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-200 truncate">{user.name}</p>
              <p className="text-xs text-zinc-500 truncate">Super Admin</p>
            </div>
          </div>
          <button onClick={() => { clearAuth(); router.push("/login"); }} className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-red-400 w-full rounded-lg transition-colors">
            <LogOut className="w-4 h-4" /> Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
