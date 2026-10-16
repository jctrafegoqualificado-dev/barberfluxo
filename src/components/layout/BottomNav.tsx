"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Banknote, Menu, Plus, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";

type Tab = { href: string; label: string; icon: ElementType; exact?: boolean };

// Barra inferior do celular (docs/design/Dashboard-celular.dc.html): 2 abas, botão de
// novo agendamento na cor da barbearia, mais 1 aba e "Menu", que abre o menu completo.
const OWNER_TABS: [Tab, Tab, Tab] = [
  { href: "/painel", label: "Início", icon: LayoutDashboard, exact: true },
  { href: "/painel/agendamentos", label: "Agenda", icon: Calendar },
  { href: "/painel/fluxo-caixa", label: "Caixa", icon: Banknote },
];
const BARBER_TABS: [Tab, Tab, Tab] = [
  { href: "/barbeiro", label: "Agenda", icon: Calendar, exact: true },
  { href: "/barbeiro/producao", label: "Ganhos", icon: TrendingUp },
  { href: "/barbeiro/clientes", label: "Clientes", icon: Users },
];

function isActive(pathname: string, tab: Tab) {
  return tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(tab.href + "/");
}

export default function BottomNav({ isOwner, onOpenMenu }: { isOwner: boolean; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const [a, b, c] = isOwner ? OWNER_TABS : BARBER_TABS;
  const newHref = isOwner ? "/painel/agendamentos?novo=1" : "/barbeiro?novo=1";

  const tab = (t: Tab) => {
    const active = isActive(pathname, t);
    const Icon = t.icon;
    return (
      <Link
        key={t.href}
        href={t.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "w-16 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px]",
          active ? "font-semibold text-ink" : "font-medium text-ink-3"
        )}
      >
        <Icon className={cn("w-[22px] h-[22px]", active && "text-primary")} aria-hidden />
        {t.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-surface border-t border-line px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center justify-around"
    >
      {tab(a)}
      {tab(b)}
      <Link
        href={newHref}
        aria-label="Novo agendamento"
        className="w-[52px] h-[52px] rounded-2xl bg-primary text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
      >
        <Plus className="w-6 h-6" aria-hidden />
      </Link>
      {tab(c)}
      <button
        type="button"
        onClick={onOpenMenu}
        className="w-16 min-h-11 flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-3"
      >
        <Menu className="w-[22px] h-[22px]" aria-hidden />
        Menu
      </button>
    </nav>
  );
}
