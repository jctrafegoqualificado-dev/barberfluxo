"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import BarbeariasLista, { type ShopRow } from "@/components/plataforma/BarbeariasLista";

interface Painel {
  updatedAt: string;
  kpis: {
    mrr: number; paying: number; avgFee: number; receivedThisMonth: number; paymentsThisMonth: number; lastMonthReceived: number;
    atrasadas: number; carencia: number; novos30: number; novos30Pagaram: number;
  };
  receivedByMonth: { month: string; value: number; count: number }[];
  weeks: { start: string; cadastros: number; primeiroPagamento: number }[];
  planMix: { key: string; label: string; count: number; value: number }[];
  annualCount: number; avgTenureMonths: number; ltv: number;
  alerts: { tone: "danger" | "warning" | "info"; shopId: string; title: string; sub: string; action: string }[];
  shops: ShopRow[];
}

const monthShort = (m: string) => new Date(m + "-15T12:00:00Z").toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
const monthLong = (m: string) => new Date(m + "-15T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
const TONE = { danger: "bg-danger", warning: "bg-warning", info: "bg-ink-4" };

export default function PlataformaPainel() {
  const { token } = useAuthStore();
  const [d, setD] = useState<Painel | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/plataforma/painel", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error();
      setD(await r.json());
    } catch {
      setError(true);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const header = (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Painel da plataforma</h1>
      <span className="text-sm text-ink-3">
        Todas as barbearias que usam o sistema{d ? ` · atualizado às ${new Date(d.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}` : ""}
      </span>
    </header>
  );
  if (error) return <div className="flex flex-col gap-5">{header}<p role="alert" className="rounded-2xl bg-danger-soft text-danger px-5 py-4 text-sm">Não foi possível carregar o painel. <button type="button" className="font-semibold underline" onClick={() => { setError(false); load(); }}>Tentar de novo</button></p></div>;
  if (!d) return <div className="flex flex-col gap-5">{header}<div className="h-44 rounded-2xl bg-surface border border-line animate-pulse" /><div className="h-72 rounded-2xl bg-surface border border-line animate-pulse" /></div>;

  const k = d.kpis;
  const maxMonth = Math.max(...d.receivedByMonth.map((m) => m.value), 1);
  const thisMonth = d.receivedByMonth[d.receivedByMonth.length - 1];
  const diff = k.receivedThisMonth - k.lastMonthReceived;
  const maxWeek = Math.max(...d.weeks.map((w) => Math.max(w.cadastros, w.primeiroPagamento)), 1);
  const totalMix = d.planMix.reduce((s, p) => s + p.value, 0) || 1;
  const mixColors = ["bg-ink", "bg-primary"];

  return (
    <div className="flex flex-col gap-5">
      {header}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <section aria-labelledby="mrr-t" className="rounded-2xl bg-[#1B1916] text-white p-5 flex gap-5 justify-between">
          <div className="flex flex-col gap-1.5 min-w-0">
            <h2 id="mrr-t" className="text-xs font-semibold tracking-[0.06em] uppercase text-[#C9C2B6]">Recebe por mês</h2>
            <span className="font-display text-[36px] font-bold tracking-[-0.02em] leading-none">{formatCurrency(k.mrr)}</span>
            <span className="text-[13px] text-[#C9C2B6]">{k.paying} {k.paying === 1 ? "barbearia pagando" : "barbearias pagando"} · média de {formatCurrency(k.avgFee)}</span>
          </div>
          <div aria-label="Recebido nos últimos 6 meses" className="flex items-end gap-1.5 h-[96px] shrink-0">
            {d.receivedByMonth.map((m, i) => (
              <div key={m.month} className="flex flex-col items-center gap-1 w-7">
                <div title={`${monthLong(m.month)}: ${formatCurrency(m.value)}`} className={cn("w-full rounded-t", i === d.receivedByMonth.length - 1 ? "bg-primary" : "bg-night-3")} style={{ height: Math.max(4, (m.value / maxMonth) * 72) }} />
                <span className="text-[10px] text-[#A8A196]">{monthShort(m.month)}</span>
              </div>
            ))}
          </div>
        </section>
        {[
          { label: `Recebido em ${monthLong(thisMonth.month)}`, value: formatCurrency(k.receivedThisMonth), sub: `${k.paymentsThisMonth} ${k.paymentsThisMonth === 1 ? "pagamento confirmado" : "pagamentos confirmados"}${k.lastMonthReceived ? ` · ${diff >= 0 ? "+" : "−"}${formatCurrency(Math.abs(diff))} vs mês passado` : ""}` },
          { label: "Atrasadas", value: String(k.atrasadas + k.carencia), sub: `${k.carencia} na carência · ${k.atrasadas} com acesso pausado`, danger: k.atrasadas + k.carencia > 0 },
          { label: "Cadastros que pagaram", value: k.novos30 ? `${Math.round((k.novos30Pagaram / k.novos30) * 100)}%` : "—", sub: `${k.novos30Pagaram} de ${k.novos30} cadastros dos últimos 30 dias` },
        ].map((c) => (
          <div key={c.label} className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-[13px] text-ink-2">{c.label}</span>
            <span className={cn("font-display text-[28px] font-bold tracking-[-0.02em] leading-tight", c.danger && "text-danger")}>{c.value}</span>
            <span className="text-xs text-ink-3">{c.sub}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section aria-labelledby="cresc-t" className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <h2 id="cresc-t" className="text-[15px] font-semibold">Cadastros e primeiros pagamentos</h2>
            <span className="text-xs text-ink-3">8 semanas</span>
          </div>
          <div className="flex items-end gap-2 h-[120px]">
            {d.weeks.map((w) => (
              <div key={w.start} className="flex-1 flex items-end gap-0.5 h-full" title={`Semana de ${new Date(w.start).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}: ${w.cadastros} cadastros, ${w.primeiroPagamento} pagaram pela 1ª vez`}>
                <div className="flex-1 rounded-t bg-bar" style={{ height: `${Math.max(3, (w.cadastros / maxWeek) * 100)}%` }} />
                <div className="flex-1 rounded-t bg-ink" style={{ height: `${Math.max(3, (w.primeiroPagamento / maxWeek) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-2 pt-2 border-t border-line-2">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-bar" />Cadastros {d.weeks.reduce((s, w) => s + w.cadastros, 0)}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-ink" />Pagaram pela 1ª vez {d.weeks.reduce((s, w) => s + w.primeiroPagamento, 0)}</span>
          </div>
        </section>

        <section aria-labelledby="planos-t" className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex justify-between items-baseline">
            <h2 id="planos-t" className="text-[15px] font-semibold">Planos de quem paga</h2>
            <span className="text-xs text-ink-3">{k.paying} {k.paying === 1 ? "barbearia" : "barbearias"}</span>
          </div>
          <div aria-hidden className="flex h-3 rounded-full overflow-hidden bg-surface-2">
            {d.planMix.map((p, i) => <div key={p.key} className={mixColors[i]} style={{ width: `${(p.value / totalMix) * 100}%` }} />)}
          </div>
          <div className="flex flex-col text-sm">
            {d.planMix.map((p, i) => (
              <div key={p.key} className="flex items-center gap-2 min-h-[34px] border-b border-line-2">
                <span className={cn("w-2.5 h-2.5 rounded-sm", mixColors[i])} />
                <span className="flex-1">{p.label} <span className="text-ink-3">· {p.count}</span></span>
                <strong className="font-semibold">{formatCurrency(p.value)}</strong>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-auto">
            {[["Pagam anual", String(d.annualCount)], ["Ficam em média", `${d.avgTenureMonths} meses`], ["Pagam no total", formatCurrency(d.ltv)]].map(([a, b]) => (
              <div key={a} className="flex flex-col gap-0.5 p-2.5 rounded-[10px] bg-ground">
                <span className="text-xs text-ink-3">{a}</span>
                <span className="text-sm font-semibold">{b}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="atencao-t" className="bg-surface border border-line rounded-2xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-baseline px-5 pt-5 pb-3">
            <h2 id="atencao-t" className="text-[15px] font-semibold">Precisa de atenção</h2>
            <span className="text-xs text-ink-3">{d.alerts.length} {d.alerts.length === 1 ? "item" : "itens"}</span>
          </div>
          {d.alerts.length === 0 && <p className="px-5 pb-5 text-[13px] text-ink-3">Nada pedindo atenção agora.</p>}
          <div className="max-h-[260px] overflow-y-auto">
            {d.alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 border-t border-line-2">
                <span className={cn("w-2 h-2 rounded-full shrink-0", TONE[a.tone])} />
                <div className="flex-1 min-w-0 flex flex-col">
                  <span className="text-[13px] font-semibold leading-snug">{a.title}</span>
                  <span className="text-xs text-ink-3">{a.sub}</span>
                </div>
                <Link href={`/plataforma/clientes/${a.shopId}`} className="h-8 px-3 rounded-lg border border-control text-xs font-semibold flex items-center hover:bg-surface-2">{a.action}</Link>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-0.5 pt-1">
        <h2 className="text-[19px] font-semibold">Barbearias</h2>
        <span className="text-[13px] text-ink-3">Clique numa barbearia para ver assinatura, pagamentos e uso</span>
      </div>
      <BarbeariasLista shops={d.shops} />
    </div>
  );
}
