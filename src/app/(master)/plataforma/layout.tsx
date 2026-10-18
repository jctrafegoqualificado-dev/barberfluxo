"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CreditCard, MessageCircle, Layers, LayoutDashboard, LogOut, Scissors, Store, Users, Workflow } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";
import { cn, getInitials } from "@/lib/utils";

type Item = { href: string; label: string; icon: typeof Store; exact?: boolean };
const GROUPS: { label: string | null; items: Item[] }[] = [
  { label: null, items: [
    { href: "/plataforma", label: "Painel", icon: LayoutDashboard, exact: true },
    { href: "/plataforma/clientes", label: "Barbearias", icon: Store },
  ] },
  { label: "Dinheiro", items: [
    { href: "/plataforma/pagamentos", label: "Pagamentos", icon: CreditCard },
    { href: "/plataforma/planos", label: "Planos e preços", icon: Layers },
  ] },
  { label: "Sistema", items: [
    { href: "/plataforma/automacoes", label: "Automações", icon: Workflow },
    { href: "/plataforma/equipe", label: "Equipe", icon: Users },
    { href: "/plataforma/configuracoes", label: "Contato e suporte", icon: MessageCircle },
  ] },
];

/** Plataforma (docs/design/Plataforma-desktop): menu escuro como o do painel, conteúdo claro. */
export default function MasterLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, clearAuth } = useAuthStore();
  const [crons, setCrons] = useState<{ ok: number; total: number } | null>(null);
  useTokenRefresh();

  const allowed = !!user && (user.role === "PLATFORM_ADMIN" || user.isPlatformAdmin);
  useEffect(() => {
    if (!user) router.push("/login");
    else if (!allowed) router.push("/painel");
  }, [user, allowed, router]);

  useEffect(() => {
    if (!allowed || !token) return;
    fetch("/api/plataforma/cron-health", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const jobs: { status: string }[] = d?.jobs ?? [];
        if (jobs.length) setCrons({ ok: jobs.filter((j) => j.status === "ok").length, total: jobs.length });
      })
      .catch(() => {});
  }, [allowed, token]);

  if (!allowed) return null;
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="min-h-screen flex bg-ground text-ink">
      <aside className="hidden lg:flex w-[248px] shrink-0 flex-col gap-[18px] bg-night text-night-muted px-3.5 py-5 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-1.5">
          <span className="w-10 h-10 rounded-[10px] bg-primary text-white flex items-center justify-center shrink-0"><Scissors className="w-5 h-5" aria-hidden /></span>
          <div className="flex flex-col min-w-0">
            <span className="font-display text-base font-bold text-white truncate">IA de Barbearia</span>
            <span className="text-xs">Plataforma · administração</span>
          </div>
        </div>
        {crons && (
          <Link href="/plataforma/automacoes" className="flex items-center justify-between gap-2.5 p-3 rounded-[10px] bg-night-2 border border-night-line">
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-xs"><span className={cn("w-[7px] h-[7px] rounded-full", crons.ok === crons.total ? "bg-[#4CC38A]" : "bg-[#F0776B]")} />Automações</span>
              <span className="text-sm font-semibold text-white">{crons.ok} de {crons.total} em dia</span>
            </span>
            <span className="text-xs font-semibold text-night-text">Ver</span>
          </Link>
        )}
        <nav aria-label="Menu da plataforma" className="flex-1 flex flex-col gap-3.5">
          {GROUPS.map((g) => (
            <div key={g.label ?? "main"} className="flex flex-col gap-0.5">
              {g.label && <span className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#8A8378]">{g.label}</span>}
              {g.items.map((it) => {
                const on = isActive(it.href, it.exact);
                const Icon = it.icon;
                return (
                  <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined}
                    className={cn("flex items-center gap-3 h-[38px] px-2.5 rounded-lg text-sm", on ? "bg-night-3 text-white font-semibold" : "text-night-text font-medium hover:bg-night-2")}>
                    <Icon className={cn("w-[18px] h-[18px]", on && "text-primary")} aria-hidden />{it.label}
                  </Link>
                );
              })}
            </div>
          ))}
          <Link href="/painel" className="mt-auto flex items-center gap-3 h-9 px-2.5 rounded-lg text-sm text-night-text hover:bg-night-2">
            <BarChart3 className="w-[18px] h-[18px]" aria-hidden />Ir para o painel da barbearia
          </Link>
        </nav>
        <div className="flex items-center gap-2.5 p-2.5 rounded-[10px] bg-night-2">
          <span className="w-8 h-8 rounded-full bg-night-3 text-white text-xs font-semibold flex items-center justify-center shrink-0">{getInitials(user.name)}</span>
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-[13px] font-semibold text-white truncate">{user.name}</span>
            <span className="text-xs">Administrador</span>
          </span>
          <button type="button" onClick={() => { clearAuth(); router.push("/login"); }} aria-label="Sair"
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-night-3 hover:text-white"><LogOut className="w-[18px] h-[18px]" aria-hidden /></button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <nav aria-label="Menu da plataforma" className="lg:hidden sticky top-0 z-30 bg-night flex gap-1.5 overflow-x-auto px-4 py-2.5">
          {GROUPS.flatMap((g) => g.items).map((it) => {
            const on = isActive(it.href, it.exact);
            return (
              <Link key={it.href} href={it.href} aria-current={on ? "page" : undefined}
                className={cn("h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap inline-flex items-center", on ? "bg-white text-ink" : "text-night-text")}>{it.label}</Link>
            );
          })}
        </nav>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-7">
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
