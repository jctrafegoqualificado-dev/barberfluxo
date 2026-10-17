"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Field, fieldCls } from "@/components/catalogo/SidePanel";
import { CYCLE_LABEL, dueKey } from "@/lib/subscriptionCycle";
import { brl, type PlanOption, type Sub } from "./types";

const METHODS: [string, string][] = [["PIX", "Pix"], ["CASH", "Dinheiro"], ["DEBIT_CARD", "Débito"], ["CREDIT_CARD", "Crédito"]];

/** Dar baixa (uma ou várias mensalidades) escolhendo como o cliente pagou. */
export function BaixaModal({ subs, onClose, onDone }: { subs: Sub[]; onClose: () => void; onDone: () => void }) {
  const { token } = useAuthStore();
  const [method, setMethod] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const total = subs.reduce((s, x) => s + x.plan.price, 0);
  const single = subs.length === 1 ? subs[0] : null;
  const auto = subs.some((s) => s.authorizationStatus === "AUTHORIZED");

  async function confirm() {
    if (!method) return;
    setSaving(true);
    const r = await fetch("/api/barbershop/subscriptions/pagamento", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(single ? { subscriptionId: single.id, method } : { ids: subs.map((s) => s.id), method }),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível dar baixa."); return; }
    toast.success(single ? `Baixa de ${single.client.name.split(" ")[0]} registrada` : `${subs.length} baixas registradas`);
    onDone();
  }

  return (
    <Modal open onClose={onClose} title={single ? "Dar baixa" : `Dar baixa em ${subs.length}`} className="max-w-sm">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-ground p-3.5 flex flex-col gap-1 max-h-48 overflow-y-auto">
          {subs.map((s) => (
            <div key={s.id} className="flex justify-between gap-3 text-sm">
              <span className="truncate"><span className="font-semibold">{s.client.name}</span> <span className="text-ink-3">· {s.plan.name}</span></span>
              <span className="font-semibold shrink-0">{brl(s.plan.price)}</span>
            </div>
          ))}
          {!single && <div className="flex justify-between text-sm font-bold border-t border-line pt-1.5 mt-1"><span>Total</span><span>{brl(total)}</span></div>}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Como pagou?</span>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setMethod(k)} aria-pressed={method === k}
                className={cn("h-12 rounded-[10px] border text-sm font-semibold", method === k ? "border-ink bg-ink text-white" : "border-control bg-surface")}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink-3">
          A próxima cobrança anda 1 ciclo e os usos do plano zeram.
          {auto && " O débito automático no Mercado Pago é pausado para não cobrar este ciclo de novo."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" disabled={!method} loading={saving} onClick={confirm}>Confirmar</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Editar plano, dia de cobrança, próximo vencimento e forma de pagamento. */
export function EditarModal({ sub, plans, onClose, onDone }: { sub: Sub; plans: PlanOption[]; onClose: () => void; onDone: () => void }) {
  const { token } = useAuthStore();
  const [form, setForm] = useState({
    planId: sub.plan.id,
    billingDay: sub.billingDay ? String(sub.billingDay) : "",
    nextBillingDate: dueKey(sub.nextBillingDate),
    paymentMethod: sub.paymentMethod === "CASH" || sub.paymentMethod === "CARD" ? sub.paymentMethod : "PIX",
  });
  const [saving, setSaving] = useState(false);
  const options = plans.filter((p) => p.active || p.id === sub.plan.id);

  async function save() {
    setSaving(true);
    const r = await fetch(`/api/barbershop/subscriptions/${sub.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId: form.planId, billingDay: form.billingDay ? Number(form.billingDay) : null, nextBillingDate: form.nextBillingDate, paymentMethod: form.paymentMethod }),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível salvar."); return; }
    toast.success("Assinatura atualizada");
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Editar assinatura" description={sub.client.name} className="max-w-sm">
      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Plano</span>
          <select value={form.planId} onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value }))} className={fieldCls}>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name} · {brl(p.price)}/{CYCLE_LABEL[p.billingCycle] ?? "mês"}</option>)}
          </select>
        </label>
        {form.planId !== sub.plan.id && sub.authorizationStatus === "AUTHORIZED" && (
          <p className="text-xs text-warning bg-warning-soft rounded-lg px-3 py-2">O débito automático continua no valor antigo. Para cobrar o novo valor, cancele e gere um novo link.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de cobrança" value={form.billingDay} onChange={(e) => setForm((f) => ({ ...f, billingDay: e.target.value.replace(/\D/g, "").slice(0, 2) }))} inputMode="numeric" placeholder="1 a 31" />
          <Field label="Próximo vencimento" type="date" value={form.nextBillingDate} onChange={(e) => setForm((f) => ({ ...f, nextBillingDate: e.target.value }))} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Costuma pagar com</span>
          <select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))} className={fieldCls}>
            <option value="PIX">Pix</option><option value="CASH">Dinheiro</option><option value="CARD">Cartão</option>
          </select>
        </label>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" loading={saving} onClick={save}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Mercado Pago exige o e-mail do cliente para gerar o link do débito automático. */
export function EmailModal({ sub, busy, onClose, onSubmit }: { sub: Sub; busy: boolean; onClose: () => void; onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const ok = /^\S+@\S+\.\S+$/.test(email.trim());
  return (
    <Modal open onClose={onClose} title="Ativar débito automático" description={sub.client.name} className="max-w-sm">
      <form className="flex flex-col gap-3.5" onSubmit={(e) => { e.preventDefault(); if (ok) onSubmit(email.trim()); }}>
        <p className="text-sm text-ink-2">O Mercado Pago pede o e-mail do cliente para criar o link de autorização.</p>
        <Field label="E-mail do cliente" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@gmail.com" autoFocus />
        <p className="text-xs text-ink-3">Cliente sem e-mail? Sem problema: continue na cobrança manual (Pix, dinheiro ou cartão no balcão).</p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={!ok} loading={busy}>Gerar link</Button>
        </div>
      </form>
    </Modal>
  );
}

interface Suggestion { id: string; name: string; phone: string | null; email: string | null }

/** Novo assinante: busca o cliente (ou cadastra), escolhe o plano e o dia de cobrança. */
export function NovoAssinanteModal({ plans, onClose, onDone }: { plans: PlanOption[]; onClose: () => void; onDone: () => void }) {
  const { token } = useAuthStore();
  const [form, setForm] = useState({ clientName: "", clientPhone: "", clientEmail: "", planId: "", billingDay: "", paymentMethod: "PIX" });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const open = plans.filter((p) => p.active);

  function onName(v: string) {
    set("clientName", v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setSuggestions([]); return; }
    timer.current = setTimeout(() => {
      fetch(`/api/barbershop/clients?q=${encodeURIComponent(v)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((d) => setSuggestions((d.clients || []).slice(0, 6))).catch(() => {});
    }, 200);
  }
  function pick(c: Suggestion) {
    setForm((f) => ({ ...f, clientName: c.name, clientPhone: c.phone ?? "", clientEmail: c.email && !/@cliente\./i.test(c.email) ? c.email : "" }));
    setSuggestions([]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientName.trim() || form.clientPhone.replace(/\D/g, "").length < 10) { toast.error("Informe nome e WhatsApp com DDD."); return; }
    if (!form.planId) { toast.error("Escolha o plano."); return; }
    const day = Number(form.billingDay);
    if (!(day >= 1 && day <= 31)) { toast.error("Escolha o dia de cobrança (1 a 31)."); return; }
    setSaving(true);
    const r = await fetch("/api/barbershop/subscriptions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(form),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível criar a assinatura."); return; }
    toast.success(d.subscription?.authorizationStatus === "PENDING_AUTH" ? "Assinatura criada. O link do débito automático foi para o WhatsApp do cliente." : "Assinatura criada");
    onDone();
  }

  return (
    <Modal open onClose={onClose} title="Novo assinante" className="max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="relative">
          <Field label="Cliente" value={form.clientName} onChange={(e) => onName(e.target.value)} onBlur={() => setTimeout(() => setSuggestions([]), 150)} placeholder="Buscar ou digitar o nome" autoComplete="off" />
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-surface border border-line rounded-xl shadow-lg overflow-hidden">
              {suggestions.map((c) => (
                <button key={c.id} type="button" onPointerDown={() => pick(c)} className="w-full text-left px-3 py-2.5 text-sm hover:bg-surface-3 flex justify-between gap-2 border-b border-line-3 last:border-0">
                  <span className="font-semibold truncate">{c.name}</span>{c.phone && <span className="text-xs text-ink-3 shrink-0">{c.phone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <Field label="WhatsApp" type="tel" value={form.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="(11) 99999-9999" />
        <Field label="E-mail · opcional" type="email" value={form.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} placeholder="cliente@gmail.com"
          hint={form.clientEmail.trim() ? "Com e-mail dá para ativar o débito automático pelo Mercado Pago." : "Sem e-mail, a cobrança é manual (Pix, dinheiro ou cartão)."} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Plano</span>
          <select value={form.planId} onChange={(e) => set("planId", e.target.value)} className={fieldCls}>
            <option value="">Escolha o plano…</option>
            {open.map((p) => <option key={p.id} value={p.id}>{p.name} · {brl(p.price)}/{CYCLE_LABEL[p.billingCycle] ?? "mês"}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de cobrança" value={form.billingDay} onChange={(e) => set("billingDay", e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" placeholder="1 a 31" />
          <label className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[13px] font-semibold text-ink-2">Costuma pagar com</span>
            <select value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} className={fieldCls}>
              <option value="PIX">Pix</option><option value="CASH">Dinheiro</option><option value="CARD">Cartão</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-ink-3">A cobrança cai sempre nesse dia do mês. Em meses mais curtos, vai para o último dia.</p>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="flex-1" loading={saving}>Criar assinatura</Button>
        </div>
      </form>
    </Modal>
  );
}
