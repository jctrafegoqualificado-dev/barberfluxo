"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- assinatura vem crua da API de assinaturas */
import { useEffect, useMemo, useState } from "react";
import { X, Crown, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import { type Barber, getInitials, toMin, toHHMM, barberShortName, localDateStr } from "./types";

type Service = { id: string; name: string; price: number; duration: number };

export interface NovoAgendamentoData {
  clientName: string; clientPhone: string; barberId: string; serviceIds: string[];
  date: string; startTime: string; beneficiaryName?: string; price?: number; notifyClient?: boolean;
}

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Serviços cobertos pelo plano. A API devolve planServices[].service.id (formato antigo: serviceId). */
const planIdsOf = (sub: any): string[] =>
  (sub?.plan?.planServices ?? []).map((ps: any) => ps.service?.id ?? ps.serviceId).filter(Boolean);

/**
 * Novo agendamento (docs/design/Novo-agendamento.dc.html): cliente, serviços em cartões,
 * profissional, dia e horários livres em botões. Encaixe fora dos horários livres continua
 * possível ("Outro horário"); o conflito é tratado pela agenda (diálogo de encaixe).
 */
export default function NovoAgendamentoModal({
  barbers, date, services, slug, onConfirm, onClose, initialBarberId, initialStartTime, initialClient, initialServiceIds,
}: {
  barbers: Barber[];
  date: string;
  services: Service[];
  slug: string | null;
  onConfirm: (data: NovoAgendamentoData) => Promise<boolean>;
  onClose: () => void;
  initialBarberId?: string;
  initialStartTime?: string;
  /** Vindo da ficha do cliente: já abre com ele escolhido. */
  initialClient?: { name: string; phone: string };
  initialServiceIds?: string[];
}) {
  const { token } = useAuthStore();
  const [clientName, setClientName] = useState(initialClient?.name ?? "");
  const [clientPhone, setClientPhone] = useState(initialClient?.phone ?? "");
  const [picked, setPicked] = useState(!!initialClient); // cliente escolhido da lista (mostra o cartão)
  const [suggestions, setSuggestions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSub, setActiveSub] = useState<any | null>(null);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [serviceIds, setServiceIds] = useState<string[]>(initialServiceIds ?? []);
  const [barberId, setBarberId] = useState(initialBarberId ?? barbers[0]?.id ?? "");
  const [selectedDate, setSelectedDate] = useState(date);
  const [startTime, setStartTime] = useState(initialStartTime ?? "");
  const [manualTime, setManualTime] = useState(!!initialStartTime);
  // Horários livres guardados junto da combinação (profissional|serviços|dia) a que pertencem
  const [slotsState, setSlotsState] = useState<{ key: string; slots: string[] } | null>(null);
  const [notifyClient, setNotifyClient] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fecha com Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sugestões de cliente pelo nome
  useEffect(() => {
    if (picked || clientName.length < 2) return;
    const t = setTimeout(() => {
      fetch(`/api/barbershop/clients?q=${encodeURIComponent(clientName)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((d) => setSuggestions(d.clients || [])).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [clientName, token, picked]);

  // Assinatura pelo telefone
  useEffect(() => {
    const phone = clientPhone.replace(/\D/g, "");
    if (phone.length < 10) return;
    let alive = true;
    fetch(`/api/barbershop/subscriptions?phone=${phone}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        // Qualquer plano ativo vale (simples ou familiar); só o familiar tem lista de dependentes.
        const sub = (d.subscriptions || []).find((s: any) => s.status === "ACTIVE");
        if (sub) {
          const overdue = new Date(sub.nextBillingDate) < new Date();
          const beneficiaries = Array.isArray(sub.beneficiaries) ? sub.beneficiaries : [];
          setActiveSub(overdue ? { ...sub, beneficiaries, _overdue: true } : { ...sub, beneficiaries });
          setBeneficiaryName(overdue ? "" : beneficiaries[0]?.name || "");
          if (sub.client?.name) setClientName((n) => n || sub.client.name);
          // Já marca os serviços do plano (o que vier além disso é extra)
          if (!overdue) {
            const ids = planIdsOf(sub);
            if (ids.length > 0) setServiceIds((prev) => (prev.length === 0 ? ids : prev));
          }
        } else {
          setActiveSub(null);
          setBeneficiaryName("");
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [clientPhone, token]);

  // Plano familiar exige escolher quem usa; plano simples vale direto.
  const subUsable = !!activeSub && !activeSub._overdue && (activeSub.beneficiaries.length === 0 || !!beneficiaryName);
  const planServiceIds: string[] = subUsable ? planIdsOf(activeSub) : [];
  const allowedBarberIds: string[] | null =
    subUsable && activeSub.plan?.allowedBarbers?.length > 0 ? activeSub.plan.allowedBarbers.map((b: any) => b.id) : null;

  // Profissional não permitido pelo plano → passa para o primeiro permitido
  const effectiveBarberId = allowedBarberIds && !allowedBarberIds.includes(barberId)
    ? (barbers.find((b) => allowedBarberIds.includes(b.id))?.id ?? barberId)
    : barberId;

  // Horários livres do profissional no dia (modo profissional: aceita horário passado de hoje)
  const slotsKey = slug && effectiveBarberId && serviceIds.length > 0 ? `${effectiveBarberId}|${serviceIds.join(",")}|${selectedDate}` : null;
  useEffect(() => {
    if (!slotsKey || !slug) return;
    let alive = true;
    const [b, ids, d] = slotsKey.split("|");
    fetch(`/api/booking/${slug}/slots?barberId=${b}&serviceIds=${ids}&date=${d}&barber=true`)
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((res) => { if (alive) setSlotsState({ key: slotsKey, slots: res.slots ?? [] }); })
      .catch(() => { if (alive) setSlotsState({ key: slotsKey, slots: [] }); });
    return () => { alive = false; };
  }, [slotsKey, slug]);
  const slots = slotsState && slotsState.key === slotsKey ? slotsState.slots : null;

  const chosen = services.filter((s) => serviceIds.includes(s.id));
  const minutes = chosen.reduce((s, x) => s + x.duration, 0);
  const total = chosen.reduce((s, x) => s + x.price, 0);
  const covered = chosen.filter((s) => planServiceIds.includes(s.id)).reduce((s, x) => s + x.price, 0);
  const toPay = Math.max(0, total - covered);

  const days = useMemo(() => {
    const out: string[] = [];
    const base = new Date(date + "T12:00:00Z");
    for (let i = 0; i < 7; i++) { const d = new Date(base); d.setUTCDate(base.getUTCDate() + i); out.push(d.toISOString().slice(0, 10)); }
    return out;
  }, [date]);

  const barber = barbers.find((b) => b.id === effectiveBarberId);
  const today = localDateStr();
  const dayWord = selectedDate === today ? "Hoje" : new Date(selectedDate + "T12:00:00Z").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
  const canSave = clientName.trim() && clientPhone.replace(/\D/g, "").length >= 10 && serviceIds.length > 0 && effectiveBarberId && startTime;

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    if (!manualTime) setStartTime("");
  }

  function pickBeneficiary(b: any) {
    if (b.uses >= b.maxUses) return;
    setBeneficiaryName(b.name);
    const ids = planIdsOf(activeSub);
    setServiceIds((prev) => Array.from(new Set([...prev, ...ids])));
  }

  function resetClient() {
    setPicked(false); setClientName(""); setClientPhone(""); setActiveSub(null); setBeneficiaryName("");
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const ok = await onConfirm({
      clientName: clientName.trim(), clientPhone, barberId: effectiveBarberId, serviceIds,
      date: selectedDate, startTime, beneficiaryName, price: toPay, notifyClient,
    });
    setSaving(false);
    if (ok) onClose();
  }

  const label = "text-[13px] font-semibold text-ink";
  const input = "w-full h-11 rounded-[10px] border border-control bg-surface px-3.5 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="novo-t"
        className="relative bg-surface w-full sm:max-w-[600px] sm:mx-4 rounded-t-[18px] sm:rounded-[18px] shadow-[0_20px_50px_rgba(27,25,22,0.18)] flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-line-2">
          <h2 id="novo-t" className="font-display text-[22px] font-bold">Novo agendamento</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-10 h-10 rounded-[10px] text-ink-2 inline-flex items-center justify-center hover:bg-surface-2">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-[22px] px-6 py-5 overflow-y-auto">
          {/* Cliente */}
          <div className="flex flex-col gap-2">
            <span className={label}>Cliente</span>
            {picked ? (
              <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-control bg-[#F9F7F3]">
                <div className="w-10 h-10 rounded-full bg-surface-2 text-ink-2 text-sm font-bold flex items-center justify-center shrink-0">{getInitials(clientName)}</div>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-semibold truncate">{clientName}</span>
                    {activeSub && !activeSub._overdue && (
                      <span className="h-[22px] px-2 rounded-full bg-primary/10 text-primary text-[11px] font-semibold inline-flex items-center gap-1">
                        <Crown className="w-3 h-3" aria-hidden /> Assinante
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-ink-3 truncate">
                    {activeSub ? `${activeSub.plan?.name ?? "Plano"} · ${clientPhone}` : clientPhone || "sem telefone"}
                  </span>
                </div>
                <button type="button" onClick={resetClient} className="h-[34px] px-2.5 rounded-lg border border-control bg-surface text-xs font-semibold hover:bg-surface-3">Trocar</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="relative">
                  <input value={clientName} placeholder="Nome do cliente" aria-label="Nome do cliente" className={input}
                    onChange={(e) => { setClientName(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} />
                  {showSuggestions && clientName.length >= 2 && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-line rounded-xl shadow-lg z-10 overflow-hidden">
                      {suggestions.map((c) => (
                        <button key={c.id} type="button"
                          onPointerDown={() => { setClientName(c.name); setClientPhone(c.phone ?? ""); setPicked(true); setShowSuggestions(false); }}
                          className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-surface-3 flex items-center justify-between gap-2 border-b border-line-3 last:border-0">
                          <span className="font-semibold">{c.name}</span>
                          {c.phone && <span className="text-xs text-ink-3 shrink-0">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} inputMode="tel"
                  placeholder="WhatsApp com DDD" aria-label="WhatsApp do cliente" className={input} />
              </div>
            )}

            {activeSub?._overdue && (
              <p className="flex items-start gap-2 text-[13px] text-danger bg-danger-soft rounded-[10px] px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                Assinatura com pagamento pendente{activeSub.nextBillingDate ? ` desde ${new Date(activeSub.nextBillingDate).toLocaleDateString("pt-BR")}` : ""}. O plano não pode ser usado até regularizar.
              </p>
            )}
            {activeSub && !activeSub._overdue && activeSub.beneficiaries.length > 1 && (
              <div role="radiogroup" aria-label="Quem vai usar o plano" className="flex flex-wrap gap-2">
                {activeSub.beneficiaries.map((b: any, i: number) => {
                  const full = b.uses >= b.maxUses;
                  const on = beneficiaryName === b.name;
                  return (
                    <button key={i} type="button" role="radio" aria-checked={on} disabled={full} onClick={() => pickBeneficiary(b)}
                      className={cn("flex-1 min-w-[120px] px-3 py-2 rounded-[10px] text-left border",
                        on ? "border-2 border-ink bg-ground" : "border-control bg-surface", full && "opacity-50 cursor-not-allowed")}>
                      <span className="block text-sm font-semibold">{b.name}</span>
                      <span className="block text-xs text-ink-3">{full ? "Cota esgotada" : `${b.uses}/${b.maxUses} usos no ciclo`}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Serviços */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <span className={label}>Serviços</span>
              <span className="text-xs text-ink-3">escolha um ou mais</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {services.map((s) => {
                const on = serviceIds.includes(s.id);
                const inPlan = planServiceIds.includes(s.id);
                return (
                  <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleService(s.id)}
                    className={cn("min-h-16 px-3 py-2.5 rounded-[10px] text-left flex flex-col gap-0.5",
                      on ? "border-2 border-ink bg-ground" : "border border-control bg-surface hover:bg-surface-3")}>
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className={cn("text-xs", inPlan ? "text-primary font-semibold" : "text-ink-3")}>
                      {s.duration} min · {inPlan ? "incluso no plano" : formatCurrency(s.price)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Profissional */}
          {barbers.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={label}>Profissional</span>
              <div role="radiogroup" aria-label="Profissional" className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {barbers.map((b) => {
                  const on = b.id === effectiveBarberId;
                  const allowed = !allowedBarberIds || allowedBarberIds.includes(b.id);
                  return (
                    <button key={b.id} type="button" role="radio" aria-checked={on} disabled={!allowed}
                      title={allowed ? undefined : "Não atende este plano"}
                      onClick={() => { setBarberId(b.id); if (!manualTime) setStartTime(""); }}
                      className={cn("h-[76px] rounded-[10px] flex flex-col items-center justify-center gap-1.5",
                        on ? "border-2 border-ink bg-ground" : "border border-control bg-surface hover:bg-surface-3",
                        !allowed && "opacity-40 cursor-not-allowed")}>
                      <span className={cn("w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center", on ? "bg-ink text-white" : "bg-surface-2 text-ink-2")}>
                        {getInitials(b.user.name)}
                      </span>
                      <span className="text-xs font-semibold truncate max-w-full px-1">{barberShortName(b)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dia e horário */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <span className={label}>Dia e horário</span>
              <label className="relative text-[13px] font-semibold text-ink-2 underline underline-offset-2 cursor-pointer">
                Outra data
                <input type="date" value={selectedDate} aria-label="Outra data"
                  onChange={(e) => { if (e.target.value) { setSelectedDate(e.target.value); if (!manualTime) setStartTime(""); } }}
                  className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {(days.includes(selectedDate) ? days : [selectedDate, ...days.slice(0, 6)]).map((d) => {
                const on = d === selectedDate;
                const dt = new Date(d + "T12:00:00Z");
                return (
                  <button key={d} type="button" aria-pressed={on}
                    onClick={() => { setSelectedDate(d); if (!manualTime) setStartTime(""); }}
                    className={cn("h-[52px] rounded-[10px] border flex flex-col items-center justify-center",
                      on ? "bg-ink border-ink text-white" : "bg-surface border-control text-ink hover:bg-surface-3")}>
                    <span className="text-[11px] font-semibold uppercase opacity-80">{DOW[dt.getUTCDay()]}</span>
                    <span className="text-[15px] font-bold">{dt.getUTCDate()}</span>
                  </button>
                );
              })}
            </div>

            {serviceIds.length === 0 ? (
              <p className="text-[13px] text-ink-3">Escolha o serviço para ver os horários livres.</p>
            ) : manualTime ? null : slots === null ? (
              <p className="text-[13px] text-ink-3">Buscando horários…</p>
            ) : slots.length === 0 ? (
              <p className="text-[13px] text-ink-3">Sem horário livre para {barber ? barberShortName(barber) : "o profissional"} neste dia.</p>
            ) : (
              <div role="radiogroup" aria-label="Horário" className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 mt-1">
                {slots.map((t) => {
                  const on = t === startTime;
                  return (
                    <button key={t} type="button" role="radio" aria-checked={on} onClick={() => setStartTime(t)}
                      className={cn("h-[38px] rounded-lg text-[13px] font-semibold",
                        on ? "bg-primary border-2 border-primary text-white" : "bg-surface border border-[#B9B0A1] text-ink hover:bg-surface-3")}>
                      {t}
                    </button>
                  );
                })}
              </div>
            )}

            {serviceIds.length > 0 && (
              manualTime ? (
                <div className="flex items-center gap-2 mt-1">
                  <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} aria-label="Horário do encaixe" className={cn(input, "w-36")} />
                  <span className="text-[13px] text-ink-3">Encaixe: o horário pode já estar ocupado.</span>
                  <button type="button" onClick={() => { setManualTime(false); setStartTime(""); }} className="ml-auto text-[13px] font-semibold text-ink-2 underline underline-offset-2">
                    Ver livres
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setManualTime(true)} className="self-start text-[13px] font-semibold text-ink-2 underline underline-offset-2">
                  Outro horário (encaixe)
                </button>
              )
            )}
          </div>
        </div>

        {/* Resumo e ações */}
        <div className="flex flex-col gap-3.5 px-6 pt-[18px] pb-[22px] border-t border-line-2 bg-[#FBFAF7] rounded-b-[18px]">
          <div className="flex justify-between items-end gap-4">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[15px] font-semibold truncate">
                {chosen.length > 0 ? `${chosen.map((s) => s.name).join(" + ")}${barber ? ` com ${barberShortName(barber)}` : ""}` : "Escolha o serviço"}
              </span>
              <span className="text-[13px] text-ink-3">
                {startTime ? `${dayWord}, ${startTime} – ${toHHMM(toMin(startTime) + minutes)}` : dayWord}
                {minutes > 0 ? ` · ${minutes} min` : ""}
              </span>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-xs text-ink-3">A pagar no dia</span>
              <span className="font-display text-2xl font-bold">{formatCurrency(toPay)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} className="w-[18px] h-[18px] accent-[#1B1916]" />
              Enviar confirmação pelo WhatsApp
            </label>
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={onClose} className="h-[46px] px-[18px] rounded-[10px] border border-control bg-surface text-sm font-semibold hover:bg-surface-3">Cancelar</button>
              <button type="button" onClick={save} disabled={!canSave || saving}
                className="h-[46px] px-[22px] rounded-[10px] bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-40">
                {saving ? "Agendando…" : "Agendar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
