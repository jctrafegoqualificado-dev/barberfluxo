"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import NotificationBell from "@/components/layout/NotificationBell";
import CashWidget from "@/components/financeiro/CashWidget";
import {
  LayoutDashboard, Calendar, Users, UserCheck, Scissors, CreditCard,
  Package, Settings, LogOut, ChevronRight, ChevronDown, ChevronLeft,
  Layers, TrendingUp, Clock, Target, DollarSign, KanbanSquare, Menu, X,
  Crown, MessageSquare, Sparkles, Bell, Banknote, BarChart3, Wallet,
  Building2, Award, BookOpen, Activity
} from "lucide-react";
import { useState, useEffect } from "react";

// Acesso rápido — bloco acima de Cadastros
const ownerTopNavA = [
  { href: "/painel", label: "Dashboard", icon: LayoutDashboard },
  { href: "/painel/agendamentos", label: "Agendamentos", icon: Calendar },
];

// Análises — pouco acessados, agrupados
const ownerAnalisesNav = [
  { href: "/painel/ocupacao", label: "Ocupação", icon: Clock },
  { href: "/painel/metas", label: "Metas", icon: Target },
  { href: "/painel/kanban", label: "Kanban", icon: KanbanSquare },
];

// Links diretos abaixo de Análises
const ownerTopNavB = [
  { href: "/painel/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { href: "/painel/fidelidade", label: "Fidelidade", icon: Award },
];

// Cadastros — dados mestre / catálogo
const ownerCadastrosNav = [
  { href: "/painel/clientes", label: "Clientes", icon: Users },
  { href: "/painel/barbeiros", label: "Profissionais", icon: UserCheck },
  { href: "/painel/servicos", label: "Serviços", icon: Sparkles },
  { href: "/painel/produtos", label: "Produtos", icon: Package },
  { href: "/painel/planos", label: "Planos", icon: Layers },
];

// Gestão Financeira
const ownerFinanceNav = [
  { href: "/painel/financeiro", label: "Fluxo & POE", icon: TrendingUp },
  { href: "/painel/financeiro/indicadores", label: "Indicadores (BI)", icon: BarChart3 },
  { href: "/painel/assinaturas", label: "Assinantes", icon: CreditCard },
  { href: "/painel/comissoes", label: "Comissões", icon: DollarSign },
  { href: "/painel/fluxo-caixa", label: "Fluxo de Caixa", icon: Banknote },
];

// Configurações — sub-itens
const ownerConfigNav = [
  { href: "/painel/configuracoes", label: "Geral", icon: Settings },
  { href: "/painel/configuracoes/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/painel/configuracoes/lembretes", label: "Lembretes", icon: Bell },
];

const barberNav = [
  { href: "/barbeiro", label: "Minha Agenda", icon: Calendar },
  { href: "/barbeiro/producao", label: "Produção", icon: TrendingUp },
  { href: "/barbeiro/comissoes", label: "Comissões", icon: CreditCard },
  { href: "/barbeiro/assinaturas", label: "Assinantes", icon: Layers },
  { href: "/barbeiro/clientes", label: "Clientes", icon: Users },
  { href: "/barbeiro/tarefas", label: "Tarefas", icon: KanbanSquare },
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
  const [collapsed, setCollapsed] = useState(false);

  const cadastrosActive =
    pathname.startsWith("/painel/clientes") ||
    pathname.startsWith("/painel/barbeiros") ||
    pathname.startsWith("/painel/servicos") ||
    pathname.startsWith("/painel/produtos") ||
    pathname.startsWith("/painel/planos");

  const financeActive =
    pathname.startsWith("/painel/financeiro") ||
    pathname.startsWith("/painel/assinaturas") ||
    pathname.startsWith("/painel/comissoes") ||
    pathname.startsWith("/painel/fluxo-caixa");

  const analisesActive =
    pathname.startsWith("/painel/ocupacao") ||
    pathname.startsWith("/painel/metas") ||
    pathname.startsWith("/painel/kanban");

  const configActive = pathname.startsWith("/painel/configuracoes");

  const [analisesOpen, setAnalisesOpen] = useState(() =>
    pathname.startsWith("/painel/ocupacao") ||
    pathname.startsWith("/painel/metas") ||
    pathname.startsWith("/painel/kanban")
  );

  const [cadastrosOpen, setCadastrosOpen] = useState(() =>
    pathname.startsWith("/painel/clientes") ||
    pathname.startsWith("/painel/barbeiros") ||
    pathname.startsWith("/painel/servicos") ||
    pathname.startsWith("/painel/produtos") ||
    pathname.startsWith("/painel/planos")
  );

  const [financeOpen, setFinanceOpen] = useState(() =>
    pathname.startsWith("/painel/financeiro") ||
    pathname.startsWith("/painel/assinaturas") ||
    pathname.startsWith("/painel/comissoes") ||
    pathname.startsWith("/painel/fluxo-caixa")
  );

  const [configOpen, setConfigOpen] = useState(() =>
    pathname.startsWith("/painel/configuracoes")
  );

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      return !prev;
    });
  }

  function logout() {
    clearAuth();
    router.push("/login");
  }

  function navClick() {
    setMobileOpen(false);
  }

  const sidebarContent = (isDesktop: boolean) => (
    <aside className={cn(
      "flex flex-col h-full bg-zinc-900 text-white transition-all duration-300 ease-in-out",
      isDesktop && collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div
        className={cn(
          "flex items-center border-b border-zinc-800 min-h-[72px]",
          isDesktop && collapsed ? "px-0 py-5 justify-center cursor-pointer hover:bg-zinc-800 transition-colors" : "gap-3 px-4 py-5"
        )}
        onClick={isDesktop && collapsed ? toggleCollapsed : undefined}
        title={isDesktop && collapsed ? "Expandir menu" : undefined}
      >
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 overflow-hidden">
          {branding?.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <Scissors className="w-5 h-5 text-white" />
          )}
        </div>
        {(!isDesktop || !collapsed) && (
          <>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{branding?.name || "IaDeBarbearia"}</p>
              <p className="text-xs text-zinc-400 truncate">{user?.name}</p>
            </div>
            <div className="flex items-center gap-1">
              {user?.role === "OWNER" && <NotificationBell />}
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors md:hidden">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cash Widget — só quando expandido */}
      {(!isDesktop || !collapsed) && <CashWidget />}

      {/* Nav */}
      <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden", isDesktop && collapsed ? "px-2" : "px-3")}>
        {user?.role === "BARBER" ? (
          barberNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/barbeiro" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={navClick}
                title={isDesktop && collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isDesktop && collapsed && "justify-center px-0",
                  active
                    ? "bg-amber-500 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {(!isDesktop || !collapsed) && <span className="flex-1">{label}</span>}
                {(!isDesktop || !collapsed) && active && <ChevronRight className="w-4 h-4" />}
              </Link>
            );
          })
        ) : (
          <>
            {/* Dashboard + Agendamentos */}
            {ownerTopNavA.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/painel" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={navClick}
                  title={isDesktop && collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isDesktop && collapsed && "justify-center px-0",
                    active
                      ? "bg-primary text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {(!isDesktop || !collapsed) && <span className="flex-1">{label}</span>}
                  {(!isDesktop || !collapsed) && active && <ChevronRight className="w-4 h-4" />}
                </Link>
              );
            })}

            {/* Cadastros */}
            {isDesktop && collapsed ? (
              <Link
                href="/painel/clientes"
                title="Cadastros"
                className={cn(
                  "flex justify-center items-center px-0 py-2.5 rounded-lg transition-colors",
                  cadastrosActive ? "text-amber-400 bg-zinc-800/50" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                <BookOpen className="w-4 h-4" />
              </Link>
            ) : (
              <div>
                <button
                  onClick={() => setCadastrosOpen(!cadastrosOpen)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800",
                    cadastrosActive && "text-amber-400 font-semibold bg-zinc-800/30"
                  )}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Cadastros</span>
                  {cadastrosOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </button>
                {cadastrosOpen && (
                  <div className="mt-1 pl-4 space-y-1 border-l border-zinc-800 ml-5">
                    {ownerCadastrosNav.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(href + "/");
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={navClick}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 text-left">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Análises */}
            {isDesktop && collapsed ? (
              <Link
                href="/painel/ocupacao"
                title="Análises"
                className={cn(
                  "flex justify-center items-center px-0 py-2.5 rounded-lg transition-colors",
                  analisesActive ? "text-amber-400 bg-zinc-800/50" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                <Activity className="w-4 h-4" />
              </Link>
            ) : (
              <div>
                <button
                  onClick={() => setAnalisesOpen(!analisesOpen)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800",
                    analisesActive && "text-amber-400 font-semibold bg-zinc-800/30"
                  )}
                >
                  <Activity className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Análises</span>
                  {analisesOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </button>
                {analisesOpen && (
                  <div className="mt-1 pl-4 space-y-1 border-l border-zinc-800 ml-5">
                    {ownerAnalisesNav.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href || pathname.startsWith(href + "/");
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={navClick}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 text-left">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* WhatsApp + Fidelidade */}
            {ownerTopNavB.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={navClick}
                  title={isDesktop && collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isDesktop && collapsed && "justify-center px-0",
                    active
                      ? "bg-primary text-white"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {(!isDesktop || !collapsed) && <span className="flex-1">{label}</span>}
                  {(!isDesktop || !collapsed) && active && <ChevronRight className="w-4 h-4" />}
                </Link>
              );
            })}

            {/* Gestão Financeira */}
            {isDesktop && collapsed ? (
              <Link
                href="/painel/financeiro"
                title="Gestão Financeira"
                className={cn(
                  "flex justify-center items-center px-0 py-2.5 rounded-lg transition-colors",
                  financeActive ? "text-amber-400 bg-zinc-800/50" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                <Wallet className="w-4 h-4" />
              </Link>
            ) : (
              <div>
                <button
                  onClick={() => setFinanceOpen(!financeOpen)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800",
                    financeActive && "text-amber-400 font-semibold bg-zinc-800/30"
                  )}
                >
                  <Wallet className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Gestão Financeira</span>
                  {financeOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </button>
                {financeOpen && (
                  <div className="mt-1 pl-4 space-y-1 border-l border-zinc-800 ml-5">
                    {ownerFinanceNav.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href || (href !== "/painel/financeiro" && pathname.startsWith(href));
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={navClick}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 text-left">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Meu Negócio */}
            <Link
              href="/painel/meu-negocio"
              onClick={navClick}
              title={isDesktop && collapsed ? "Meu Negócio" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isDesktop && collapsed && "justify-center px-0",
                pathname === "/painel/meu-negocio"
                  ? "bg-primary text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              {(!isDesktop || !collapsed) && <span className="flex-1">Meu Negócio</span>}
              {(!isDesktop || !collapsed) && pathname === "/painel/meu-negocio" && <ChevronRight className="w-4 h-4" />}
            </Link>

            {/* Configurações */}
            {isDesktop && collapsed ? (
              <Link
                href="/painel/configuracoes"
                title="Configurações"
                className={cn(
                  "flex justify-center items-center px-0 py-2.5 rounded-lg transition-colors",
                  configActive ? "text-amber-400 bg-zinc-800/50" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                )}
              >
                <Settings className="w-4 h-4" />
              </Link>
            ) : (
              <div>
                <button
                  onClick={() => setConfigOpen(!configOpen)}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-zinc-400 hover:text-white hover:bg-zinc-800",
                    configActive && "text-amber-400 font-semibold bg-zinc-800/30"
                  )}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">Configurações</span>
                  {configOpen ? (
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </button>
                {configOpen && (
                  <div className="mt-1 pl-4 space-y-1 border-l border-zinc-800 ml-5">
                    {ownerConfigNav.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={navClick}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="flex-1 text-left">{label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Minha Assinatura */}
            <Link
              href="/painel/assinatura"
              onClick={navClick}
              title={isDesktop && collapsed ? "Minha Assinatura" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isDesktop && collapsed && "justify-center px-0",
                pathname === "/painel/assinatura"
                  ? "bg-primary text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <Crown className="w-4 h-4 shrink-0" />
              {(!isDesktop || !collapsed) && <span className="flex-1">Minha Assinatura</span>}
              {(!isDesktop || !collapsed) && pathname === "/painel/assinatura" && <ChevronRight className="w-4 h-4" />}
            </Link>
          </>
        )}
      </nav>

      {/* Footer: recolher (desktop) + sair */}
      <div className={cn("py-3 border-t border-zinc-800 space-y-1", isDesktop && collapsed ? "px-2" : "px-3")}>
        {isDesktop && (
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className={cn(
              "hidden md:flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span>Recolher menu</span>
              </>
            )}
          </button>
        )}
        <button
          onClick={logout}
          title={isDesktop && collapsed ? "Sair" : undefined}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors",
            isDesktop && collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {(!isDesktop || !collapsed) && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Hamburguer — mobile */}
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

      {/* Sidebar mobile (drawer — sempre w-64) */}
      <div className={cn(
        "md:hidden fixed inset-y-0 left-0 z-50 transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {sidebarContent(false)}
      </div>

      {/* Sidebar desktop (fixa, colapsável) */}
      <div className="hidden md:flex min-h-screen">
        {sidebarContent(true)}
      </div>
    </>
  );
}
