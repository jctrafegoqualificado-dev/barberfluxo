"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import NotificationBell from "@/components/layout/NotificationBell";
import CashWidget from "@/components/financeiro/CashWidget";
import BottomNav from "@/components/layout/BottomNav";
import {
  LayoutDashboard, Calendar, Users, UserCheck, Scissors, CreditCard,
  Package, Settings, LogOut, ChevronRight, ChevronLeft,
  Layers, TrendingUp, Clock, Target, KanbanSquare, X,
  Crown, MessageSquare, Bell, Banknote, BarChart3, Wallet,
  Award, Bot, Megaphone, Palette,
} from "lucide-react";
import { useState, useEffect, type ElementType } from "react";

type NavItem = { href: string; label: string; icon: ElementType; exact?: boolean };
type NavGroup = { label?: string; items: NavItem[] };

// Menu do dono — grupos sempre visíveis (sem sanfona), como no redesign (docs/design/Main.dc.html)
const ownerGroups: NavGroup[] = [
  {
    items: [
      { href: "/painel", label: "Início", icon: LayoutDashboard, exact: true },
      { href: "/painel/agendamentos", label: "Agenda", icon: Calendar },
      { href: "/painel/whatsapp", label: "WhatsApp", icon: MessageSquare },
    ],
  },
  {
    label: "Clientes",
    items: [
      { href: "/painel/clientes", label: "Clientes", icon: Users },
      { href: "/painel/assinaturas", label: "Assinantes", icon: Crown },
      { href: "/painel/fidelidade", label: "Fidelidade", icon: Award },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/painel/barbeiros", label: "Profissionais", icon: UserCheck },
      { href: "/painel/servicos", label: "Serviços", icon: Scissors },
      { href: "/painel/produtos", label: "Produtos", icon: Package },
      { href: "/painel/planos", label: "Planos", icon: Layers },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { href: "/painel/fluxo-caixa", label: "Caixa", icon: Banknote },
      { href: "/painel/financeiro", label: "Resultado do mês", icon: Wallet, exact: true },
      { href: "/painel/comissoes", label: "Comissões", icon: CreditCard },
      { href: "/painel/financeiro/indicadores", label: "Indicadores", icon: BarChart3 },
    ],
  },
  {
    label: "Equipe e crescimento",
    items: [
      { href: "/painel/ocupacao", label: "Ocupação", icon: Clock },
      { href: "/painel/metas", label: "Metas", icon: Target },
      { href: "/painel/kanban", label: "Tarefas", icon: KanbanSquare },
      { href: "/painel/recados", label: "Recados", icon: Megaphone },
    ],
  },
];

// "Meu negócio" saiu do menu: logo, cores e contato ficam em Configurações → Marca (decisão A).
const ownerFooter: NavItem[] = [
  { href: "/painel/configuracoes", label: "Configurações", icon: Settings, exact: true },
];

const ownerConfigSubnav: NavItem[] = [
  { href: "/painel/configuracoes/marca", label: "Marca", icon: Palette },
  { href: "/painel/configuracoes/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/painel/configuracoes/lembretes", label: "Lembretes", icon: Bell },
  { href: "/painel/configuracoes/assistente-ia", label: "Atendente de IA", icon: Bot },
];

const barberNav: NavItem[] = [
  { href: "/barbeiro", label: "Minha agenda", icon: Calendar, exact: true },
  { href: "/barbeiro/producao", label: "Ganhos", icon: TrendingUp },
  { href: "/barbeiro/comissoes", label: "Comissões", icon: CreditCard },
  { href: "/barbeiro/assinaturas", label: "Assinantes", icon: Layers },
  { href: "/barbeiro/clientes", label: "Clientes", icon: Users },
  { href: "/barbeiro/tarefas", label: "Tarefas", icon: KanbanSquare },
];

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

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
  const [collapsed, setCollapsed] = useState(false);
  const isOwner = user?.role !== "BARBER";

  useEffect(() => {
    try {
      if (localStorage.getItem("sidebar-collapsed") === "true") setCollapsed(true);
    } catch { /* armazenamento indisponível: começa expandido */ }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      try { localStorage.setItem("sidebar-collapsed", String(!prev)); } catch { /* ignora */ }
      return !prev;
    });
  }

  function logout() {
    clearAuth();
    router.push("/login");
  }

  const sidebarContent = (isDesktop: boolean) => {
    const compact = isDesktop && collapsed;

    const renderItem = (item: NavItem, small = false) => {
      const active = isActive(pathname, item);
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          title={compact ? item.label : undefined}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg text-sm transition-colors",
            small ? "h-8 px-2.5 text-[13px]" : "h-9 px-2.5",
            compact && "justify-center px-0",
            active
              ? "bg-night-3 text-white font-semibold"
              : "text-night-text font-medium hover:bg-night-2 hover:text-white"
          )}
        >
          <Icon className={cn("shrink-0", small ? "w-4 h-4" : "w-[18px] h-[18px]", active && "text-primary")} />
          {!compact && <span className="flex-1 truncate">{item.label}</span>}
        </Link>
      );
    };

    return (
      <aside
        className={cn(
          "flex flex-col h-full bg-night text-night-muted transition-all duration-300 ease-in-out",
          compact ? "w-16" : "w-64"
        )}
      >
        {/* Marca */}
        <div
          className={cn(
            "flex items-center min-h-[72px]",
            compact ? "justify-center px-0 cursor-pointer hover:bg-night-2" : "gap-3 px-4"
          )}
          onClick={compact ? toggleCollapsed : undefined}
          title={compact ? "Expandir menu" : undefined}
        >
          <div className="w-10 h-10 rounded-[10px] bg-primary flex items-center justify-center shrink-0 overflow-hidden">
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Scissors className="w-5 h-5 text-white" aria-hidden />
            )}
          </div>
          {!compact && (
            <>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base font-bold text-white truncate">
                  {branding?.name || "IA de Barbearia"}
                </p>
                {isOwner ? (
                  <Link href="/painel/assinatura" className="block text-xs text-night-muted hover:text-white truncate">
                    Minha assinatura
                  </Link>
                ) : (
                  <p className="text-xs text-night-muted truncate">Área do profissional</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {user?.role === "OWNER" && <NotificationBell />}
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fechar menu"
                  className="p-1.5 rounded-lg hover:bg-night-2 transition-colors md:hidden"
                >
                  <X className="w-4 h-4 text-night-muted" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Caixa — só dono e só expandido */}
        {isOwner && !compact && <CashWidget />}

        {/* Navegação */}
        <nav
          aria-label="Menu principal"
          className={cn("flex-1 py-3 flex flex-col gap-4 overflow-y-auto overflow-x-hidden", compact ? "px-2" : "px-3")}
        >
          {isOwner ? (
            ownerGroups.map((group, gi) => (
              <div key={gi} className="flex flex-col gap-0.5">
                {group.label && !compact && (
                  <span className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-4">
                    {group.label}
                  </span>
                )}
                {group.label && compact && gi > 0 && <div className="mx-2 my-1 border-t border-night-line" />}
                {group.items.map((item) => renderItem(item))}
              </div>
            ))
          ) : (
            <div className="flex flex-col gap-0.5">{barberNav.map((item) => renderItem(item))}</div>
          )}
        </nav>

        {/* Rodapé */}
        <div className={cn("py-3 border-t border-night-line flex flex-col gap-0.5", compact ? "px-2" : "px-3")}>
          {isOwner && (
            <>
              {ownerFooter.map((item) => renderItem(item))}
              {!compact && pathname.startsWith("/painel/configuracoes") && (
                <div className="ml-5 pl-3 border-l border-night-line flex flex-col gap-0.5">
                  {ownerConfigSubnav.map((item) => renderItem(item, true))}
                </div>
              )}
            </>
          )}

          <div className={cn("mt-2 flex items-center gap-2.5 rounded-[10px] bg-night-2", compact ? "flex-col p-1.5" : "p-2.5")}>
            {!compact && (
              <>
                <div className="w-8 h-8 rounded-full bg-night-3 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                  {(user?.name || "?").split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-xs text-night-muted">{isOwner ? "Dono" : "Profissional"}</p>
                </div>
              </>
            )}
            {isDesktop && (
              <button
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                title={collapsed ? "Expandir menu" : "Recolher menu"}
                className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg text-night-muted hover:bg-night-3 hover:text-white transition-colors"
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={logout}
              aria-label="Sair"
              title="Sair"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-night-muted hover:bg-night-3 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  };

  return (
    <>
      {/* Overlay — celular */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setMobileOpen(false)} />
      )}

      {/* Menu completo no celular (aberto pelo "Menu" da barra inferior) */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        // inert (e não aria-hidden): fechado, nada lá dentro recebe foco nem toque
        inert={!mobileOpen}
      >
        {sidebarContent(false)}
      </div>

      {/* Menu lateral — computador (fixo, recolhível) */}
      <div className="hidden md:flex sticky top-0 h-screen shrink-0">
        {sidebarContent(true)}
      </div>

      {/* Barra inferior — celular */}
      <BottomNav isOwner={isOwner} onOpenMenu={() => setMobileOpen(true)} />
    </>
  );
}
