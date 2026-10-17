"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { parseMoney } from "@/lib/finance";
import type { MonthResult, MonthMove } from "@/lib/monthResult";

type Data = MonthResult & {
  isCurrent: boolean;
  prev: { month: string; sobrou: number; entrou: number; despesas: number };
  cash: { open: boolean; totalIn: number; drawer: number };
};
type Tab = "all" | "in" | "out" | "pending";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brl = (v: number) => formatCurrency(v).replace(",00", "");
const brl2 = (v: number) => formatCurrency(v);
const monthLabel = (m: string) => { const [y, mm] = m.split("-").map(Number); return `${MONTHS[mm - 1]} de ${y}`; };
const monthName = (m: string) => MONTHS[Number(m.split("-")[1]) - 1];
const shiftMonth = (m: string, d: number) => {
  const [y, mm] = m.split("-").map(Number);
  const t = new Date(Date.UTC(y, mm - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
};
const thisMonth = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
const spDay = (iso: string) => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
function whenLabel(iso: string) {
  const d = spDay(iso);
  if (d === spDay(new Date().toISOString())) {
    return `Hoje, ${new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`;
  }
  const [, m, day] = d.split("-");
  return `${Number(day)} ${MONTHS_SHORT[Number(m) - 1]}`;
}
function dueNote(iso: string | null, recurring: boolean) {
  if (!iso) return recurring ? "recorrente" : "sem vencimento";
  const days = Math.round((new Date(spDay(iso) + "T12:00:00Z").getTime() - new Date(spDay(new Date().toISOString()) + "T12:00:00Z").getTime()) / 86_400_000);
  const when = days < 0 ? `venceu há ${-days} ${days === -1 ? "dia" : "dias"}` : days === 0 ? "vence hoje" : `vence em ${days} ${days === 1 ? "dia" : "dias"}`;
  return recurring ? `${when} · recorrente` : when;
}

const STATUS: Record<MonthMove["status"], [string, string]> = {
  RECEIVED: ["Recebido", "bg-positive-soft text-positive"],
  PAID: ["Pago", "bg-surface-3 text-ink-2"],
  PENDING: ["A pagar", "bg-warning-soft text-warning"],
  OVERDUE: ["Atrasada", "bg-danger-soft text-danger"],
};

export default function ResultadoDoMesPage() {
  const { token } = useAuthStore();
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [limit, setLimit] = useState(15);
  const [adding, setAdding] = useState(false);
  const [remove, setRemove] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/barbershop/financeiro/resultado?month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setData(await r.json());
  }, [month, token]);

  useEffect(() => { load(); }, [load]);

  async function markPaid(id: string) {
    const r = await fetch("/api/barbershop/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status: "PAID" }),
    });
    if (r.ok) { toast.success("Conta marcada como paga"); load(); } else toast.error("Não foi possível marcar como paga.");
  }

  async function removeExpense(id: string) {
    setRemove(null);
    const r = await fetch(`/api/barbershop/expenses?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) load(); else toast.error("Não foi possível excluir.");
  }

  async function exportCsv() {
    const r = await fetch(`/api/barbershop/financeiro/export?month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { toast.error("Não foi possível gerar a planilha."); return; }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `financeiro_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const moves = useMemo(() => {
    if (!data) return [];
    return data.moves.filter((m) =>
      tab === "all" ? true : tab === "pending" ? m.status === "PENDING" || m.status === "OVERDUE"
        : tab === "in" ? m.dir === "in" : m.dir === "out" && m.status === "PAID");
  }, [data, tab]);

  const canNext = month < thisMonth();

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Resultado do mês</h1>
          <span className="text-sm text-ink-3">Quanto entrou, para onde foi e quanto sobrou</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center h-[42px] rounded-[10px] border border-control bg-surface">
            <button type="button" onClick={() => { setMonth(shiftMonth(month, -1)); setLimit(15); }} aria-label="Mês anterior" className="w-10 h-full flex items-center justify-center hover:bg-surface-3 rounded-l-[10px]">
              <ChevronLeft className="w-4 h-4" aria-hidden />
            </button>
            <span className="px-2 text-sm font-semibold capitalize min-w-[150px] text-center">{monthLabel(month)}</span>
            <button type="button" onClick={() => { setMonth(shiftMonth(month, 1)); setLimit(15); }} disabled={!canNext} aria-label="Próximo mês" className="w-10 h-full flex items-center justify-center hover:bg-surface-3 rounded-r-[10px] disabled:opacity-30">
              <ChevronRight className="w-4 h-4" aria-hidden />
            </button>
          </div>
          <button type="button" onClick={exportCsv} className="hidden md:inline-flex h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold items-center gap-2 hover:bg-surface-3">
            <Download className="w-4 h-4" aria-hidden /> Exportar planilha
          </button>
          <button type="button" onClick={() => setAdding(true)} className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
            <Plus className="w-4 h-4" aria-hidden /> Lançar despesa
          </button>
        </div>
      </header>

      {!data ? (
        <div className="flex flex-col gap-5 animate-pulse" aria-busy>
          <div className="h-40 rounded-2xl bg-surface-2" /><div className="h-56 rounded-2xl bg-surface-2" />
        </div>
      ) : (
        <>
          <Hero data={data} />
          <Flow data={data} />

          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <Bills data={data} onPaid={markPaid} />
            <div className="flex flex-col gap-5">
              <Categories data={data} />
              {data.commissionBarbers.length > 0 && (
                <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-[15px] font-semibold">Comissões de {monthName(month)}</h2>
                    <Link href="/painel/comissoes" className="text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline">Ver comissões</Link>
                  </div>
                  <p className="font-display text-2xl font-bold">{brl(data.comissoesAPagar)} <span className="text-[13px] font-normal text-ink-3">a pagar</span></p>
                  <p className="text-[13px] text-ink-3">{data.commissionBarbers.map((b) => `${b.name.split(" ")[0]} ${brl(b.value)}`).join(" · ")}</p>
                </section>
              )}
            </div>
          </div>

          {/* Movimentações */}
          <section className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 flex-wrap px-5 pt-4 pb-3 border-b border-line-2">
              <h2 className="text-[15px] font-semibold">Movimentações</h2>
              <div role="tablist" aria-label="Filtrar movimentações" className="flex p-1 rounded-[10px] bg-surface-3">
                {([["all", "Todas"], ["in", "Entradas"], ["out", "Saídas"], ["pending", "A pagar"]] as const).map(([k, l]) => (
                  <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => { setTab(k); setLimit(15); }}
                    className={cn("h-8 px-3 rounded-lg text-[13px] font-semibold", tab === k ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            {moves.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-3">Nada por aqui neste mês.</p>
            ) : (
              <>
                <div className="hidden md:grid grid-cols-[110px_minmax(0,1fr)_minmax(0,0.8fr)_100px_120px_36px] gap-3 px-5 py-2.5 text-xs font-semibold text-ink-3 border-b border-line-2">
                  <span>Quando</span><span>Descrição</span><span>Forma de pagamento</span><span>Situação</span><span className="text-right">Valor</span><span />
                </div>
                <ul className="divide-y divide-line-3">
                  {moves.slice(0, limit).map((m) => (
                    <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[110px_minmax(0,1fr)_minmax(0,0.8fr)_100px_120px_36px] gap-x-3 gap-y-0.5 items-center px-5 py-2.5 min-h-[56px]">
                      <span className="hidden md:block text-[13px] text-ink-2">{whenLabel(m.date)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{m.desc}</p>
                        <p className="text-xs text-ink-3 truncate"><span className="md:hidden">{whenLabel(m.date)} · </span>{m.sub}</p>
                      </div>
                      <span className="hidden md:block text-[13px] text-ink-2 truncate">{m.method}</span>
                      <span className="hidden md:block"><span className={cn("h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center", STATUS[m.status][1])}>{STATUS[m.status][0]}</span></span>
                      <span className={cn("text-sm font-semibold text-right", m.dir === "in" ? "text-positive" : "text-ink")}>
                        {m.dir === "in" ? "+ " : "− "}{brl2(m.amount)}
                      </span>
                      <span className="hidden md:flex justify-end">
                        {m.id.startsWith("x_") && (
                          <button type="button" onClick={() => setRemove({ id: m.id.slice(2), name: m.desc })} aria-label={`Excluir ${m.desc}`}
                            className="w-8 h-8 rounded-lg text-ink-4 hover:bg-surface-3 hover:text-danger flex items-center justify-center">
                            <Trash2 className="w-4 h-4" aria-hidden />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {moves.length > limit && (
                  <button type="button" onClick={() => setLimit(moves.length)} className="w-full h-11 border-t border-line-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-3">
                    Ver as {moves.length} movimentações de {monthName(month)}
                  </button>
                )}
              </>
            )}
          </section>
        </>
      )}

      {adding && <DespesaModal month={month} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
      <ConfirmDialog isOpen={!!remove} title="Excluir despesa?" message={remove ? `“${remove.name}” sai do financeiro.` : ""}
        confirmLabel="Excluir" onConfirm={() => remove && removeExpense(remove.id)} onCancel={() => setRemove(null)} />
    </div>
  );
}

/* ─── Sobrou no mês ─── */
function Hero({ data }: { data: Data }) {
  const pct = data.entrou.total > 0 ? Math.round((data.sobrou / data.entrou.total) * 100) : 0;
  const delta = data.prev.sobrou !== 0 ? Math.round(((data.sobrou - data.prev.sobrou) / Math.abs(data.prev.sobrou)) * 100) : null;
  const lastDay = new Date(Date.UTC(Number(data.month.slice(0, 4)), Number(data.month.slice(5, 7)), 0)).getUTCDate();
  const items: [string, string][] = [
    [`Contas a pagar até dia ${lastDay}`, brl(data.billsTotal)],
    ["Comissões a pagar", brl(data.comissoesAPagar)],
  ];
  if (data.isCurrent) items.push(["Dinheiro em caixa agora", data.cash.open ? brl(data.cash.drawer) : "caixa fechado"]);

  return (
    <section className="rounded-2xl bg-ink text-white p-5 md:p-6 grid md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] gap-5">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] text-night-muted">{data.isCurrent ? "Sobrou no mês até hoje" : "Sobrou no mês"}</span>
        <span className={cn("font-display text-[40px] md:text-[48px] font-bold leading-none tracking-[-0.02em]", data.sobrou < 0 && "text-[#FF9C8F]")}>{brl(data.sobrou)}</span>
        <span className="text-[13px] text-night-text mt-1">
          {data.entrou.total > 0 ? `${pct}% do que entrou` : "nada entrou ainda"}
          {delta !== null && ` · ${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs ${monthName(data.prev.month)}`}
        </span>
      </div>
      <div className="flex flex-col justify-center divide-y divide-night-line">
        {items.map(([l, v]) => (
          <div key={l} className="flex items-center justify-between gap-3 py-2 text-[13px]">
            <span className="text-night-text">{l}</span><span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Para onde foi o dinheiro (cascata) ─── */
function Flow({ data }: { data: Data }) {
  const total = data.entrou.total;
  const fees = data.taxas;
  const steps = [
    { label: "Entrou", sub: "serviços, assinaturas e produtos", v: total, kind: "in" as const },
    { label: "Comissões", sub: "dos profissionais", v: data.comissoes, kind: "out" as const },
    { label: "Despesas", sub: "contas pagas no mês", v: data.despesas, kind: "out" as const },
    { label: "Taxas de maquininha", sub: `débito ${fees.debitFee}% e crédito ${fees.creditFee}%`, v: fees.total, kind: "out" as const },
    { label: "Sobrou", sub: data.isCurrent ? "resultado até hoje" : "resultado do mês", v: data.sobrou, kind: "result" as const },
  ];
  let cursor = total;
  const pct = (v: number) => (total > 0 ? Math.max(0, Math.min(100, (v / total) * 100)) : 0);
  const breakdown = [
    ["serviços", data.entrou.services], ["assinaturas", data.entrou.subscriptions], ["produtos", data.entrou.products], ["outras entradas", data.entrou.other],
  ].filter(([, v]) => (v as number) > 0).map(([l, v]) => `${brl(v as number)} ${l}`).join(" · ");

  return (
    <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-[15px] font-semibold">Para onde foi o dinheiro</h2>
        {breakdown && <span className="text-xs text-ink-3">{breakdown}</span>}
      </div>
      <div className="flex flex-col gap-3">
        {steps.map((s) => {
          let left = 0;
          if (s.kind === "out") { cursor -= s.v; left = pct(cursor); }
          return (
            <div key={s.label} className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_auto] md:grid-cols-[220px_minmax(0,1fr)_120px] gap-3 items-center">
              <div className="min-w-0">
                <p className={cn("text-sm", s.kind === "out" ? "font-medium" : "font-semibold")}>{s.label}</p>
                <p className="text-xs text-ink-3 truncate">{s.sub}</p>
              </div>
              <div className="h-3 rounded-full bg-track relative overflow-hidden" aria-hidden>
                <div className={cn("absolute top-0 h-full rounded-full", s.kind === "in" ? "bg-ink" : s.kind === "out" ? "bg-bar-soft" : "bg-primary")}
                  style={{ left: `${left}%`, width: `${pct(Math.abs(s.v))}%` }} />
              </div>
              <span className={cn("text-sm text-right", s.kind === "out" ? "text-ink-2 font-medium" : "font-bold", s.kind === "result" && s.v < 0 && "text-danger")}>
                {s.kind === "out" ? "− " : ""}{brl(s.v)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Contas a pagar ─── */
function Bills({ data, onPaid }: { data: Data; onPaid: (id: string) => void }) {
  const late = data.bills.filter((b) => b.overdue).length;
  return (
    <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">Contas a pagar</h2>
        <p className="text-[13px] text-ink-3">
          {data.bills.length === 0 ? "Nenhuma conta em aberto neste mês." : `${brl(data.billsTotal)} em aberto${late ? ` · ${late} ${late === 1 ? "atrasada" : "atrasadas"}` : ""}`}
        </p>
      </div>
      {data.bills.length > 0 && (
        <ul className="flex flex-col divide-y divide-line-3">
          {data.bills.map((b) => {
            const d = b.dueDate ? spDay(b.dueDate).split("-") : null;
            return (
              <li key={b.id} className="flex items-center gap-3 py-2.5">
                <div className={cn("w-11 h-11 rounded-[10px] flex flex-col items-center justify-center shrink-0 leading-none", b.overdue ? "bg-danger-soft text-danger" : "bg-ground")}>
                  <span className="text-[15px] font-bold">{d ? d[2] : "—"}</span>
                  {d && <span className="text-[11px] mt-0.5">{MONTHS_SHORT[Number(d[1]) - 1]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.name}</p>
                  <p className={cn("text-xs truncate", b.overdue ? "text-danger-strong font-semibold" : "text-ink-3")}>{dueNote(b.dueDate, b.recurring)}</p>
                </div>
                <span className="text-sm font-semibold shrink-0">{brl2(b.amount)}</span>
                <button type="button" onClick={() => onPaid(b.id)} aria-label={`Marcar ${b.name} como paga`}
                  className="h-9 px-3 rounded-[9px] border border-control bg-surface text-[13px] font-semibold hover:bg-surface-3 shrink-0">
                  Marcar paga
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ─── Despesas por categoria ─── */
function Categories({ data }: { data: Data }) {
  const max = Math.max(1, ...data.categories.map((c) => c.value));
  const delta = data.prev.despesas > 0 ? Math.round(((data.despesas - data.prev.despesas) / data.prev.despesas) * 100) : null;
  return (
    <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">Despesas por categoria</h2>
        <p className="text-[13px] text-ink-3">
          {brl(data.despesas)} pagas{delta !== null && ` · ${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta)}% vs ${monthName(data.prev.month)}`}
        </p>
      </div>
      {data.categories.length === 0 ? (
        <p className="text-[13px] text-ink-3">Nenhuma despesa paga ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.categories.map((c) => (
            <li key={c.key} className="flex flex-col gap-1">
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="truncate"><span className="font-semibold">{c.name}</span>{c.example && <span className="text-ink-3"> · {c.example}</span>}</span>
                <span className="font-semibold shrink-0">{brl(c.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-track overflow-hidden" aria-hidden>
                <div className="h-full rounded-full bg-ink-2" style={{ width: `${(c.value / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─── Lançar despesa ─── */
const CATEGORY_OPTIONS = [
  ["ESTRUTURA", "Estrutura (aluguel…)"], ["UTILIDADES", "Contas da casa (luz, água, internet)"], ["PESSOAS", "Pessoas"],
  ["PRODUTOS", "Produtos e fornecedores"], ["MARKETING", "Marketing"], ["EQUIPAMENTOS", "Equipamentos"],
  ["TAXAS", "Taxas e impostos"], ["OUTROS", "Outros"],
] as const;
const PAY_OPTIONS = [["PIX", "Pix"], ["BOLETO", "Boleto"], ["CASH", "Dinheiro"], ["CREDIT", "Crédito"], ["DEBIT", "Débito"]] as const;

function DespesaModal({ month, onClose, onSaved }: { month: string; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuthStore();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("ESTRUTURA");
  const [method, setMethod] = useState("PIX");
  const [recurring, setRecurring] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [months, setMonths] = useState("12");
  const [paid, setPaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const select = "w-full h-11 rounded-[10px] border border-control bg-surface px-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  async function save() {
    setSaving(true);
    setError(null);
    const r = await fetch("/api/barbershop/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name, amount: parseMoney(amount), category, paymentMethod: method, month,
        type: recurring ? "FIXED" : "VARIABLE", isRecurring: recurring,
        dueDay: recurring && dueDay ? Number(dueDay) : undefined,
        dueDate: !recurring && dueDate ? dueDate : undefined,
        replicateMonths: recurring ? Number(months) || 1 : 1,
        paid,
      }),
    });
    setSaving(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Não foi possível lançar."); return; }
    toast.success(recurring ? `Despesa lançada para ${Number(months) || 1} meses` : "Despesa lançada");
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title="Lançar despesa" description={`Entra em ${monthLabel(month)}.`}>
      <div className="flex flex-col gap-3.5">
        <Input label="O que é" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: aluguel, conta de luz" autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" />
          <div>
            <label htmlFor="dp-method" className="block text-[13px] font-semibold text-ink-2 mb-1.5">Forma de pagamento</label>
            <select id="dp-method" value={method} onChange={(e) => setMethod(e.target.value)} className={select}>
              {PAY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor="dp-cat" className="block text-[13px] font-semibold text-ink-2 mb-1.5">Categoria</label>
          <select id="dp-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={select}>
            {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
          Repete todo mês
        </label>
        {recurring ? (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Vence todo dia" type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="Ex.: 10" />
            <Input label="Por quantos meses" type="number" min={1} max={24} value={months} onChange={(e) => setMonths(e.target.value)} />
          </div>
        ) : (
          <Input label="Vencimento (opcional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        )}
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="w-4 h-4 accent-[var(--color-primary)]" />
          Já está paga
        </label>
        {error && <p className="text-[13px] text-danger bg-danger-soft rounded-[10px] px-3 py-2.5" role="alert">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[1.5]" loading={saving} disabled={!name.trim() || !(parseMoney(amount) > 0)} onClick={save}>Lançar despesa</Button>
        </div>
      </div>
    </Modal>
  );
}
