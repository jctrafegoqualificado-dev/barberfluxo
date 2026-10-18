"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, Scissors } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { parseMoney } from "@/lib/finance";
import { Field, Section, Segmented, SidePanel, Switch, fieldCls, useWide } from "@/components/catalogo/SidePanel";

interface Service {
  id: string; name: string; description: string | null; price: number; duration: number; imageUrl: string | null;
  commission: number | null; materialCost: number; active: boolean; onlineBooking: boolean;
}
type Stats = Record<string, { count: number; revenue: number }>;
type Filter = "active" | "inactive" | "all";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const brl = (v: number) => formatCurrency(v).replace(",00", "");
const money = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const month = () => MONTHS[Number(new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(5, 7)) - 1];

export default function ServicosPage() {
  const { token } = useAuthStore();
  const wide = useWide();
  const [services, setServices] = useState<Service[] | null>(null);
  const [stats, setStats] = useState<Stats>({});
  const [totals, setTotals] = useState({ services: 0, appointments: 0, revenue: 0 });
  const [slug, setSlug] = useState<string | null>(null);
  const [barberRate, setBarberRate] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [selected, setSelected] = useState<string | "new" | null>(null);

  const load = useCallback(async () => {
    const h = { Authorization: `Bearer ${token}` };
    const d = await fetch("/api/barbershop/services?stats=1", { headers: h }).then((r) => r.json());
    setServices(d.services || []);
    setStats(d.stats || {});
    if (d.monthTotals) setTotals(d.monthTotals);
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = { Authorization: `Bearer ${token}` };
    fetch("/api/barbershop/settings", { headers: h }).then((r) => r.json()).then((d) => setSlug(d.slug ?? null)).catch(() => {});
    // Comissão mais comum da equipe, para o exemplo de "quanto fica" quando o serviço não tem regra própria
    fetch("/api/barbershop/barbers", { headers: h }).then((r) => r.json()).then((d) => {
      const pcts = (d.barbers || []).filter((b: { commissionType: string }) => b.commissionType === "PERCENTAGE").map((b: { commission: number }) => b.commission);
      if (pcts.length) setBarberRate(pcts.sort((a: number, b: number) => pcts.filter((x: number) => x === b).length - pcts.filter((x: number) => x === a).length)[0]);
    }).catch(() => {});
  }, [token]);

  const list = services ?? [];
  const activeCount = list.filter((s) => s.active).length;
  const visible = list.filter((s) => filter === "all" || (filter === "active" ? s.active : !s.active));
  const top = useMemo(() => {
    const entries = list.map((s) => ({ s, st: stats[s.id] ?? { count: 0, revenue: 0 } }));
    const byCount = [...entries].sort((a, b) => b.st.count - a.st.count)[0];
    const byRev = [...entries].sort((a, b) => b.st.revenue - a.st.revenue)[0];
    return { byCount: byCount?.st.count ? byCount : null, byRev: byRev?.st.revenue ? byRev : null };
  }, [list, stats]);
  const offline = list.filter((s) => s.active && !s.onlineBooking);
  const popularIds = new Set(list.filter((s) => s.active).map((s) => s.id).sort((a, b) => (stats[b]?.count ?? 0) - (stats[a]?.count ?? 0)).slice(0, 2).filter((id) => (stats[id]?.count ?? 0) > 0));
  const sel = list.find((s) => s.id === selected);

  useEffect(() => {
    if (wide && services?.length && selected === null) setSelected(services.find((s) => s.active)?.id ?? services[0].id);
  }, [wide, services, selected]);

  const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Serviços</h1>
          <span className="text-sm text-ink-3">O que a barbearia oferece, quanto custa e quanto rende</span>
        </div>
        <div className="flex gap-2">
          {slug && (
            <a href={`/agendar/${slug}`} target="_blank" rel="noreferrer" className="hidden sm:inline-flex h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold items-center gap-2 hover:bg-surface-3">
              <ExternalLink className="w-4 h-4" aria-hidden /> Ver como o cliente vê
            </a>
          )}
          <button type="button" onClick={() => setSelected("new")} className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
            <Plus className="w-4 h-4" aria-hidden /> Novo serviço
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          [`Feitos em ${month()}`, String(totals.services), `em ${totals.appointments} atendimentos · ${brl(totals.revenue)}`],
          ["Mais pedido", top.byCount?.s.name ?? "—", top.byCount ? `${top.byCount.st.count} vezes · ${pct(top.byCount.st.count, totals.services)}% dos serviços` : "nada feito ainda"],
          ["Mais faturou", top.byRev?.s.name ?? "—", top.byRev ? `${brl(top.byRev.st.revenue)} · ${pct(top.byRev.st.revenue, totals.revenue)}% do faturamento` : "nada faturado ainda"],
          ["Fora do agendamento online", String(offline.length), offline.length ? offline.map((s) => s.name).join(", ") : "todos aparecem no link"],
        ].map(([l, v, sub]) => (
          <div key={l} className="rounded-2xl bg-surface border border-line p-4 flex flex-col gap-1 min-w-0">
            <span className="text-[13px] text-ink-3">{l}</span>
            <span className="font-display text-xl md:text-2xl font-bold truncate">{v}</span>
            <span className="text-xs text-ink-3 truncate">{sub}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-5 items-start">
        <section className="flex-1 min-w-0 bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-line-2">
            <Segmented value={filter} onChange={setFilter} label="Filtrar"
              options={[["active", `Ativos ${activeCount}`], ["inactive", `Inativos ${list.length - activeCount}`], ["all", `Todos ${list.length}`]]} />
            <span className="text-xs text-ink-3">Números de {month()}</span>
          </div>
          {!services ? <div className="h-48 animate-pulse bg-surface-3/50" aria-busy /> : visible.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">Nenhum serviço aqui.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[620px]">
                <thead>
                  <tr className="text-xs text-ink-3 border-b border-line-2">
                    <th scope="col" className="text-left font-semibold px-4 py-2.5">Serviço</th>
                    <th scope="col" className="text-right font-semibold px-3">Duração</th>
                    <th scope="col" className="text-right font-semibold px-3">Preço</th>
                    <th scope="col" className="text-right font-semibold px-3">No mês</th>
                    <th scope="col" className="text-left font-semibold px-3 pr-4">Online</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-3">
                  {visible.map((s) => {
                    const st = stats[s.id];
                    const on = selected === s.id;
                    const tag = !s.active ? ["Inativo", "bg-surface-2 text-ink-2"] : s.commission != null ? [`Comissão ${s.commission}%`, "bg-warning-soft text-warning"] : popularIds.has(s.id) ? ["Mais escolhido", "bg-positive-soft text-positive"] : null;
                    return (
                      <tr key={s.id} onClick={() => setSelected(s.id)} aria-current={on || undefined}
                        className={cn("cursor-pointer", on ? "bg-primary/[0.07]" : "hover:bg-surface-3/50", !s.active && "opacity-70")}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0", on ? "bg-primary text-white" : "bg-ground text-ink-2")}><Scissors className="w-4 h-4" aria-hidden /></div>
                            <div className="min-w-0">
                              <p className="font-semibold flex items-center gap-1.5"><span className="truncate">{s.name}</span>{tag && <span className={cn("h-5 px-2 rounded-full text-[11px] font-semibold inline-flex items-center shrink-0", tag[1])}>{tag[0]}</span>}</p>
                              {s.description && <p className="text-xs text-ink-3 truncate">{s.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 text-right text-ink-2">{s.duration} min</td>
                        <td className="px-3 text-right">{brl(s.price)}</td>
                        <td className="px-3 text-right"><p>{st?.count || "—"}</p><p className="text-xs text-ink-3">{st?.revenue ? brl(st.revenue) : st?.count ? "plano" : "nenhum"}</p></td>
                        <td className="px-3 pr-4">
                          {!s.active ? <span className="text-ink-4">—</span> : (
                            <span className={cn("h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center", s.onlineBooking ? "bg-positive-soft text-positive" : "bg-ground text-ink-2")}>
                              {s.onlineBooking ? "Aparece" : "Só no balcão"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" onClick={() => setSelected("new")} className="w-full h-11 border-t border-line-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-3 inline-flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" aria-hidden /> Adicionar serviço
          </button>
        </section>

        <SidePanel open={!!selected && (selected === "new" || !!sel)} wide={wide} onClose={() => setSelected(null)} label="Editar serviço">
          {selected === "new" ? (
            <Editor key="new" barberRate={barberRate} onClose={() => setSelected(null)} onSaved={(id) => { load(); setSelected(id ?? null); }} />
          ) : sel ? (
            <Editor key={sel.id} service={sel} stat={stats[sel.id]} barberRate={barberRate} onClose={() => setSelected(null)} onSaved={() => load()} />
          ) : null}
        </SidePanel>
      </div>
    </div>
  );
}

function Editor({ service, stat, barberRate, onClose, onSaved }: {
  service?: Service; stat?: { count: number; revenue: number }; barberRate: number | null; onClose: () => void; onSaved: (id?: string) => void;
}) {
  const { token } = useAuthStore();
  const isNew = !service;
  const init = () => ({
    name: service?.name ?? "", description: service?.description ?? "", price: service ? money(service.price) : "",
    duration: String(service?.duration ?? 30), imageUrl: service?.imageUrl ?? "", materialCost: service?.materialCost ? money(service.materialCost) : "",
    commission: service?.commission != null ? String(service.commission) : "", onlineBooking: service?.onlineBooking ?? true, active: service?.active ?? true,
  });
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const set = <K extends keyof ReturnType<typeof init>>(k: K, v: ReturnType<typeof init>[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(init());

  const price = parseMoney(form.price);
  const cost = parseMoney(form.materialCost);
  const ownPct = form.commission.trim() === "" ? null : Number(form.commission.replace(",", "."));
  const comPct = ownPct ?? barberRate;
  const com = comPct != null ? Math.max(0, price - cost) * (comPct / 100) : null;

  async function save(override?: Partial<ReturnType<typeof init>>) {
    const f = { ...form, ...override };
    const duration = Number(f.duration);
    if (!f.name.trim()) { toast.error("Informe o nome."); return; }
    if (!(parseMoney(f.price) > 0)) { toast.error("Informe um preço maior que zero."); return; }
    if (!(duration > 0)) { toast.error("Informe a duração em minutos."); return; }
    if (ownPct != null && !(ownPct >= 0 && ownPct <= 100)) { toast.error("A comissão vai de 0 a 100%."); return; }
    setSaving(true);
    const body = {
      name: f.name.trim(), description: f.description.trim() || undefined, price: parseMoney(f.price), duration,
      imageUrl: f.imageUrl.trim() || null, materialCost: parseMoney(f.materialCost), commission: ownPct, onlineBooking: f.onlineBooking, active: f.active,
    };
    const r = await fetch(isNew ? "/api/barbershop/services" : `/api/barbershop/services/${service!.id}`, {
      method: isNew ? "POST" : "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível salvar."); return; }
    toast.success(isNew ? "Serviço criado" : override?.active === false ? "Serviço desativado" : override?.active ? "Serviço reativado" : "Serviço salvo");
    if (override) setForm(f);
    onSaved(isNew ? d.service?.id : undefined);
  }

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 pr-12 xl:pr-5">
        <div className="min-w-0">
          <h2 className="font-display text-[21px] font-bold truncate">{isNew ? "Novo serviço" : service!.name}</h2>
          {!isNew && <p className="text-[13px] text-ink-3">{stat?.count ? `${stat.count} vezes este mês${stat.revenue ? ` · ${brl(stat.revenue)}` : ""}` : "não foi feito este mês"}</p>}
        </div>
        {!isNew && (
          <span className="flex items-center gap-2 text-[13px] font-semibold shrink-0">
            {form.active ? "Ativo" : "Inativo"}
            <Switch checked={form.active} label="Ativo" onChange={(v) => (v ? save({ active: true }) : setConfirmOff(true))} />
          </span>
        )}
      </div>

      <Section title="Serviço">
        <Field label="Nome do serviço" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: Corte degradê" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço" prefix="R$" value={form.price} onChange={(e) => set("price", e.target.value)} inputMode="decimal" placeholder="0,00" />
          <Field label="Duração" suffix="min" value={form.duration} onChange={(e) => set("duration", e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
        </div>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-line-2 p-3">
          <span className="text-sm">
            <span className="font-semibold block">Agendamento online</span>
            <span className="text-xs text-ink-3">{form.onlineBooking ? "O cliente pode agendar sozinho pelo link." : "Só a barbearia marca (no balcão ou pelo painel)."}</span>
          </span>
          <Switch checked={form.onlineBooking} label="Agendamento online" onChange={(v) => set("onlineBooking", v)} />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-ink-2">Descrição <span className="font-normal text-ink-3">· opcional, o cliente vê embaixo do nome</span></span>
          <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} maxLength={160} className={cn(fieldCls, "h-auto py-2.5 resize-none")} />
        </label>
        <Field label="Foto (link da imagem)" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://… (opcional)" />
      </Section>

      <Section title="Custo e comissão">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Custo de material" prefix="R$" value={form.materialCost} onChange={(e) => set("materialCost", e.target.value)} inputMode="decimal" placeholder="0,00" />
          <Field label="Comissão própria" suffix="%" value={form.commission} onChange={(e) => set("commission", e.target.value)} inputMode="decimal" placeholder="do barbeiro" />
        </div>
        <p className="text-xs text-ink-3">O material (química, tinta) é descontado antes de calcular a comissão. Deixe a comissão em branco para usar a de cada barbeiro.</p>
        {price > 0 && (
          <div className="rounded-xl bg-surface-3/60 p-3 text-[13px] flex flex-col gap-1">
            <div className="flex justify-between"><span className="text-ink-3">Cliente paga</span><span>{formatCurrency(price)}</span></div>
            {cost > 0 && <div className="flex justify-between"><span className="text-ink-3">Material</span><span>− {formatCurrency(cost)}</span></div>}
            {com != null && <div className="flex justify-between"><span className="text-ink-3">Comissão ({comPct}%{ownPct == null ? " do barbeiro" : ""})</span><span>− {formatCurrency(com)}</span></div>}
            {com != null && <div className="flex justify-between font-semibold border-t border-line-2 pt-1 mt-0.5"><span>Fica para a barbearia</span><span>{formatCurrency(price - cost - com)}</span></div>}
          </div>
        )}
      </Section>

      <div className="px-5 py-4 border-t border-line-2 flex items-center gap-2 sticky bottom-0 bg-surface">
        <Button variant="outline" className="ml-auto" onClick={() => (dirty && !isNew ? setForm(init()) : onClose())}>{dirty && !isNew ? "Descartar" : "Fechar"}</Button>
        <Button loading={saving} disabled={!dirty} onClick={() => save()}>{isNew ? "Criar serviço" : "Salvar"}</Button>
      </div>

      <ConfirmDialog isOpen={confirmOff} title={`Desativar ${service?.name}?`}
        message="Ele some do link e da agenda para novos horários. O histórico continua, e dá para reativar quando quiser."
        confirmLabel="Desativar" onConfirm={() => { setConfirmOff(false); save({ active: false }); }} onCancel={() => setConfirmOff(false)} />
    </div>
  );
}
