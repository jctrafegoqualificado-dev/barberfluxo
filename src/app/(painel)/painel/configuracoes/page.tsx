"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Field, fieldCls } from "@/components/catalogo/SidePanel";
import { ConfigNav, ConfigSection, Pills, ToggleRow, type NavSection } from "@/components/config/ConfigNav";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0]; // segunda primeiro
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const RET_DEFAULT = "Olá, {{nome}}! 😊\n\nSentimos sua falta! Faz {{dias}} dias que você não passa por aqui.\n\nQue tal agendar um horário? Estamos te esperando na {{empresa}}! ✂️";
const RET_VARS: [string, string][] = [["{{nome}}", "Nome do cliente"], ["{{dias}}", "Dias sem vir"], ["{{empresa}}", "Nome da barbearia"]];

interface Hour { dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }
interface Special { id: string; date: string; isClosed: boolean; openTime: string | null; closeTime: string | null; reason: string | null }
interface Dados {
  name: string; phone: string; contactEmail: string; instagram: string; cnpj: string;
  zipCode: string; address: string; streetNumber: string; streetComplement: string; neighborhood: string; city: string; state: string;
  ownerName: string; ownerEmail: string; slug: string;
}
interface Regras {
  cancelByClientEnabled: boolean; minCancelHours: number; autoNoShowEnabled: boolean; autoNoShowHours: number; reminderMinutes: number;
  discountServicesEnabled: boolean; discountServicesMax: number; discountProductsEnabled: boolean; discountProductsMax: number;
}
interface Retencao { retentionEnabled: boolean; retentionDays: number; retentionMessage: string }

const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const hText = (min: number) => (min <= 0 ? "—" : `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`);
const defaultHours = (): Hour[] => DAYS.map((_, i) => ({ dayOfWeek: i, isOpen: i >= 1 && i <= 6, openTime: "09:00", closeTime: "20:00" }));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function ConfiguracoesPage() {
  const { token } = useAuthStore();
  const h = useMemo(() => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }), [token]);

  const [dados, setDados] = useState<Dados | null>(null);
  const [dados0, setDados0] = useState<Dados | null>(null);
  const [hours, setHours] = useState<Hour[]>(defaultHours());
  const [hours0, setHours0] = useState<Hour[]>(defaultHours());
  const [specials, setSpecials] = useState<Special[]>([]);
  const [regras, setRegras] = useState<Regras | null>(null);
  const [regras0, setRegras0] = useState<Regras | null>(null);
  const [ret, setRet] = useState<Retencao | null>(null);
  const [ret0, setRet0] = useState<Retencao | null>(null);
  const [mp, setMp] = useState<boolean | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [active, setActive] = useState("dados");

  useEffect(() => {
    const g = (u: string) => fetch(u, { headers: h }).then((r) => r.json()).catch(() => ({}));
    Promise.all([g("/api/barbershop/profile"), g("/api/barbershop/financeiro"), g("/api/barbershop/retention"), g("/api/barbershop/horarios"), g("/api/barbershop/special-days"), g("/api/barbershop/settings"), g("/api/barbershop/payment-config")])
      .then(([p, f, r, hr, sd, st, pc]) => {
        const d: Dados = {
          name: p.name ?? "", phone: p.phone ?? "", contactEmail: p.contactEmail ?? "", instagram: p.instagram ?? "", cnpj: p.cnpj ?? "",
          zipCode: p.zipCode ?? "", address: p.address ?? "", streetNumber: p.streetNumber ?? "", streetComplement: p.streetComplement ?? "",
          neighborhood: p.neighborhood ?? "", city: p.city ?? "", state: p.state ?? "", ownerName: p.ownerName ?? "", ownerEmail: p.ownerEmail ?? "", slug: p.slug ?? st.slug ?? "",
        };
        setDados(d); setDados0(d);
        const rg: Regras = {
          cancelByClientEnabled: f.cancelByClientEnabled ?? true, minCancelHours: Number(f.minCancelHours ?? 0),
          autoNoShowEnabled: f.autoNoShowEnabled ?? true, autoNoShowHours: Number(f.autoNoShowHours ?? 24), reminderMinutes: Number(f.reminderMinutes ?? 60),
          discountServicesEnabled: !!f.discountServicesEnabled, discountServicesMax: Number(f.discountServicesMax ?? 20),
          discountProductsEnabled: !!f.discountProductsEnabled, discountProductsMax: Number(f.discountProductsMax ?? 20),
        };
        setRegras(rg); setRegras0(rg);
        const rt: Retencao = { retentionEnabled: !!r.retentionEnabled, retentionDays: Number(r.retentionDays ?? 45), retentionMessage: r.retentionMessage || "" };
        setRet(rt); setRet0(rt);
        const filled = defaultHours().map((def) => (hr.hours ?? []).find((x: Hour) => x.dayOfWeek === def.dayOfWeek) ?? def);
        setHours(filled); setHours0(filled);
        setSpecials(sd.days ?? []);
        setMp(!!pc.connected);
      });
  }, [h]);

  // Seção visível (destaque na navegação)
  useEffect(() => {
    const ids = ["dados", "horarios", "agendamento", "descontos"];
    const io = new IntersectionObserver((es) => {
      const v = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (v) setActive(v.target.id);
    }, { rootMargin: "-20% 0px -60% 0px" });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [dados]);

  const save = useCallback(async (key: string, url: string, method: string, body: unknown, done: () => void, ok = "Salvo") => {
    setSaving(key);
    const r = await fetch(url, { method, headers: h, body: JSON.stringify(body) });
    setSaving(null);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível salvar."); return; }
    toast.success(ok);
    done();
  }, [h]);

  const open = hours.filter((x) => x.isOpen);
  const weekMin = open.reduce((s, x) => s + Math.max(0, toMin(x.closeTime) - toMin(x.openTime)), 0);
  const firstOpen = open.length ? ORDER.map((i) => hours[i]).find((x) => x.isOpen) : null;
  const hoursHint = open.length ? `${open.length} dias · ${firstOpen?.openTime.replace(":00", "h")} às ${firstOpen?.closeTime.replace(":00", "h")}` : "Fechado";

  const sections: NavSection[] = [
    { id: "dados", label: "Dados da barbearia", hint: "Nome, contato e senha" },
    { id: "horarios", label: "Horários", hint: hoursHint },
    { id: "agendamento", label: "Agendamento online", hint: "Link, desmarcar e faltas" },
    { id: "descontos", label: "Descontos", hint: regras?.discountServicesEnabled ? `Até ${regras.discountServicesMax}% em serviços` : "Sem desconto em serviços" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Configurações</h1>
        <span className="text-sm text-ink-3">Como {dados?.name || "a barbearia"} funciona: horários, agendamento e regras do caixa</span>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <ConfigNav current="geral" sections={sections} active={active} other={{ pagamentos: mp == null ? undefined : mp ? "Mercado Pago ligado" : "Mercado Pago desligado" }} />

        <div className="flex-1 min-w-0 flex flex-col gap-5 w-full">
          {!dados || !regras || !ret ? <div className="h-96 rounded-2xl bg-surface-3/60 animate-pulse" /> : (
            <>
              <DadosSection dados={dados} set={setDados} dirty={!same(dados, dados0)} saving={saving === "dados"}
                onReset={() => setDados(dados0)}
                onSave={() => save("dados", "/api/barbershop/profile", "PATCH", {
                  name: dados.name.trim(), phone: dados.phone, contactEmail: dados.contactEmail, instagram: dados.instagram, cnpj: dados.cnpj,
                  zipCode: dados.zipCode, address: dados.address, streetNumber: dados.streetNumber, streetComplement: dados.streetComplement,
                  neighborhood: dados.neighborhood, city: dados.city, state: dados.state, ownerName: dados.ownerName.trim() || undefined,
                }, () => setDados0(dados), "Dados salvos")} />

              <HorariosSection hours={hours} setHours={setHours} weekMin={weekMin} dirty={!same(hours, hours0)} saving={saving === "horarios"}
                onReset={() => setHours(hours0)}
                onSave={() => {
                  const bad = hours.find((x) => x.isOpen && toMin(x.closeTime) <= toMin(x.openTime));
                  if (bad) { toast.error(`${DAYS[bad.dayOfWeek]}: o horário de fechar precisa ser depois do de abrir.`); return; }
                  save("horarios", "/api/barbershop/horarios", "PUT", { hours }, () => setHours0(hours), "Horários salvos");
                }}
                specials={specials} setSpecials={setSpecials} h={h} />

              <AgendamentoSection slug={dados.slug} shopName={dados.name} regras={regras} setRegras={setRegras} ret={ret} setRet={setRet}
                dirty={!same(regras, regras0) || !same(ret, ret0)} saving={saving === "agendamento"}
                onReset={() => { setRegras(regras0); setRet(ret0); }}
                onSave={async () => {
                  setSaving("agendamento");
                  const [a, b] = await Promise.all([
                    fetch("/api/barbershop/financeiro", { method: "PATCH", headers: h, body: JSON.stringify({
                      cancelByClientEnabled: regras.cancelByClientEnabled, minCancelHours: regras.minCancelHours,
                      autoNoShowEnabled: regras.autoNoShowEnabled, autoNoShowHours: regras.autoNoShowHours, reminderMinutes: regras.reminderMinutes,
                    }) }),
                    fetch("/api/barbershop/retention", { method: "PATCH", headers: h, body: JSON.stringify({
                      retentionEnabled: ret.retentionEnabled, retentionDays: ret.retentionDays, retentionMessage: ret.retentionMessage.trim() || null,
                    }) }),
                  ]);
                  setSaving(null);
                  if (!a.ok || !b.ok) { toast.error("Parte não foi salva. Tente de novo."); return; }
                  toast.success("Agendamento online salvo");
                  setRegras0((r0) => r0 && { ...r0, cancelByClientEnabled: regras.cancelByClientEnabled, minCancelHours: regras.minCancelHours, autoNoShowEnabled: regras.autoNoShowEnabled, autoNoShowHours: regras.autoNoShowHours, reminderMinutes: regras.reminderMinutes });
                  setRet0(ret);
                }} />

              <DescontosSection regras={regras} setRegras={setRegras}
                dirty={["discountServicesEnabled", "discountServicesMax", "discountProductsEnabled", "discountProductsMax"].some((k) => regras[k as keyof Regras] !== regras0?.[k as keyof Regras])}
                saving={saving === "descontos"}
                onReset={() => regras0 && setRegras({ ...regras, discountServicesEnabled: regras0.discountServicesEnabled, discountServicesMax: regras0.discountServicesMax, discountProductsEnabled: regras0.discountProductsEnabled, discountProductsMax: regras0.discountProductsMax })}
                onSave={() => save("descontos", "/api/barbershop/financeiro", "PATCH", {
                  discountServicesEnabled: regras.discountServicesEnabled, discountServicesMax: regras.discountServicesMax,
                  discountProductsEnabled: regras.discountProductsEnabled, discountProductsMax: regras.discountProductsMax,
                }, () => setRegras0((r0) => r0 && { ...r0, discountServicesEnabled: regras.discountServicesEnabled, discountServicesMax: regras.discountServicesMax, discountProductsEnabled: regras.discountProductsEnabled, discountProductsMax: regras.discountProductsMax }), "Descontos salvos")} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveBar({ dirty, saving, onSave, onReset }: { dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void }) {
  return (
    <>
      {dirty && <span className="text-xs text-warning font-semibold mr-auto">Mudanças não salvas</span>}
      {dirty && <Button variant="outline" size="sm" onClick={onReset}>Descartar</Button>}
      <Button size="sm" disabled={!dirty} loading={saving} onClick={onSave}>Salvar</Button>
    </>
  );
}

function DadosSection({ dados, set, dirty, saving, onSave, onReset }: {
  dados: Dados; set: (d: Dados) => void; dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void;
}) {
  const { token } = useAuthStore();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", again: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const f = (k: keyof Dados, v: string) => set({ ...dados, [k]: v });

  async function cep(raw: string) {
    const c = raw.replace(/\D/g, "");
    f("zipCode", raw);
    if (c.length !== 8) return;
    const d = await fetch(`https://viacep.com.br/ws/${c}/json/`).then((r) => r.json()).catch(() => null);
    if (!d || d.erro) { toast.error("CEP não encontrado."); return; }
    set({ ...dados, zipCode: raw, address: d.logradouro || dados.address, neighborhood: d.bairro || dados.neighborhood, city: d.localidade || dados.city, state: d.uf || dados.state });
  }

  async function changePwd() {
    if (pwd.next.length < 6) { toast.error("A nova senha precisa de pelo menos 6 caracteres."); return; }
    if (pwd.next !== pwd.again) { toast.error("As senhas novas não são iguais."); return; }
    setPwdSaving(true);
    const r = await fetch("/api/barbershop/profile/password", {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword: pwd.current, newPassword: pwd.next }),
    });
    setPwdSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível trocar a senha."); return; }
    toast.success("Senha trocada");
    setPwd({ current: "", next: "", again: "" });
    setPwdOpen(false);
  }

  return (
    <ConfigSection id="dados" title="Dados da barbearia" subtitle="Aparecem na página de agendamento e nas mensagens do WhatsApp"
      footer={<SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={onReset} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da barbearia" value={dados.name} onChange={(e) => f("name", e.target.value)} />
        <Field label="Telefone / WhatsApp" type="tel" value={dados.phone} onChange={(e) => f("phone", e.target.value)} placeholder="(11) 99999-9999" />
        <Field label="E-mail de contato" type="email" value={dados.contactEmail} onChange={(e) => f("contactEmail", e.target.value)} />
        <Field label="Instagram" value={dados.instagram} onChange={(e) => f("instagram", e.target.value)} placeholder="@suabarbearia" />
      </div>
      <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)_110px]">
        <Field label="CEP" inputMode="numeric" value={dados.zipCode} onChange={(e) => cep(e.target.value)} placeholder="00000-000" />
        <Field label="Endereço" value={dados.address} onChange={(e) => f("address", e.target.value)} hint="Digite o CEP e a rua, o bairro e a cidade são preenchidos sozinhos." />
        <Field label="Número" value={dados.streetNumber} onChange={(e) => f("streetNumber", e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_80px]">
        <Field label="Complemento" value={dados.streetComplement} onChange={(e) => f("streetComplement", e.target.value)} />
        <Field label="Bairro" value={dados.neighborhood} onChange={(e) => f("neighborhood", e.target.value)} />
        <Field label="Cidade" value={dados.city} onChange={(e) => f("city", e.target.value)} />
        <Field label="UF" value={dados.state} onChange={(e) => f("state", e.target.value.toUpperCase().slice(0, 2))} />
      </div>
      <Field label="CNPJ · opcional" inputMode="numeric" value={dados.cnpj} onChange={(e) => f("cnpj", e.target.value)} className="sm:max-w-xs" />

      <div className="rounded-xl bg-ground p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface-2 text-ink-2 font-bold text-sm flex items-center justify-center shrink-0">{getInitials(dados.ownerName || "D")}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Minha conta</p>
            <p className="text-xs text-ink-3">Entra no sistema com {dados.ownerEmail}. Para trocar o e-mail, fale com o suporte.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPwdOpen((v) => !v)} aria-expanded={pwdOpen}>{pwdOpen ? "Fechar" : "Trocar senha"}</Button>
        </div>
        <Field label="Seu nome" value={dados.ownerName} onChange={(e) => f("ownerName", e.target.value)} className="sm:max-w-sm" />
        {pwdOpen && (
          <div className="grid gap-3 sm:grid-cols-3 items-end">
            <Field label="Senha atual" type="password" autoComplete="current-password" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} />
            <Field label="Nova senha" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} />
            <Field label="Repita a nova senha" type="password" autoComplete="new-password" value={pwd.again} onChange={(e) => setPwd({ ...pwd, again: e.target.value })} />
            <Button size="sm" className="sm:col-span-3 justify-self-start" loading={pwdSaving} disabled={!pwd.current || !pwd.next} onClick={changePwd}>Trocar senha</Button>
          </div>
        )}
      </div>
    </ConfigSection>
  );
}

function HorariosSection({ hours, setHours, weekMin, dirty, saving, onSave, onReset, specials, setSpecials, h }: {
  hours: Hour[]; setHours: (h: Hour[]) => void; weekMin: number; dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void;
  specials: Special[]; setSpecials: (s: Special[]) => void; h: Record<string, string>;
}) {
  const [nd, setNd] = useState({ date: "", reason: "", isClosed: true, openTime: "09:00", closeTime: "18:00" });
  const [adding, setAdding] = useState(false);
  const today = new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const todayDow = new Date(`${today}T12:00:00Z`).getUTCDay();
  const upd = (d: number, patch: Partial<Hour>) => setHours(hours.map((x) => (x.dayOfWeek === d ? { ...x, ...patch } : x)));
  const SCALE = [6 * 60, 22 * 60];
  const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - SCALE[0]) / (SCALE[1] - SCALE[0])) * 100))}%`;
  const future = specials.filter((s) => s.date >= today).sort((a, b) => a.date.localeCompare(b.date));

  async function add() {
    if (!nd.date) { toast.error("Escolha a data."); return; }
    setAdding(true);
    const r = await fetch("/api/barbershop/special-days", { method: "POST", headers: h, body: JSON.stringify(nd) });
    setAdding(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível adicionar."); return; }
    setSpecials([...specials.filter((x) => x.date !== d.day.date), d.day]);
    setNd({ date: "", reason: "", isClosed: true, openTime: "09:00", closeTime: "18:00" });
    toast.success("Data adicionada");
  }
  async function remove(id: string) {
    const r = await fetch(`/api/barbershop/special-days/${id}`, { method: "DELETE", headers: h });
    if (!r.ok) { toast.error("Não foi possível remover."); return; }
    setSpecials(specials.filter((x) => x.id !== id));
  }

  return (
    <ConfigSection id="horarios" title="Horários de funcionamento" subtitle="Os clientes só conseguem marcar dentro destes horários. A ocupação também é calculada a partir deles."
      footer={<SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={onReset} />}>
      <div className="flex flex-col divide-y divide-line-3 rounded-xl border border-line-2">
        {ORDER.map((i) => {
          const x = hours[i];
          const len = x.isOpen ? toMin(x.closeTime) - toMin(x.openTime) : 0;
          return (
            <div key={i} className="grid grid-cols-[44px_minmax(0,1fr)] sm:grid-cols-[44px_110px_minmax(0,auto)_56px_minmax(0,1fr)] gap-x-3 gap-y-2 items-center px-3 py-2.5">
              <button type="button" role="switch" aria-checked={x.isOpen} aria-label={`Abre ${DAYS[i]}`} onClick={() => upd(i, { isOpen: !x.isOpen })}
                className={cn("relative w-11 h-6 rounded-full transition-colors", x.isOpen ? "bg-positive-strong" : "bg-bar")}>
                <span className={cn("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", x.isOpen && "translate-x-5")} />
              </button>
              <span className="text-sm font-semibold flex items-center gap-1.5">{DAYS[i]}{i === todayDow && <span className="h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[11px] inline-flex items-center">hoje</span>}</span>
              <div className="col-start-2 sm:col-start-auto flex items-center gap-2">
                {x.isOpen ? (
                  <>
                    <input type="time" value={x.openTime} onChange={(e) => upd(i, { openTime: e.target.value })} aria-label={`${DAYS[i]} abre`} className={cn(fieldCls, "h-10 w-[110px]")} />
                    <span className="text-xs text-ink-3">até</span>
                    <input type="time" value={x.closeTime} onChange={(e) => upd(i, { closeTime: e.target.value })} aria-label={`${DAYS[i]} fecha`} className={cn(fieldCls, "h-10 w-[110px]")} />
                  </>
                ) : <span className="text-sm text-ink-3">Fechado</span>}
              </div>
              <span className={cn("hidden sm:block text-[13px] text-right", len < 0 ? "text-danger font-semibold" : "text-ink-2")}>{x.isOpen ? (len > 0 ? hText(len) : "erro") : "—"}</span>
              <div className="hidden sm:block relative h-2 rounded-full bg-track" aria-hidden>
                {x.isOpen && len > 0 && <div className="absolute inset-y-0 rounded-full bg-ink" style={{ left: pct(toMin(x.openTime)), right: `calc(100% - ${pct(toMin(x.closeTime))})` }} />}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] text-ink-2">Aberto {hours.filter((x) => x.isOpen).length} dias por semana · {hText(weekMin)} de agenda por semana, por profissional.</p>

      <div className="flex flex-col gap-3 pt-4 border-t border-line-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-[15px] font-semibold">Feriados e dias diferentes</h3>
          <span className="text-[13px] text-ink-3">Datas em que a barbearia fecha ou abre em outro horário. Valem só para aquele dia e já salvam ao adicionar.</span>
        </div>
        {future.length > 0 && (
          <div className="flex flex-col divide-y divide-line-3 rounded-xl border border-line-2">
            {future.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-11 h-11 rounded-[10px] bg-ground flex flex-col items-center justify-center shrink-0">
                  <span className="text-sm font-bold leading-none">{Number(s.date.slice(8))}</span>
                  <span className="text-[10px] font-semibold text-ink-3 uppercase">{MONTHS[Number(s.date.slice(5, 7)) - 1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate flex items-center gap-1.5">{s.reason || (s.isClosed ? "Fechado" : "Horário diferente")}{idx === 0 && <span className="h-5 px-1.5 rounded-full bg-surface-2 text-ink-2 text-[11px] inline-flex items-center">próxima</span>}</p>
                  <p className="text-xs text-ink-3">{DAYS[new Date(`${s.date}T12:00:00Z`).getUTCDay()]}</p>
                </div>
                <span className={cn("text-[13px] font-semibold shrink-0", s.isClosed ? "text-danger" : "text-ink-2")}>{s.isClosed ? "Fechado" : `${s.openTime} – ${s.closeTime}`}</span>
                <button type="button" onClick={() => remove(s.id)} aria-label={`Remover ${s.date}`} className="w-9 h-9 rounded-lg text-ink-3 hover:bg-surface-3 flex items-center justify-center"><Trash2 className="w-4 h-4" aria-hidden /></button>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-xl bg-ground p-4 flex flex-col gap-3">
          <span className="text-[13px] font-semibold">Adicionar data</span>
          <div className="grid gap-3 sm:grid-cols-[170px_minmax(0,1fr)]">
            <Field label="Data" type="date" min={today} value={nd.date} onChange={(e) => setNd({ ...nd, date: e.target.value })} />
            <Field label="Motivo · opcional" value={nd.reason} onChange={(e) => setNd({ ...nd, reason: e.target.value })} placeholder="Ex.: feriado, evento, reforma" />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Nesse dia</span>
              <Pills label="Tipo de dia" value={nd.isClosed ? "closed" : "special"} onChange={(v) => setNd({ ...nd, isClosed: v === "closed" })} options={[["closed", "Fecha"], ["special", "Abre em outro horário"]]} />
            </div>
            {!nd.isClosed && (
              <>
                <Field label="Abre" type="time" value={nd.openTime} onChange={(e) => setNd({ ...nd, openTime: e.target.value })} className="w-[120px]" />
                <Field label="Fecha" type="time" value={nd.closeTime} onChange={(e) => setNd({ ...nd, closeTime: e.target.value })} className="w-[120px]" />
              </>
            )}
            <Button size="sm" variant="outline" className="h-11 ml-auto" loading={adding} onClick={add}>Adicionar data</Button>
          </div>
        </div>
      </div>
    </ConfigSection>
  );
}

function AgendamentoSection({ slug, shopName, regras, setRegras, ret, setRet, dirty, saving, onSave, onReset }: {
  slug: string; shopName: string; regras: Regras; setRegras: (r: Regras) => void; ret: Retencao; setRet: (r: Retencao) => void;
  dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void;
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = `${origin}/agendar/${slug}`;
  const r = (patch: Partial<Regras>) => setRegras({ ...regras, ...patch });
  const msg = ret.retentionMessage || RET_DEFAULT;
  const preview = msg.replace(/\{\{nome\}\}/g, "Rafael").replace(/\{\{dias\}\}/g, String(ret.retentionDays)).replace(/\{\{empresa\}\}/g, shopName || "barbearia").replace(/\{\{plural\}\}/g, "s");
  const insertVar = (v: string) => setRet({ ...ret, retentionMessage: (ret.retentionMessage || RET_DEFAULT) + (msg.endsWith(" ") || msg.endsWith("\n") ? "" : " ") + v });
  const reminderOpts: [number, string][] = [[30, "30 min"], [60, "1 hora"], [120, "2 horas"], [180, "3 horas"], [1440, "1 dia"]];
  const hrs = (n: number) => (n === 0 ? "a qualquer hora" : `até ${n} h antes`);

  return (
    <ConfigSection id="agendamento" title="Agendamento online" subtitle="Como o cliente marca, desmarca e é lembrado do horário"
      footer={<SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={onReset} />}>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">Link da sua página de agendamento</span>
        <div className="flex gap-2">
          <input readOnly value={url} aria-label="Link de agendamento" className={cn(fieldCls, "bg-ground")} onFocus={(e) => e.currentTarget.select()} />
          <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(url); toast.success("Link copiado"); }} aria-label="Copiar link"><Copy className="w-4 h-4" aria-hidden /></Button>
          <a href={`/agendar/${slug}`} target="_blank" rel="noreferrer" className="h-11 px-3.5 rounded-[10px] border border-control text-sm font-semibold inline-flex items-center gap-1.5 shrink-0"><ExternalLink className="w-4 h-4" aria-hidden />Abrir</a>
        </div>
        <span className="text-xs text-ink-3">Dica: coloque na bio do Instagram e no status do WhatsApp.</span>
      </div>

      <ToggleRow title="Cliente pode desmarcar pelo link" checked={regras.cancelByClientEnabled} onChange={(v) => r({ cancelByClientEnabled: v })}
        text={regras.cancelByClientEnabled ? `O cliente desmarca sozinho ${hrs(regras.minCancelHours)}. O horário volta a ficar livre e a lista de espera é avisada.` : "Para desmarcar, o cliente precisa falar com a barbearia."}>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Até quanto tempo antes do horário</span>
          <Pills label="Antecedência para desmarcar" value={regras.minCancelHours} onChange={(v) => r({ minCancelHours: v })}
            options={[[0, "A qualquer hora"], [1, "1 h"], [2, "2 h"], [4, "4 h"], [8, "8 h"], [12, "12 h"], [24, "24 h"], [48, "48 h"]]} />
        </div>
      </ToggleRow>

      <ToggleRow title="Marcar falta sozinho" checked={regras.autoNoShowEnabled} onChange={(v) => r({ autoNoShowEnabled: v })}
        text={regras.autoNoShowEnabled ? `Se ninguém fechar a comanda em ${regras.autoNoShowHours} h depois do horário, o atendimento vira falta.` : "Os horários ficam em aberto até alguém fechar a comanda ou marcar a falta."}>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Prazo para o barbeiro fechar o atendimento</span>
          <Pills label="Prazo para fechar o atendimento" value={regras.autoNoShowHours} onChange={(v) => r({ autoNoShowHours: v })}
            options={[[4, "4 h"], [8, "8 h"], [12, "12 h"], [24, "24 h · recomendado"], [48, "48 h"], [72, "72 h"]]} />
        </div>
      </ToggleRow>

      <div className="rounded-xl border border-line-2 p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[15px] font-semibold">Lembrete antes do horário</h3>
            <span className="text-[13px] text-ink-3">WhatsApp enviado antes do horário. Mensagem e confirmação ficam em Lembretes.</span>
          </div>
          <Link href="/painel/configuracoes/lembretes" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2 shrink-0">Lembretes</Link>
        </div>
        <Pills label="Quanto tempo antes" value={regras.reminderMinutes} onChange={(v) => r({ reminderMinutes: v })}
          options={reminderOpts.some(([v]) => v === regras.reminderMinutes) ? reminderOpts : [...reminderOpts, [regras.reminderMinutes, `${regras.reminderMinutes} min`]]} />
      </div>

      <ToggleRow title="Chamar de volta quem sumiu" checked={ret.retentionEnabled} onChange={(v) => setRet({ ...ret, retentionEnabled: v })}
        text={ret.retentionEnabled ? `Manda um WhatsApp para quem está há ${ret.retentionDays} dias sem vir.` : "Desligado. Ligue para lembrar quem está sumido de voltar."}>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-ink-2">Mandar quando o cliente está sem vir há</span>
          <Pills label="Dias sem vir" value={ret.retentionDays} onChange={(v) => setRet({ ...ret, retentionDays: v })}
            options={[[14, "14 dias"], [21, "21 dias"], [30, "30 dias"], [45, "45 dias · recomendado"], [60, "60 dias"], [90, "90 dias"]]} />
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Mensagem</span>
              <textarea rows={6} value={msg} onChange={(e) => setRet({ ...ret, retentionMessage: e.target.value })} aria-label="Mensagem para quem sumiu" className={cn(fieldCls, "h-auto py-2.5")} />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-3">Toque para inserir:</span>
              {RET_VARS.map(([v, l]) => <button key={v} type="button" onClick={() => insertVar(v)} className="h-7 px-2.5 rounded-full bg-surface-2 text-xs font-semibold">{l}</button>)}
            </div>
            <span className="text-xs text-ink-3">Vai no máximo uma vez a cada 30 dias para o mesmo cliente. Precisa do WhatsApp conectado.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Como o cliente recebe</span>
            <div className="rounded-xl bg-[#E6DED3] p-3">
              <div className="rounded-lg bg-white px-3 py-2 text-[13px] leading-snug whitespace-pre-line shadow-sm">{preview}<span className="block text-right text-[10px] text-ink-4 mt-1">10:00</span></div>
            </div>
          </div>
        </div>
      </ToggleRow>
    </ConfigSection>
  );
}

function DescontosSection({ regras, setRegras, dirty, saving, onSave, onReset }: {
  regras: Regras; setRegras: (r: Regras) => void; dirty: boolean; saving: boolean; onSave: () => void; onReset: () => void;
}) {
  const cards: { title: string; on: keyof Regras; max: keyof Regras; sample: string; price: number }[] = [
    { title: "Serviços", on: "discountServicesEnabled", max: "discountServicesMax", sample: "num corte de R$ 50", price: 50 },
    { title: "Produtos", on: "discountProductsEnabled", max: "discountProductsMax", sample: "numa pomada de R$ 45", price: 45 },
  ];
  return (
    <ConfigSection id="descontos" title="Descontos na comanda" subtitle="O barbeiro pode dar desconto na hora de fechar o atendimento. Você define o máximo; ele decide quanto usar."
      footer={<SaveBar dirty={dirty} saving={saving} onSave={onSave} onReset={onReset} />}>
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const on = regras[c.on] as boolean;
          const pct = regras[c.max] as number;
          return (
            <ToggleRow key={c.title} title={c.title} checked={on} onChange={(v) => setRegras({ ...regras, [c.on]: v })}
              text={on ? `Até ${pct}% de desconto` : "Sem desconto"}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink-2">Desconto máximo</span>
                <div className="flex items-center rounded-[9px] border border-control">
                  <button type="button" onClick={() => setRegras({ ...regras, [c.max]: Math.max(5, pct - 5) })} aria-label={`Diminuir desconto de ${c.title}`} className="w-9 h-9 text-lg">−</button>
                  <span className="w-14 text-center text-sm font-semibold">{pct}%</span>
                  <button type="button" onClick={() => setRegras({ ...regras, [c.max]: Math.min(100, pct + 5) })} aria-label={`Aumentar desconto de ${c.title}`} className="w-9 h-9 text-lg">+</button>
                </div>
              </div>
              <span className="text-xs text-ink-3 rounded-lg bg-ground px-3 py-2">Exemplo: {c.sample}, o desconto pode chegar a R$ {(c.price * pct / 100).toFixed(2).replace(".", ",")}.</span>
            </ToggleRow>
          );
        })}
      </div>
    </ConfigSection>
  );
}
