"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";

/** Avisa o atalho do menu que o caixa mudou (abrir, fechar, lançamento). */
export const CASH_CHANGED = "caixa:mudou";

/**
 * Atalho do caixa no menu: aberto/fechado e quanto entrou. Tudo (abrir, retirar,
 * fechar) acontece na tela do Caixa — a conta é uma só (src/lib/cashSummary.ts).
 */
export default function CashWidget() {
  const { token, user } = useAuthStore();
  const pathname = usePathname();
  const [state, setState] = useState<{ open: boolean; totalIn: number } | null>(null);

  useEffect(() => {
    if (user?.role !== "OWNER" || !token) return;
    let alive = true;
    const load = () =>
      fetch("/api/barbershop/cashflow", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) setState({ open: d.session?.status === "OPEN", totalIn: d.totalIn ?? 0 }); })
        .catch(() => {});
    load();
    window.addEventListener(CASH_CHANGED, load);
    return () => { alive = false; window.removeEventListener(CASH_CHANGED, load); };
  }, [user, token, pathname]);

  if (user?.role !== "OWNER" || !state) return null;

  return (
    <div className="px-3.5 pb-1">
      <Link href={state.open ? "/painel/fluxo-caixa#fechar" : "/painel/fluxo-caixa"}
        className="w-full flex items-center justify-between gap-2.5 p-3 rounded-[10px] bg-night-2 border border-night-line hover:border-night-muted/40 transition-colors">
        <span className="flex flex-col gap-0.5 min-w-0">
          <span className="flex items-center gap-1.5 text-xs text-night-muted">
            <span className={`w-[7px] h-[7px] rounded-full ${state.open ? "bg-[#4CC38A]" : "bg-danger-strong"}`} aria-hidden />
            {state.open ? "Caixa aberto" : "Caixa fechado"}
          </span>
          {state.open && <span className="text-[17px] font-semibold text-white truncate">{formatCurrency(state.totalIn)}</span>}
        </span>
        <span className="shrink-0 h-8 px-2.5 inline-flex items-center rounded-lg border border-[#3A352F] text-xs font-semibold text-[#E9E4DA]">
          {state.open ? "Fechar" : "Abrir"}
        </span>
      </Link>
    </div>
  );
}
