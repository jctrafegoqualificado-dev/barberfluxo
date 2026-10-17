"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Layers, Minus, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { parseMoney } from "@/lib/finance";
import { CYCLE_LABEL, monthlyValue } from "@/lib/subscriptionCycle";
import { Field, Section, Segmented, SidePanel, Switch, fieldCls, useWide } from "@/components/catalogo/SidePanel";

interface Service { id: string; name: string; price: number; active?: boolean }
interface Barber { id: string; nickname: string | null; user: { name: string } }
interface Plan {
  id: string; name: string; description: string | null; price: number; billingCycle: string; maxUses: number | null; active: boolean;
  commissionPercentage: number | null; extraDiscount: number;
  planServices: { service: Service; quantity: number | null }[];
  allowedBarbers?: { id: string }[];
  beneficiaryRules?: unknown;
  _count?: { subscriptions: number };
}
type Cycle = "MONTHLY" | "QUARTERLY" | "YEARLY";
interface Item { serviceId: string; qty: number | null } // null = sem limite
interface Dependent { name: string; maxUses: string }

const brl = (v: number) => formatCurrency(v).replace(",00", "");
const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const subsOf = (p: Plan) => p._count?.subscriptions ?? 0;
const mrrOf = (p: Plan) => monthlyValue(p.price, p.billingCycle) * subsOf(p);
const barberName = (b: Barber) => b.nickname || b.user.name.split(" ")[0];

function includesText(p: Plan) {
  if (!p.planServices.length) return p.maxUses ? `Até ${p.maxUses} visitas` : "Nenhum serviço incluso";
  return p.planServices
    .map((ps) => (ps.quantity == null ? `${ps.service.name} sem limite` : `${ps.quantity}× ${ps.service.name}`))
    .join(" · ");
}

export default function PlanosPage() {
  const { token } = useAuthStore();
  const wide = useWide();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    setPlans(d.plans || []);
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = { Authorization: `Bearer ${token}` };
    fetch("/api/barbershop/services", { headers: h }).then((r) => r.json()).then((d) => setServices((d.services || []).filter((s: Service) => s.active !== false))).catch(() => {});
    fetch("/api/barbershop/barbers", { headers: h }).then((r) => r.json()).then((d) => setBarbers(d.barbers || [])).catch(() => {});
  }, [token]);

  const list = plans ?? [];
  const open = list.filter((p) => p.active);
  const closed = list.filter((p) => !p.active);
  const totalSubs = list.reduce((s, p) => s + subsOf(p), 0);
  const totalMrr = list.reduce((s, p) => s + mrrOf(p), 0);
  const sel = list.find((p) => p.id === selected);

  useEffect(() => {
    if (wide && plans && selected === null && open.length) setSelected(open[0].id);
  }, [wide, plans, selected, open]);

  const card = (p: Plan) => {
    const on = selected === p.id;
    const share = totalMrr > 0 ? Math.round((mrrOf(p) / totalMrr) * 100) : 0;
    return (
      <button key={p.id} type="button" onClick={() => setSelected(p.id)} aria-pressed={on}
        className={cn("text-left flex flex-col gap-2.5 px-[18px] py-4 rounded-[14px] bg-surface border transition-colors",
          on ? "border-primary ring-1 ring-primary" : "border-line hover:border-control", !p.active && "opacity-70")}>
        <div className="flex items-baseline justify-between gap-2.5">
          <span className="text-base font-semibold truncate">{p.name}</span>
          <span className="text-base font-bold shrink-0">{brl(p.price)}<span className="text-xs font-semibold text-ink-3">/{CYCLE_LABEL[p.billingCycle] ?? "mês"}</span></span>
        </div>
        <span className="text-[13px] text-ink-3 line-clamp-2">{includesText(p)}</span>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-ink-2">
            <span>{subsOf(p)} assinante{subsOf(p) === 1 ? "" : "s"}{p.commissionPercentage != null ? ` · comissão ${p.commissionPercentage}%` : ""}</span>
            <span>{brl(mrrOf(p))}/mês</span>
          </div>
          <div className="h-1.5 rounded-full bg-track"><div className={cn("h-full rounded-full", on ? "bg-primary" : "bg-ink")} style={{ width: `${share}%` }} /></div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Planos de assinatura</h1>
          <span className="text-sm text-ink-3">
            {open.length} plano{open.length === 1 ? "" : "s"} aberto{open.length === 1 ? "" : "s"} · {totalSubs} assinante{totalSubs === 1 ? "" : "s"} · {brl(totalMrr)}/mês
          </span>
        </div>
        <div className="flex gap-2">
          <Link href="/painel/assinaturas" className="h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold inline-flex items-center hover:bg-surface-3">Ver assinantes</Link>
          <button type="button" onClick={() => setSelected("new")} className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
            <Plus className="w-4 h-4" aria-hidden /> Novo plano
          </button>
        </div>
      </header>

      <div className="flex gap-5 items-start">
        <section aria-label="Planos" className="flex-1 min-w-0 flex flex-col gap-3">
          {!plans ? <div className="h-48 rounded-2xl animate-pulse bg-surface-3/50" aria-busy /> : list.length === 0 ? (
            <div className="rounded-2xl bg-surface border border-line px-6 py-12 flex flex-col items-center gap-2 text-center">
              <Layers className="w-10 h-10 text-ink-4" aria-hidden />
              <p className="font-semibold">Nenhum plano ainda</p>
              <p className="text-[13px] text-ink-3 max-w-sm">Plano de assinatura é o clube da barbearia: o cliente paga todo mês e usa os serviços inclusos.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">{open.map(card)}</div>
              <button type="button" onClick={() => setSelected("new")}
                className="h-12 rounded-[14px] border border-dashed border-control text-[13px] font-semibold text-ink-2 hover:bg-surface inline-flex items-center justify-center gap-1.5">
                <Plus className="w-4 h-4" aria-hidden /> Criar novo plano
              </button>
              {closed.length > 0 && (
                <div className="flex flex-col gap-3 pt-2">
                  <button type="button" onClick={() => setShowClosed((v) => !v)} aria-expanded={showClosed} className="self-start text-[13px] font-semibold text-ink-2 underline underline-offset-2">
                    {showClosed ? "Esconder" : "Mostrar"} planos fechados ({closed.length})
                  </button>
                  {showClosed && <div className="grid gap-3 sm:grid-cols-2">{closed.map(card)}</div>}
                </div>
              )}
            </>
          )}
        </section>

        <SidePanel open={!!selected && (selected === "new" || !!sel)} wide={wide} onClose={() => setSelected(null)} label="Editar plano">
          {selected === "new" ? (
            <Editor key="new" services={services} barbers={barbers} onClose={() => setSelected(null)} onSaved={(id) => { load(); setSelected(id ?? null); }} />
          ) : sel ? (
            <Editor key={sel.id} plan={sel} services={services} barbers={barbers} onClose={() => setSelected(null)} onSaved={() => load()} />
          ) : null}
        </SidePanel>
      </div>
    </div>
  );
}

function Editor({ plan, services, barbers, onClose, onSaved }: {
  plan?: Plan; services: Service[]; barbers: Barber[]; onClose: () => void; onSaved: (id?: string) => void;
}) {
  const { token } = useAuthStore();
  const isNew = !plan;
  const init = () => ({
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    price: plan ? money(plan.price) : "",
    billingCycle: (plan?.billingCycle ?? "MONTHLY") as Cycle,
    items: (plan?.planServices ?? []).map((ps) => ({ serviceId: ps.service.id, qty: ps.quantity })) as Item[],
    allowedBarberIds: plan?.allowedBarbers?.map((b) => b.id) ?? [],
    commission: plan?.commissionPercentage != null ? String(plan.commissionPercentage) : "",
    extraDiscount: plan?.extraDiscount ? String(plan.extraDiscount) : "",
    maxUses: plan?.maxUses != null ? String(plan.maxUses) : "",
    dependents: (Array.isArray(plan?.beneficiaryRules) ? plan!.beneficiaryRules : []).map((b: { name: string; maxUses: number }) => ({ name: b.name, maxUses: String(b.maxUses) })) as Dependent[],
    active: plan?.active ?? true,
  });
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  type F = ReturnType<typeof init>;
  const set = <K extends keyof F>(k: K, v: F[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(init());

  // Serviços do plano que foram desativados continuam aparecendo (vêm do próprio plano)
  const svcById = new Map<string, Service>([...(plan?.planServices.map((ps) => [ps.service.id, ps.service] as const) ?? []), ...services.map((s) => [s.id, s] as const)]);
  const available = services.filter((s) => !form.items.some((i) => i.serviceId === s.id));
  const price = parseMoney(form.price);
  const per = CYCLE_LABEL[form.billingCycle];
  const worth = form.items.reduce((s, i) => s + (i.qty ?? 0) * (svcById.get(i.serviceId)?.price ?? 0), 0);
  const hasUnlimited = form.items.some((i) => i.qty == null);
  const subs = plan ? subsOf(plan) : 0;

  const setItem = (serviceId: string, qty: number | null) => set("items", form.items.map((i) => (i.serviceId === serviceId ? { ...i, qty } : i)));
  const removeItem = (serviceId: string) => set("items", form.items.filter((i) => i.serviceId !== serviceId));
  const toggleBarber = (id: string) => set("allowedBarberIds", form.allowedBarberIds.includes(id) ? form.allowedBarberIds.filter((b) => b !== id) : [...form.allowedBarberIds, id]);

  async function save(override?: Partial<F>) {
    const f = { ...form, ...override };
    const pct = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
    const commission = pct(f.commission);
    const discount = pct(f.extraDiscount) ?? 0;
    if (!f.name.trim()) { toast.error("Informe o nome do plano."); return; }
    if (!(parseMoney(f.price) > 0)) { toast.error("Informe um preço maior que zero."); return; }
    if (commission != null && !(commission >= 0 && commission <= 100)) { toast.error("A comissão vai de 0 a 100%."); return; }
    if (!(discount >= 0 && discount <= 100)) { toast.error("O desconto vai de 0 a 100%."); return; }
    if (f.dependents.some((d) => !d.name.trim() || !(Number(d.maxUses) > 0))) { toast.error("Cada dependente precisa de nome e de quantos usos tem."); return; }
    setSaving(true);
    const body = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      price: parseMoney(f.price),
      billingCycle: f.billingCycle,
      maxUses: f.maxUses.trim() ? Number(f.maxUses) : null,
      commissionPercentage: commission,
      extraDiscount: discount,
      serviceQuantities: f.items.map((i) => ({ serviceId: i.serviceId, quantity: i.qty })),
      allowedBarberIds: f.allowedBarberIds,
      beneficiaryRules: f.dependents.length ? f.dependents.map((d) => ({ name: d.name.trim(), maxUses: Number(d.maxUses) })) : null,
      active: f.active,
    };
    const r = await fetch(isNew ? "/api/barbershop/plans" : `/api/barbershop/plans/${plan!.id}`, {
      method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível salvar."); return; }
    toast.success(isNew ? "Plano criado" : override?.active === false ? "Plano fechado para novas assinaturas" : override?.active ? "Plano reaberto" : "Plano salvo");
    if (override) setForm(f);
    onSaved(isNew ? d.plan?.id : undefined);
  }

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 pr-12 xl:pr-5">
        <div className="min-w-0">
          <h2 className="font-display text-[21px] font-bold truncate">{isNew ? "Novo plano" : plan!.name}</h2>
          <p className="text-[13px] text-ink-3">{isNew ? "O cliente paga todo ciclo e usa o que está incluso" : `${subs} assinante${subs === 1 ? "" : "s"} · ${brl(mrrOf(plan!))}/mês`}</p>
        </div>
        {!isNew && (
          <span className="flex items-center gap-2 text-[13px] font-semibold shrink-0 text-right">
            {form.active ? "Aberto" : "Fechado"}
            <Switch checked={form.active} label="Aberto para novas assinaturas" onChange={(v) => (v ? save({ active: true }) : setConfirmClose(true))} />
          </span>
        )}
      </div>

      <Section title="Plano">
        <Field label="Nome do plano" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Corte + barba" />
        <Field label="Preço" prefix="R$" value={form.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" placeholder="0,00"
          hint={!isNew && subs > 0 ? "Novo preço vale nas próximas cobranças. Quem paga no débito automático continua no valor que autorizou." : undefined} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Cobrança</span>
          <Segmented value={form.billingCycle} onChange={(v) => set("billingCycle", v)} label="Ciclo de cobrança"
            options={[["MONTHLY", "Mensal"], ["QUARTERLY", "Trimestral"], ["YEARLY", "Anual"]]} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Descrição <span className="font-normal text-ink-3">· opcional</span></span>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={200} className={cn(fieldCls, "h-auto py-2.5 resize-none")} />
        </label>
      </Section>

      <Section title={`Incluso por ${per}`} aside={available.length > 0 && !adding ? (
        <button type="button" onClick={() => setAdding(true)} className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">+ Adicionar serviço</button>
      ) : undefined}>
        {form.items.length > 0 && (
          <div className="rounded-xl border border-line-2 divide-y divide-line-3">
            {form.items.map((i) => {
              const s = svcById.get(i.serviceId);
              const name = s?.name ?? "Serviço";
              return (
                <div key={i.serviceId} className="flex items-center gap-2.5 min-h-[58px] px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{name}</p>
                    <p className="text-xs text-ink-3">{s ? `avulso sai ${brl(s.price)}` : ""}{s?.active === false ? " · serviço desativado" : ""}</p>
                  </div>
                  {i.qty == null ? (
                    <button type="button" onClick={() => setItem(i.serviceId, 4)} className="h-9 px-3 rounded-[9px] border border-control text-[13px] font-semibold" aria-label={`${name}: sem limite. Tocar para limitar`}>Sem limite</button>
                  ) : (
                    <div className="flex items-center rounded-[9px] border border-control">
                      <button type="button" onClick={() => (i.qty! > 1 ? setItem(i.serviceId, i.qty! - 1) : removeItem(i.serviceId))} aria-label={`Diminuir ${name}`} className="w-9 h-9 flex items-center justify-center"><Minus className="w-4 h-4" aria-hidden /></button>
                      <span className="min-w-[64px] text-center text-sm font-semibold">{i.qty} {i.qty === 1 ? "vez" : "vezes"}</span>
                      <button type="button" onClick={() => (i.qty! >= 30 ? setItem(i.serviceId, null) : setItem(i.serviceId, i.qty! + 1))} aria-label={`Aumentar ${name}`} className="w-9 h-9 flex items-center justify-center"><Plus className="w-4 h-4" aria-hidden /></button>
                    </div>
                  )}
                  <button type="button" onClick={() => removeItem(i.serviceId)} aria-label={`Tirar ${name} do plano`} className="w-8 h-8 rounded-lg text-ink-3 hover:bg-surface-3 flex items-center justify-center"><X className="w-4 h-4" aria-hidden /></button>
                </div>
              );
            })}
          </div>
        )}
        {adding && (
          <div className="flex gap-2">
            <select autoFocus defaultValue="" onChange={(e) => { if (e.target.value) set("items", [...form.items, { serviceId: e.target.value, qty: 4 }]); setAdding(false); }} className={fieldCls} aria-label="Serviço para incluir">
              <option value="" disabled>Escolha o serviço…</option>
              {available.map((s) => <option key={s.id} value={s.id}>{s.name} · {brl(s.price)}</option>)}
            </select>
            <Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        )}
        {form.items.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {form.items.filter((i) => i.qty != null).map((i) => (
              <button key={i.serviceId} type="button" onClick={() => setItem(i.serviceId, null)} className="text-xs font-semibold text-ink-3 underline underline-offset-2">
                {svcById.get(i.serviceId)?.name} sem limite
              </button>
            ))}
          </div>
        )}
        <p className={cn("text-[13px]", !hasUnlimited && worth > 0 && price > 0 && worth < price ? "text-warning font-semibold" : "text-ink-2")}>
          {form.items.length === 0 ? "Inclua pelo menos um serviço."
            : hasUnlimited ? `Com serviço sem limite, quanto o cliente economiza depende de quantas vezes ele vem.${worth > 0 ? ` O resto sairia ${brl(worth)} avulso.` : ""}`
            : price <= 0 ? `Avulso isso sairia ${brl(worth)}.`
            : worth >= price ? `Avulso isso sairia ${brl(worth)}. O assinante economiza ${brl(worth - price)} se usar tudo.`
            : `Avulso isso sairia ${brl(worth)} — menos que o plano. Vale rever o preço.`}
        </p>
        <Field label="Limite de visitas" suffix={`por ${per}`} value={form.maxUses} onChange={(e) => set("maxUses", e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="sem limite"
          hint="Uma visita com corte e barba conta 1. Por enquanto o limite só aparece na tela de Assinantes: a agenda ainda não bloqueia quem passou." />
      </Section>

      <Section title="Quem pode atender">
        <div className="flex flex-wrap gap-2">
          {barbers.map((b) => {
            const on = form.allowedBarberIds.includes(b.id);
            return (
              <button key={b.id} type="button" onClick={() => toggleBarber(b.id)} aria-pressed={on}
                className={cn("h-[38px] px-3.5 rounded-full border text-[13px] font-semibold", on ? "bg-ink text-white border-ink" : "bg-surface text-ink-2 border-control")}>
                {barberName(b)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-ink-3">{form.allowedBarberIds.length === 0 ? "Nenhum marcado: todos os profissionais atendem assinantes deste plano." : "Só os marcados atendem pelo plano."}</p>
      </Section>

      <Section title="Comissão e benefícios">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Comissão própria" suffix="% por uso" value={form.commission} onChange={(e) => set("commission", e.target.value)} inputMode="decimal" placeholder="pote" />
          <Field label="Desconto em extras" suffix="%" value={form.extraDiscount} onChange={(e) => set("extraDiscount", e.target.value)} inputMode="decimal" placeholder="0" />
        </div>
        <p className="text-xs text-ink-3">
          {form.commission.trim() === ""
            ? "Em branco, o barbeiro recebe pelo pote das assinaturas (dividido por atendimento)."
            : "Com comissão própria, o barbeiro recebe esta % do preço do serviço e o plano fica fora do pote."}
          {" "}O desconto em extras já vem preenchido na comanda quando o assinante faz algo fora do plano.
        </p>
      </Section>

      <Section title="Dependentes" aside={(
        <button type="button" onClick={() => set("dependents", [...form.dependents, { name: "", maxUses: "" }])} className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">+ Adicionar</button>
      )}>
        {form.dependents.length === 0 ? (
          <p className="text-xs text-ink-3">Plano individual. Adicione dependentes para planos de família (ex.: pai e filho), cada um com sua cota.</p>
        ) : form.dependents.map((d, idx) => (
          <div key={idx} className="flex gap-2 items-end">
            <Field label={idx === 0 ? "Quem" : ""} aria-label="Nome do dependente" value={d.name} onChange={(e) => set("dependents", form.dependents.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} placeholder="Ex.: Filho" className="flex-1" />
            <Field label={idx === 0 ? "Usos" : ""} aria-label="Usos do dependente" value={d.maxUses} onChange={(e) => set("dependents", form.dependents.map((x, i) => (i === idx ? { ...x, maxUses: e.target.value.replace(/\D/g, "") } : x)))} inputMode="numeric" className="w-24" />
            <button type="button" onClick={() => set("dependents", form.dependents.filter((_, i) => i !== idx))} aria-label="Remover dependente" className="w-11 h-11 rounded-[10px] text-ink-3 hover:bg-surface-3 flex items-center justify-center shrink-0"><Trash2 className="w-4 h-4" aria-hidden /></button>
          </div>
        ))}
      </Section>

      <div className="px-5 py-4 border-t border-line-2 flex items-center gap-2 sticky bottom-0 bg-surface">
        {!isNew && subs > 0 && <Link href={`/painel/assinaturas?plano=${plan!.id}`} className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">Ver os {subs}</Link>}
        <Button variant="outline" className="ml-auto" onClick={() => (dirty && !isNew ? setForm(init()) : onClose())}>{dirty && !isNew ? "Descartar" : "Fechar"}</Button>
        <Button loading={saving} disabled={!dirty} onClick={() => save()}>{isNew ? "Criar plano" : "Salvar plano"}</Button>
      </div>

      <ConfirmDialog isOpen={confirmClose} title={`Fechar ${plan?.name} para novas assinaturas?`}
        message={subs > 0 ? `Os ${subs} assinantes atuais continuam com o plano e as cobranças seguem normais. Só não dá para assinar de novo. Dá para reabrir quando quiser.` : "Ninguém mais consegue assinar. Dá para reabrir quando quiser."}
        confirmLabel="Fechar plano" onConfirm={() => { setConfirmClose(false); save({ active: false }); }} onCancel={() => setConfirmClose(false)} />
    </div>
  );
}
