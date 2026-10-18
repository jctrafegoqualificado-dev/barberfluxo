"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field, Section, Segmented, SidePanel, Switch, useWide } from "@/components/catalogo/SidePanel";

interface Barber {
  id: string; nickname: string | null; photoUrl: string | null; cpf: string | null;
  active: boolean; onVacation: boolean; createdAt: string;
  dayOff: number | null; workStart: string | null; workEnd: string | null;
  commission: number; commissionType: string; productCommission: number; productCommissionType: string;
  user: { id: string; name: string; email: string; phone: string | null; birthday: string | null };
}
interface Stat { count: number; revenue: number; commission: number }
interface Hour { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }
type Status = "all" | "active" | "vacation" | "inactive";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAYS_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MSHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const brl0 = (v: number) => formatCurrency(Math.round(v)).replace(",00", "");
const statusOf = (b: Barber): Exclude<Status, "all"> => (b.onVacation ? "vacation" : b.active ? "active" : "inactive");
const rule = (b: Barber) => (b.commissionType === "FIXED" ? `${brl0(b.commission)} por serviço` : `${b.commission}% dos serviços`);
const spToday = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());

interface Form {
  name: string; nickname: string; phone: string; cpf: string; birthday: string; email: string; password: string;
  commission: string; dayOff: number | null; workStart: string; workEnd: string;
}
const toForm = (b?: Barber): Form => ({
  name: b?.user.name ?? "", nickname: b?.nickname ?? "", phone: b?.user.phone ?? "", cpf: b?.cpf ?? "",
  birthday: b?.user.birthday ? b.user.birthday.slice(0, 10) : "", email: b?.user.email ?? "", password: "",
  commission: String(b?.commission ?? 50), dayOff: b?.dayOff ?? null, workStart: b?.workStart ?? "", workEnd: b?.workEnd ?? "",
});

export default function ProfissionaisPage() {
  const { token } = useAuthStore();
  const wide = useWide();
  const [barbers, setBarbers] = useState<Barber[] | null>(null);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [hours, setHours] = useState<Hour[]>([]);
  const [status, setStatus] = useState<Status>("all");
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const month = MONTHS[Number(spToday().slice(5, 7)) - 1];

  const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const load = useCallback(async () => {
    const [b, c, h] = await Promise.all([
      fetch("/api/barbershop/barbers?includeInactive=true", { headers: auth }).then((r) => r.json()),
      fetch("/api/barbershop/comissoes?month=0", { headers: auth }).then((r) => (r.ok ? r.json() : { barbers: [] })),
      fetch("/api/barbershop/horarios", { headers: auth }).then((r) => (r.ok ? r.json() : { hours: [] })),
    ]);
    setBarbers(b.barbers || []);
    const st: Record<string, Stat> = {};
    for (const x of c.barbers || []) {
      st[x.id] = { count: x.avulso.atendimentos + (x.assinatura.atendimentos ?? 0), revenue: x.avulso.faturado, commission: x.totalComissao };
    }
    setStats(st);
    setHours(h.hours || []);
  }, [auth]);
  useEffect(() => { load(); }, [load]);

  // No computador já abre o primeiro
  useEffect(() => {
    if (wide && barbers?.length && selected === null) setSelected(barbers[0].id);
  }, [wide, barbers, selected]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, vacation: 0, inactive: 0 };
    for (const b of barbers ?? []) { c.all++; c[statusOf(b)]++; }
    return c;
  }, [barbers]);
  const rows = (barbers ?? []).filter((b) => status === "all" || statusOf(b) === status);
  const total = Object.values(stats).reduce((a, s) => ({ count: a.count + s.count, revenue: a.revenue + s.revenue, commission: a.commission + s.commission }), { count: 0, revenue: 0, commission: 0 });
  const maxRev = Math.max(1, ...Object.values(stats).map((s) => s.revenue));
  const sel = barbers?.find((b) => b.id === selected);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Profissionais</h1>
          <span className="text-sm text-ink-3">{barbers ? `${counts.active} ${counts.active === 1 ? "atendendo" : "atendendo"} · ${total.count} atendimentos em ${month}` : " "}</span>
        </div>
        <div className="flex gap-2">
          <Link href="/painel/comissoes" className="hidden sm:inline-flex h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold items-center hover:bg-surface-3">Ver comissões</Link>
          <button type="button" onClick={() => setSelected("new")} className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
            <Plus className="w-4 h-4" aria-hidden /> Novo profissional
          </button>
        </div>
      </header>

      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <section className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-line-2">
              <Segmented value={status} onChange={setStatus} label="Situação"
                options={[["all", `Todos ${counts.all}`], ["active", `Ativos ${counts.active}`], ["vacation", `Em férias ${counts.vacation}`], ["inactive", `Inativos ${counts.inactive}`]]} />
            </div>
            {!barbers ? (
              <div className="h-48 animate-pulse bg-surface-3/50" aria-busy />
            ) : rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-ink-3">Ninguém nesta situação.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="text-xs text-ink-3 border-b border-line-2">
                      <th scope="col" className="text-left font-semibold px-4 py-2.5">Profissional</th>
                      <th scope="col" className="text-right font-semibold px-3">Atendimentos</th>
                      <th scope="col" className="text-right font-semibold px-3">Faturou</th>
                      <th scope="col" className="text-right font-semibold px-3">Comissão</th>
                      <th scope="col" className="text-left font-semibold px-3 pr-4">Folga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-3">
                    {rows.map((b) => {
                      const s = stats[b.id];
                      const st = statusOf(b);
                      const on = selected === b.id;
                      return (
                        <tr key={b.id} onClick={() => setSelected(b.id)} aria-current={on || undefined}
                          className={cn("cursor-pointer", on ? "bg-primary/[0.07]" : "hover:bg-surface-3/50", st === "inactive" && "opacity-70")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center shrink-0", on ? "bg-primary text-white" : "bg-surface-2 text-ink-2")}>{getInitials(b.user.name)}</div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold flex items-center gap-1.5">
                                  <span className="truncate">{b.user.name}</span>
                                  {st !== "active" && <span className={cn("h-5 px-2 rounded-full text-[11px] font-semibold inline-flex items-center shrink-0", st === "vacation" ? "bg-warning-soft text-warning" : "bg-surface-2 text-ink-2")}>{st === "vacation" ? "Em férias" : "Inativo"}</span>}
                                </p>
                                {s && s.revenue > 0 && <div className="h-1 rounded-full bg-track mt-1.5 overflow-hidden max-w-[180px]" aria-hidden><div className={cn("h-full", on ? "bg-primary" : "bg-ink")} style={{ width: `${(s.revenue / maxRev) * 100}%` }} /></div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 text-right">{s?.count || "—"}</td>
                          <td className="px-3 text-right">
                            <p>{s?.revenue ? brl0(s.revenue) : "—"}</p>
                            {s?.count ? <p className="text-xs text-ink-3">ticket {brl0(s.revenue / Math.max(1, s.count))}</p> : null}
                          </td>
                          <td className="px-3 text-right">
                            <p>{s?.commission ? brl0(s.commission) : "—"}</p>
                            <p className="text-xs text-ink-3">{rule(b)}</p>
                          </td>
                          <td className="px-3 pr-4 text-ink-2">{b.dayOff === null ? "—" : DAYS_FULL[b.dayOff]}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-surface-3/40 font-semibold">
                      <td className="px-4 py-3">Equipe em {month}</td>
                      <td className="px-3 text-right">{total.count}</td>
                      <td className="px-3 text-right">{brl0(total.revenue)}</td>
                      <td className="px-3 text-right">{brl0(total.commission)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {barbers && <Semana barbers={barbers.filter((b) => b.active || b.onVacation)} hours={hours} />}
        </div>

        <SidePanel open={!!selected && (selected === "new" || !!sel)} wide={wide} onClose={() => setSelected(null)} label="Editar profissional">
          {selected === "new" ? (
            <Editor key="new" stat={undefined} onClose={() => setSelected(null)} onSaved={(id) => { load(); setSelected(id ?? null); }} />
          ) : sel ? (
            <Editor key={sel.id} barber={sel} stat={stats[sel.id]} month={month} onClose={() => setSelected(null)} onSaved={() => load()} onDeleted={() => { setSelected(null); load(); }} />
          ) : null}
        </SidePanel>
      </div>
    </div>
  );
}

/* ─── Quem trabalha nesta semana ─── */
function Semana({ barbers, hours }: { barbers: Barber[]; hours: Hour[] }) {
  const today = spToday();
  const base = new Date(today + "T12:00:00Z");
  const monday = new Date(base.getTime() - ((base.getUTCDay() + 6) % 7) * 86_400_000);
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * 86_400_000));
  const hourOf = (dow: number) => hours.find((h) => h.dayOfWeek === dow);
  const openDays = days.filter((d) => hourOf(d.getUTCDay())?.isOpen);
  if (openDays.length === 0 || barbers.length === 0) return null;
  const range = `${days[0].getUTCDate()} a ${days[6].getUTCDate()} de ${MSHORT[days[6].getUTCMonth()]}`;

  return (
    <section className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-3">
      <div>
        <h2 className="text-[15px] font-semibold">Quem trabalha nesta semana</h2>
        <p className="text-[13px] text-ink-3">{range}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[560px]">
          <thead>
            <tr>
              <th scope="col" className="text-left font-semibold text-ink-3 pb-2 pr-3"><span className="sr-only">Profissional</span></th>
              {openDays.map((d) => {
                const h = hourOf(d.getUTCDay())!;
                const isToday = d.toISOString().slice(0, 10) === today;
                return (
                  <th key={d.toISOString()} scope="col" className={cn("text-center font-semibold pb-2 px-1", isToday ? "text-primary" : "text-ink-3")}>
                    {DAYS[d.getUTCDay()]} {d.getUTCDate()}
                    <span className="block text-[11px] font-normal">{h.openTime}–{h.closeTime}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {barbers.map((b) => (
              <tr key={b.id} className="border-t border-line-3">
                <td className="py-2 pr-3 font-semibold whitespace-nowrap">{b.nickname || b.user.name.split(" ")[0]}</td>
                {openDays.map((d) => {
                  const dow = d.getUTCDay();
                  const off = b.onVacation ? "férias" : b.dayOff === dow ? "folga" : null;
                  const h = hourOf(dow)!;
                  const start = b.workStart && b.workStart > h.openTime ? b.workStart : h.openTime;
                  const end = b.workEnd && b.workEnd < h.closeTime ? b.workEnd : h.closeTime;
                  return (
                    <td key={d.toISOString()} className="px-1 py-1.5 text-center">
                      <span className={cn("block rounded-lg px-1.5 py-1.5 text-xs",
                        off === "férias" ? "bg-warning-soft text-warning font-semibold" : off ? "bg-surface-3 text-ink-3" : "bg-positive-soft text-positive font-semibold")}>
                        {off ?? `${start}–${end}`}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">Imprevisto de um dia? Use “Bloquear horário” na agenda.</p>
    </section>
  );
}

/* ─── Editor ─── */
function Editor({ barber, stat, month, onClose, onSaved, onDeleted }: {
  barber?: Barber; stat?: Stat; month?: string; onClose: () => void; onSaved: (id?: string) => void; onDeleted?: () => void;
}) {
  const { token } = useAuthStore();
  const isNew = !barber;
  const [form, setForm] = useState<Form>(() => toForm(barber));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(barber));
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  async function patchState(body: object, ok: string) {
    const r = await fetch("/api/barbershop/barbers", { method: "PATCH", headers, body: JSON.stringify({ barberId: barber!.id, ...body }) });
    if (r.ok) { toast.success(ok); onSaved(); } else toast.error((await r.json().catch(() => ({}))).error ?? "Não foi possível salvar.");
  }

  async function save() {
    const commission = Number(form.commission.replace(",", "."));
    if (!form.name.trim()) { toast.error("Informe o nome."); return; }
    if (!(commission >= 0) || (barber?.commissionType !== "FIXED" && commission > 100)) { toast.error("Comissão inválida."); return; }
    if ((form.workStart && !form.workEnd) || (!form.workStart && form.workEnd)) { toast.error("Informe o início e o fim do horário, ou deixe os dois vazios."); return; }
    setSaving(true);
    const body = {
      name: form.name.trim(), nickname: form.nickname, phone: form.phone, cpf: form.cpf,
      birthday: form.birthday ? `${form.birthday}T12:00:00Z` : "", commission,
      dayOff: form.dayOff ?? "", workStart: form.workStart, workEnd: form.workEnd,
      ...(form.password ? { password: form.password } : {}),
    };
    const r = await fetch("/api/barbershop/barbers", {
      method: isNew ? "POST" : "PATCH", headers,
      body: JSON.stringify(isNew ? { ...body, email: form.email.trim() } : { ...body, barberId: barber!.id }),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível salvar."); return; }
    toast.success(isNew ? `${form.name.split(" ")[0]} entrou na equipe` : "Alterações salvas");
    onSaved(isNew ? d.barber?.id : undefined);
  }

  async function remove() {
    setConfirmDelete(false);
    const r = await fetch("/api/barbershop/barbers", { method: "DELETE", headers, body: JSON.stringify({ barberId: barber!.id }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível excluir."); return; }
    toast.success(d.mode === "archived" ? "Profissional removido. O histórico dele continua nos relatórios." : "Profissional excluído");
    onDeleted?.();
  }

  const since = barber ? new Date(barber.createdAt) : null;
  const st = barber ? statusOf(barber) : "active";

  return (
    <div className="flex flex-col">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
        <div className="flex items-center gap-3 pr-8">
          <div className="w-[52px] h-[52px] rounded-full bg-surface-2 text-ink-2 text-[17px] font-bold flex items-center justify-center shrink-0">{form.name ? getInitials(form.name) : "?"}</div>
          <div className="min-w-0">
            <h2 className="font-display text-[21px] font-bold truncate">{isNew ? "Novo profissional" : barber!.user.name}</h2>
            {since && <p className="text-[13px] text-ink-3">na equipe desde {MSHORT[since.getMonth()]}/{since.getFullYear()}</p>}
          </div>
        </div>
        {!isNew && (
          <div className="flex flex-col gap-2 rounded-xl border border-line-2 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span><span className="font-semibold">Ativo</span> <span className="text-ink-3">· aparece na agenda e no link</span></span>
              <Switch checked={barber!.active} label="Ativo" onChange={(v) => patchState({ active: v }, v ? "Profissional ativado" : "Profissional desativado")} />
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span><span className="font-semibold">Em férias</span> <span className="text-ink-3">· some da agenda até voltar</span></span>
              <Switch checked={barber!.onVacation} label="Em férias" onChange={(v) => patchState({ onVacation: v }, v ? "Boas férias! Ele saiu da agenda." : "Férias encerradas")} />
            </div>
            {st === "inactive" && <p className="text-xs text-ink-3">Inativo: não recebe agendamentos.</p>}
          </div>
        )}
        {!isNew && (
          <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden bg-line-2 border border-line-2 text-center">
            {[["Atendimentos", stat?.count ? String(stat.count) : "0"], ["Faturou", brl0(stat?.revenue ?? 0)], ["Comissão", brl0(stat?.commission ?? 0)]].map(([l, v]) => (
              <div key={l} className="bg-surface p-2.5"><p className="text-[11px] text-ink-3">{l}</p><p className="text-[15px] font-bold">{v}</p></div>
            ))}
            <p className="col-span-3 bg-surface text-[11px] text-ink-3 pb-2">{month} até hoje</p>
          </div>
        )}
      </div>

      <Section title="Dados">
        <Field label="Nome completo" value={form.name} onChange={(e) => set("name", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Apelido" value={form.nickname} onChange={(e) => set("nickname", e.target.value)} placeholder="Ex.: Diego" />
          <Field label="WhatsApp" value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
          <Field label="CPF" value={form.cpf} onChange={(e) => set("cpf", e.target.value)} inputMode="numeric" />
          <Field label="Nascimento" type="date" value={form.birthday} onChange={(e) => set("birthday", e.target.value)} />
        </div>
        <p className="text-xs text-ink-3">Apelido, CPF e nascimento são opcionais. O apelido aparece para o cliente no link.</p>
      </Section>

      <Section title="Comissão">
        <Field label="Serviços avulsos" suffix={barber?.commissionType === "FIXED" ? "R$ por serviço" : "% do valor"} value={form.commission}
          onChange={(e) => set("commission", e.target.value)} inputMode="decimal" />
        <p className="text-xs text-ink-3">
          Produtos: {barber?.productCommissionType === "FIXED" ? `${brl0(barber.productCommission)} por venda` : `${barber?.productCommission ?? 10}% das vendas`}, ou a regra de cada produto.{" "}
          <Link href="/painel/comissoes" className="underline underline-offset-2">Mudar em Comissões</Link>
        </p>
      </Section>

      <Section title="Folga e horário">
        <div>
          <span className="block text-[13px] font-semibold text-ink-2 mb-1.5">Dia de folga fixo</span>
          <div role="radiogroup" aria-label="Dia de folga" className="flex gap-1.5 flex-wrap">
            {[null, 0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button key={String(d)} type="button" role="radio" aria-checked={form.dayOff === d} onClick={() => set("dayOff", d)}
                className={cn("h-9 px-2.5 rounded-lg border text-[13px] font-semibold", form.dayOff === d ? "bg-ink text-white border-ink" : "bg-surface border-control hover:bg-surface-3")}>
                {d === null ? "Nenhum" : DAYS[d]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Começa às" type="time" value={form.workStart} onChange={(e) => set("workStart", e.target.value)} />
          <Field label="Termina às" type="time" value={form.workEnd} onChange={(e) => set("workEnd", e.target.value)} />
        </div>
        <p className="text-xs text-ink-3">
          {form.workStart || form.workEnd ? "Fora desse horário a agenda não oferece horários com ele." : "Vazio = igual ao horário da barbearia."}
          {(form.workStart || form.workEnd) && <button type="button" onClick={() => setForm((f) => ({ ...f, workStart: "", workEnd: "" }))} className="ml-1 underline underline-offset-2">Usar o da barbearia</button>}
        </p>
      </Section>

      <Section title="Acesso ao sistema">
        <Field label="E-mail de entrada" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} disabled={!isNew}
          hint={isNew ? "Ele entra com este e-mail." : "O e-mail não pode ser trocado depois do cadastro."} />
        <Field label={isNew ? "Senha" : "Nova senha"} type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)}
          placeholder={isNew ? "Mínimo 6 caracteres" : "Deixe vazio para manter"} hint="Com esse acesso ele vê a própria agenda e os próprios ganhos." />
      </Section>

      <div className="px-5 py-4 border-t border-line-2 flex items-center gap-2 sticky bottom-0 bg-surface">
        {!isNew && <button type="button" onClick={() => setConfirmDelete(true)} className="text-[13px] font-semibold text-danger hover:underline mr-auto">Excluir</button>}
        <Button variant="outline" className={cn(isNew && "ml-auto")} onClick={() => (dirty && !isNew ? setForm(toForm(barber)) : onClose())}>{dirty && !isNew ? "Descartar" : "Fechar"}</Button>
        <Button loading={saving} disabled={!dirty || (isNew && (!form.email.trim() || form.password.length < 6))} onClick={save}>{isNew ? "Cadastrar" : "Salvar alterações"}</Button>
      </div>

      <ConfirmDialog isOpen={confirmDelete} title={`Excluir ${barber?.user.name.split(" ")[0]}?`}
        message="Se ele já atendeu, o histórico (atendimentos, comissões, vendas) continua nos relatórios. Horários marcados para frente precisam ser remarcados antes."
        confirmLabel="Excluir" onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
    </div>
  );
}
