"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Plus, Unlock, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CASH_CHANGED } from "@/components/financeiro/CashWidget";
import type { CashSummary } from "@/lib/cashSummary";
import { parseMoney } from "@/lib/finance";

interface Closing {
  id: string; openedAt: string; closedAt: string | null; closingBalance: number | null; expectedBalance: number | null;
  totalIn: number | null; closedByName: string | null; notes: string | null; difference: number | null;
}
type Data = CashSummary & { closings: Closing[] };
type EntryMode = "retirar" | "colocar" | "entrada";

const brl = (v: number) => formatCurrency(v);
const brl0 = (v: number) => formatCurrency(v).replace(",00", "");
const tz = { timeZone: "America/Sao_Paulo" } as const;
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { ...tz, hour: "2-digit", minute: "2-digit" });
const dayKey = (iso: string) => new Intl.DateTimeFormat("sv", tz).format(new Date(iso));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { ...tz, weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");

const NOTES: Record<string, (d: Data, fee: number) => string> = {
  PIX: () => "cai na conta na hora",
  CASH: (d) => `${brl0(d.drawer.expected)} na gaveta agora`,
  CREDIT: (_d, fee) => (fee > 0 ? `taxa de ${brl(fee)}` : "maquininha"),
  DEBIT: (_d, fee) => (fee > 0 ? `taxa de ${brl(fee)}` : "maquininha"),
  OTHER: () => "boleto, cobrança automática…",
};

export default function CaixaPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<EntryMode | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [undo, setUndo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/barbershop/cashflow", { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setData(await r.json());
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const changed = () => { load(); window.dispatchEvent(new Event(CASH_CHANGED)); };

  async function removeEntry(id: string) {
    setUndo(null);
    const r = await fetch(`/api/barbershop/cashflow/entries?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) toast.error((await r.json().catch(() => ({}))).error ?? "Não foi possível desfazer.");
    changed();
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4 animate-pulse" aria-busy>
        <div className="h-9 w-56 rounded bg-surface-2" />
        <div className="grid lg:grid-cols-[1fr_380px] gap-5"><div className="h-80 rounded-2xl bg-surface-2" /><div className="h-80 rounded-2xl bg-surface-2" /></div>
      </div>
    );
  }

  const s = data.session;
  const open = s?.status === "OPEN";
  const staleDay = open && dayKey(s!.openedAt) !== dayKey(new Date().toISOString());
  const moves = showAll ? data.moves : data.moves.slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Caixa de hoje</h1>
          <span className="text-sm text-ink-3">
            {open
              ? `Aberto ${staleDay ? `em ${shortDay(s!.openedAt)}` : ""} às ${hhmm(s!.openedAt)}${s!.openedByName ? ` por ${s!.openedByName.split(" ")[0]}` : ""} com ${brl0(s!.openingBalance)} de troco`
              : "Caixa fechado"}
          </span>
        </div>
        {open && (
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => setMode("retirar")} className="h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold inline-flex items-center gap-2 hover:bg-surface-3">
              <ArrowUpFromLine className="w-4 h-4" aria-hidden /> Retirar dinheiro
            </button>
            <button type="button" onClick={() => setMode("colocar")} className="h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold inline-flex items-center gap-2 hover:bg-surface-3">
              <ArrowDownToLine className="w-4 h-4" aria-hidden /> Colocar dinheiro
            </button>
            <button type="button" onClick={() => setMode("entrada")} className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
              <Plus className="w-4 h-4" aria-hidden /> Lançar entrada
            </button>
          </div>
        )}
      </header>

      {staleDay && (
        <p className="rounded-xl bg-warning-soft text-warning text-[13px] px-4 py-3" role="status">
          Este caixa está aberto desde {shortDay(s!.openedAt)}. Feche e confira a gaveta para começar o de hoje.
        </p>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          {/* Entrou */}
          <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[13px] font-semibold text-ink-3">{open ? (staleDay ? "Entrou neste caixa" : "Entrou hoje") : "Entrou hoje"}</p>
                <p className="font-display text-[34px] font-bold leading-tight">{brl0(data.totalIn)}</p>
              </div>
              <span className="text-[13px] text-ink-3">
                {data.movesCount} {data.movesCount === 1 ? "lançamento" : "lançamentos"}
                {data.tips > 0 && ` · inclui ${brl0(data.tips)} de gorjeta`}
              </span>
            </div>
            {data.byMethod.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {data.byMethod.map((m) => {
                  const pct = data.totalIn > 0 ? Math.round((m.amount / data.totalIn) * 100) : 0;
                  return (
                    <div key={m.method} className="rounded-xl border border-line-2 p-3.5 flex flex-col gap-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold">{m.label}</span>
                        <span className="text-[15px] font-bold">{brl0(m.amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-track overflow-hidden" aria-hidden>
                        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-ink-3">{pct}% · {NOTES[m.method](data, m.fee)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-ink-3">Nada entrou ainda. Os atendimentos concluídos na agenda aparecem aqui sozinhos.</p>
            )}
          </section>

          {/* Movimentações */}
          <section className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3 border-b border-line-2">
              <h2 className="text-[15px] font-semibold">Movimentações {staleDay ? "deste caixa" : "de hoje"}</h2>
              <span className="text-xs text-ink-3">mais recentes primeiro</span>
            </div>
            {data.moves.length === 0 ? (
              <p className="px-5 py-8 text-[13px] text-ink-3 text-center">Nenhuma movimentação ainda.</p>
            ) : (
              <ul className="divide-y divide-line-3">
                {moves.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-5 py-2.5 min-h-[56px]">
                    <span className="w-11 text-xs text-ink-3 shrink-0">{hhmm(m.at)}</span>
                    <span aria-hidden className={cn("w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                      m.dir === "in" ? "bg-positive-soft text-positive" : m.dir === "out" ? "bg-surface-3 text-ink-2" : "bg-danger-soft text-danger")}>
                      {m.dir === "in" ? "+" : m.dir === "out" ? "−" : "×"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{m.desc}</p>
                      <p className="text-xs text-ink-3 truncate">{m.sub}</p>
                    </div>
                    <span className="hidden sm:block text-xs text-ink-3 w-28 text-right truncate">{m.method}</span>
                    <span className={cn("text-sm font-semibold w-24 text-right shrink-0",
                      m.dir === "in" ? "text-positive" : m.dir === "out" ? "text-ink" : "text-ink-4")}>
                      {m.dir === "in" ? "+ " : m.dir === "out" ? "− " : ""}{brl(m.amount)}
                    </span>
                    {open && m.entryId ? (
                      <button type="button" onClick={() => setUndo(m.entryId!)} aria-label={`Desfazer ${m.desc}`}
                        className="w-8 h-8 rounded-lg text-ink-4 hover:bg-surface-3 hover:text-ink flex items-center justify-center shrink-0">
                        <Undo2 className="w-4 h-4" aria-hidden />
                      </button>
                    ) : <span className="w-8 shrink-0" />}
                  </li>
                ))}
              </ul>
            )}
            {data.moves.length > moves.length && (
              <button type="button" onClick={() => setShowAll(true)} className="w-full h-11 border-t border-line-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-3">
                Ver todos os {data.moves.length} lançamentos
              </button>
            )}
          </section>
        </div>

        {/* Fechar (ou abrir) */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          {open ? <FecharCaixa data={data} onClosed={changed} /> : <AbrirCaixa onOpened={changed} />}

          {data.closings.length > 0 && (
            <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-2.5">
              <h2 className="text-[15px] font-semibold">Últimos fechamentos</h2>
              <ul className="flex flex-col divide-y divide-line-3">
                {data.closings.map((c) => {
                  const d = c.difference;
                  const label = d === null ? (c.closingBalance !== null ? `contou ${brl(c.closingBalance)}` : "—")
                    : Math.abs(d) < 0.01 ? "Conferiu certinho" : d > 0 ? `Sobraram ${brl(d)}` : `Faltaram ${brl(-d)}`;
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{c.closedAt ? cap(shortDay(c.closedAt)) : "—"}</span>
                        {c.totalIn !== null && <span className="text-ink-3"> · {brl0(c.totalIn)}</span>}
                      </span>
                      <span className={cn("font-semibold shrink-0",
                        d === null ? "text-ink-3" : Math.abs(d) < 0.01 ? "text-positive" : d > 0 ? "text-ink-2" : "text-danger-strong")}
                        title={c.notes ?? undefined}>
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>

      {mode && s && <LancamentoModal mode={mode} sessionId={s.id} drawer={data.drawer.expected} onClose={() => setMode(null)} onSaved={() => { setMode(null); changed(); }} />}
      <ConfirmDialog isOpen={!!undo} title="Desfazer lançamento?" message="Ele sai do caixa e da conferência da gaveta."
        confirmLabel="Desfazer" onConfirm={() => undo && removeEntry(undo)} onCancel={() => setUndo(null)} />
    </div>
  );
}

/* ─── Fechar o caixa: conferir a gaveta ─── */
function FecharCaixa({ data, onClosed }: { data: Data; onClosed: () => void }) {
  const { token } = useAuthStore();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const d = data.drawer;
  const value = counted.trim() ? parseMoney(counted) : null;
  const diff = value === null ? null : Math.round((value - d.expected) * 100) / 100;

  async function close() {
    setConfirm(false);
    setSaving(true);
    const r = await fetch("/api/barbershop/cashflow", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId: data.session!.id, closingBalance: value ?? 0, notes }),
    });
    setSaving(false);
    const res = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(res.error ?? "Não foi possível fechar o caixa."); return; }
    const df = res.difference ?? 0;
    toast.success(Math.abs(df) < 0.01 ? "Caixa fechado. Conferiu certinho!" : `Caixa fechado. ${df > 0 ? "Sobraram" : "Faltaram"} ${brl(Math.abs(df))}.`);
    onClosed();
  }

  const rows: [string, string, string?][] = [
    ["Troco de abertura", brl(d.opening)],
    ["Entradas em dinheiro", `+ ${brl(d.cashIn)}`],
    ["Retiradas", `− ${brl(d.cashOut)}`],
  ];

  return (
    <section id="fechar" className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4 scroll-mt-6">
      <div>
        <h2 className="font-display text-xl font-bold">Fechar o caixa</h2>
        <p className="text-[13px] text-ink-3">Conte o dinheiro da gaveta e confira</p>
      </div>
      <div className="flex flex-col text-sm">
        {rows.map(([l, v]) => (
          <div key={l} className="flex justify-between py-1.5 border-b border-line-3"><span className="text-ink-3">{l}</span><span>{v}</span></div>
        ))}
        <div className="flex justify-between pt-2.5 font-semibold"><span>Deveria ter na gaveta</span><span>{brl(d.expected)}</span></div>
      </div>
      <div>
        <label htmlFor="cx-contado" className="block text-[13px] font-semibold text-ink-2 mb-1.5">Quanto tem na gaveta?</label>
        <div className="flex items-center h-12 rounded-[10px] border border-control bg-surface px-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <span className="text-ink-3 text-sm mr-2">R$</span>
          <input id="cx-contado" value={counted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" placeholder="0,00"
            className="flex-1 min-w-0 bg-transparent outline-none text-lg font-semibold" />
        </div>
      </div>
      {diff !== null && (
        <p className={cn("rounded-[10px] px-3.5 py-2.5 text-[13px]",
          Math.abs(diff) < 0.01 ? "bg-positive-soft text-positive" : diff > 0 ? "bg-surface-3 text-ink-2" : "bg-danger-soft text-danger")}>
          <span className="font-semibold">
            {Math.abs(diff) < 0.01 ? "Conferiu certinho" : diff > 0 ? `Sobram ${brl(diff)}` : `Faltam ${brl(-diff)}`}
          </span>
          {Math.abs(diff) >= 0.01 && " · explique abaixo, se souber"}
        </p>
      )}
      <div>
        <label htmlFor="cx-obs" className="block text-[13px] font-semibold text-ink-2 mb-1.5">Observação</label>
        <textarea id="cx-obs" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
          placeholder="Ex.: troco a mais para um cliente"
          className="w-full rounded-[10px] border border-control bg-surface px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
      </div>
      <Button variant="secondary" size="lg" loading={saving} disabled={value === null} onClick={() => setConfirm(true)}>Fechar caixa</Button>
      <ConfirmDialog isOpen={confirm} type="info" title="Fechar o caixa?"
        message={`Na gaveta: ${brl(value ?? 0)}. Deveria ter ${brl(d.expected)}. Depois de fechar não dá para lançar mais nada neste caixa.`}
        confirmLabel="Fechar caixa" onConfirm={close} onCancel={() => setConfirm(false)} />
    </section>
  );
}

/* ─── Abrir o caixa ─── */
function AbrirCaixa({ onOpened }: { onOpened: () => void }) {
  const { token } = useAuthStore();
  const [troco, setTroco] = useState("");
  const [saving, setSaving] = useState(false);

  async function openCash() {
    setSaving(true);
    const r = await fetch("/api/barbershop/cashflow", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ openingBalance: parseMoney(troco) }),
    });
    setSaving(false);
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error ?? "Não foi possível abrir o caixa."); return; }
    setTroco("");
    onOpened();
  }

  return (
    <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-bold">Abrir o caixa</h2>
        <p className="text-[13px] text-ink-3">Conte o troco que está na gaveta para começar o dia.</p>
      </div>
      <div className="flex items-center h-12 rounded-[10px] border border-control bg-surface px-3.5 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <span className="text-ink-3 text-sm mr-2">R$</span>
        <input value={troco} onChange={(e) => setTroco(e.target.value)} inputMode="decimal" placeholder="0,00" aria-label="Troco de abertura"
          className="flex-1 min-w-0 bg-transparent outline-none text-lg font-semibold" />
      </div>
      <Button size="lg" loading={saving} onClick={openCash}><Unlock className="w-4 h-4" aria-hidden /> Abrir caixa</Button>
    </section>
  );
}

/* ─── Retirar / colocar dinheiro / lançar entrada ─── */
const MODES: Record<EntryMode, { title: string; desc: string; placeholder: string; type: "INCOME" | "EXPENSE"; category: string }> = {
  retirar: { title: "Retirar dinheiro", desc: "Dinheiro que sai da gaveta.", placeholder: "Ex.: compra de toalhas, depósito no banco", type: "EXPENSE", category: "SANGRIA" },
  colocar: { title: "Colocar dinheiro", desc: "Dinheiro que entra na gaveta sem ser venda.", placeholder: "Ex.: mais troco", type: "INCOME", category: "SUPRIMENTO" },
  entrada: { title: "Lançar entrada", desc: "Algo que entrou fora da agenda.", placeholder: "Ex.: venda avulsa", type: "INCOME", category: "OUTROS" },
};
const METHOD_OPTIONS = [["CASH", "Dinheiro"], ["PIX", "Pix"], ["CREDIT_CARD", "Crédito"], ["DEBIT_CARD", "Débito"]] as const;

function LancamentoModal({ mode, sessionId, drawer, onClose, onSaved }: { mode: EntryMode; sessionId: string; drawer: number; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuthStore();
  const m = MODES[mode];
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooMuch = mode === "retirar" && parseMoney(amount) > Math.max(0, drawer) + 0.001;

  async function save() {
    setSaving(true);
    setError(null);
    const r = await fetch("/api/barbershop/cashflow/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, type: m.type, category: m.category, description, amount: parseMoney(amount), paymentMethod: mode === "entrada" ? method : "CASH" }),
    });
    setSaving(false);
    if (!r.ok) { setError((await r.json().catch(() => ({}))).error ?? "Não foi possível lançar."); return; }
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={m.title} description={m.desc}>
      <div className="flex flex-col gap-3.5">
        <Input label="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" autoFocus />
        <Input label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={m.placeholder} maxLength={120} />
        {mode === "entrada" && (
          <div>
            <span className="block text-[13px] font-semibold text-ink-2 mb-1.5">Forma de pagamento</span>
            <div role="radiogroup" aria-label="Forma de pagamento" className="grid grid-cols-4 gap-2">
              {METHOD_OPTIONS.map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={method === v} onClick={() => setMethod(v)}
                  className={cn("h-11 rounded-[10px] border text-[13px] font-semibold",
                    method === v ? "bg-ink text-white border-ink" : "bg-surface border-control text-ink hover:bg-surface-3")}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "retirar" && (
          <p className={cn("text-[13px]", tooMuch ? "text-danger" : "text-ink-3")} role={tooMuch ? "alert" : undefined}>
            Na gaveta agora: {brl(Math.max(0, drawer))}.{tooMuch && " Não dá para retirar mais do que isso."}
          </p>
        )}
        {error && <p className="text-[13px] text-danger bg-danger-soft rounded-[10px] px-3 py-2.5" role="alert">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button size="lg" className="flex-[1.5]" loading={saving} disabled={!description.trim() || !(parseMoney(amount) > 0) || tooMuch} onClick={save}>
            {m.title}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
