"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import NotificationBell from "@/components/layout/NotificationBell";
import CashWidget from "@/components/financeiro/CashWidget";
import {
  LayoutDashboard, Calendar, Users, Scissors, CreditCard,
  Package, Settings, LogOut, ChevronRight, Layers, TrendingUp, Clock, Target, DollarSign, KanbanSquare, Menu, X, Crown, MessageSquare, Palette, Sparkles, UserCheck, Bell
} from "lucide-react";
import { useState } from "react";

const ownerNav = [
  { href: "/painel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/painel/agendamentos", label: "Agendamentos", icon: Calendar },
  { href: "/painel/barbeiros", label: "Profissionais", icon: Users },
  { href: "/painel/servicos", label: "Serviços", icon: Sparkles },
  { href: "/painel/planos", label: "Planos", icon: Layers },
  { href: "/painel/assinaturas", label: "Assinantes", icon: CreditCard },
  { href: "/painel/financeiro", label: "Financeiro", icon: TrendingUp },
  { href: "/painel/ocupacao", label: "Ocupação", icon: Clock },
  { href: "/painel/metas", label: "Metas", icon: Target },
  { href: "/painel/comissoes", label: "Comissões", icon: DollarSign },
  { href: "/painel/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/painel/produtos", label: "Produtos", icon: Package },
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings },
  { href: "/painel/configuracoes/marca", label: "Identidade Visual", icon: Palette },
  { href: "/painel/configuracoes/lembretes", label: "Lembretes", icon: Bell },
  { href: "/painel/assinatura", label: "Minha Assinatura", icon: Crown },
];

const barberNav = [
  { href: "/barbeiro", label: "Minha Agenda", icon: Calendar },
  { href: "/barbeiro/producao", label: "Produção", icon: TrendingUp },
  { href: "/barbeiro/comissoes", label: "Comissões", icon: CreditCard },
  { href: "/barbeiro/clientes", label: "Clientes", icon: Users },
  { href: "/painel/kanban", label: "Tarefas", icon: KanbanSquare },
];

export default function Sidebar({ branding }: { 
  branding?: { 
    logoUrl?: string | null;
    name?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
  } 
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = user?.role === "BARBER" ? barberNav : ownerNav;

  function logout() {
    clearAuth();
    router.push("/login");
  }

  function navClick() {
    setMobileOpen(false);
  }

  const sidebarContent = (
    <aside className="flex flex-col w-64 h-full bg-zinc-900 text-white">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-zinc-800">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 overflow-hidden">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Sparkles className="w-5 h-5 text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{branding?.name || "BarberFluxo"}</p>
          <p className="text-xs text-zinc-400 truncate">{user?.name}</p>
        </div>
        <div className="flex items-center gap-1">
          {user?.role === "OWNER" && <NotificationBell />}
          <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors md:hidden">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      <CashWidget />

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/painel" && href !== "/barbeiro" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={navClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-4 h-4" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-zinc-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Botão hamburguer — mobile */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-zinc-900 text-white shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay — mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar mobile (drawer) */}
      <div className={cn(
        "md:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent}
      </div>

      {/* Sidebar desktop (fixa) */}
      <div className="hidden md:flex min-h-screen">
        {sidebarContent}
      </div>
    </>
  );
}
