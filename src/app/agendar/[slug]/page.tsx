"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Scissors, Check, ChevronLeft, ChevronRight, Clock, AlertCircle, Star, MapPin, RotateCcw,
  CalendarPlus, Navigation, MessageCircle, User,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import WaitlistBox from "@/components/booking/WaitlistBox";

interface Service { id: string; name: string; price: number; duration: number; description: string | null }
interface Barber { id: string; nickname: string | null; bio: string | null; photoUrl: string | null; user: { name: string } }
interface Shop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  phone: string | null;
  address: string | null; streetNumber: string | null; neighborhood: string | null; city: string | null; state: string | null;
  cancelByClientEnabled: boolean;
  minCancelHours: number;
  reminderEnabled: boolean;
  reminderMinutes: number;
  services: Service[];
  barbers: Barber[];
  openingHours: { dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }[];
  rating: { average: number; count: number } | null;
  popularServiceId: string | null;
}
interface DaySlots { date: string; slots: string[] }
interface LastVisit { date: string; barberId: string; serviceIds: string[] }

type Step = "service" | "barber" | "datetime" | "dados" | "confirmado";
const STEPS: Step[] = ["service", "barber", "datetime", "dados"];
const STEP_NAMES = ["Serviço", "Profissional", "Horário", "Seus dados"];

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const todaySP = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());
const nowMinSP = () => {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).split(":").map(Number);
  return h * 60 + m;
};
const addDays = (day: string, n: number) => { const d = new Date(day + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dow = (day: string) => new Date(day + "T12:00:00Z").getUTCDay();
const dayNum = (day: string) => Number(day.slice(8, 10));

/** "Hoje", "Amanhã" ou "Sáb, 18 de out" */
function dayLabel(day: string) {
  if (day === todaySP()) return "Hoje";
  if (day === addDays(todaySP(), 1)) return "Amanhã";
  const d = new Date(day + "T12:00:00Z");
  return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}
/** "sábado, 18 de outubro" */
function fullDate(day: string) {
  const d = new Date(day + "T12:00:00Z");
  return `${["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : null;
}
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
const barberName = (b: Barber) => b.nickname || b.user.name.split(" ")[0];
const brl = (v: number) => formatCurrency(v).replace(",00", "");

export default function AgendarPage() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [step, setStep] = useState<Step>("service");
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [selected, setSelected] = useState({ barber: "", date: "", slot: "" });
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [clientFound, setClientFound] = useState<boolean | null>(null);
  const [lastVisit, setLastVisit] = useState<LastVisit | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [activeSub, setActiveSub] = useState<{ subscriptionId: string; planName: string; allowedBarberIds: string[] } | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlots[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{ startTime: string } | null>(null);
  // "Já é cliente? Repita o último corte"
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatPhone, setRepeatPhone] = useState("");
  const [repeatMsg, setRepeatMsg] = useState<string | null>(null);
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Remarcação vinda de "meus horários": o horário antigo só é cancelado depois que o novo é marcado.
  const [rescheduleFrom, setRescheduleFrom] = useState<{ id: string; when: string } | null>(null);

  useEffect(() => {
    fetch(`/api/booking/${slug}`)
      .then(async (r) => {
        if (r.status === 403) { setUnavailable(true); return null; }
        return r.json();
      })
      .then((d) => { if (d?.shop) setShop(d.shop); })
      .catch(() => {});
  }, [slug]);

  // Chegou por "Remarcar": mesmo serviço e profissional, direto na escolha de horário.
  useEffect(() => {
    if (!shop || !new URLSearchParams(window.location.search).has("remarcar")) return;
    let r: { id: string; slug: string; serviceIds: string[]; barberId: string; phone: string; when: string } | null = null;
    try { r = JSON.parse(sessionStorage.getItem("remarcar") || "null"); } catch { /* ignora */ }
    window.history.replaceState(null, "", window.location.pathname);
    if (!r || r.slug !== slug) return;
    const ids = r.serviceIds.filter((id) => shop.services.some((s) => s.id === id));
    if (ids.length === 0 || !shop.barbers.some((b) => b.id === r!.barberId)) return;
    setRescheduleFrom({ id: r.id, when: r.when });
    setServiceIds(ids);
    setSelected({ barber: r.barberId, date: "", slot: "" });
    setForm((f) => ({ ...f, phone: r!.phone }));
    lookupClient(r.phone);
    setStep("datetime");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop, slug]);

  // Volta ao topo a cada etapa (no celular a etapa anterior costuma estar rolada)
  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  /** Procura o cliente pelo telefone: nome, última visita e assinatura. */
  async function lookupClient(phone: string) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return null;
    setLookingUp(true);
    try {
      const r = await fetch(`/api/booking/${slug}/cliente?phone=${encodeURIComponent(phone)}`);
      const d = await r.json();
      if (!d.found) { setClientFound(false); setLastVisit(null); return null; }
      setForm((f) => ({ ...f, phone, firstName: d.firstName, lastName: d.lastName }));
      setClientFound(true);
      setLastVisit(d.lastVisit ?? null);
      const subRes = await fetch(`/api/booking/${slug}/subscriber?phone=${encodeURIComponent(digits)}`);
      const sub = await subRes.json();
      setActiveSub(sub.subscriptionId ? sub : null);
      return d as { firstName: string; lastVisit: LastVisit | null };
    } finally {
      setLookingUp(false);
    }
  }

  function handlePhoneChange(phone: string) {
    setForm((f) => ({ ...f, phone }));
    setClientFound(null);
    setActiveSub(null);
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current);
    if (phone.replace(/\D/g, "").length < 10) return;
    phoneDebounce.current = setTimeout(() => { lookupClient(phone); }, 600);
  }

  async function repeatLastCut(e: React.FormEvent) {
    e.preventDefault();
    if (!shop) return;
    setRepeatMsg(null);
    const found = await lookupClient(repeatPhone);
    if (!found) { setRepeatMsg("Não encontramos agendamentos com esse número. Escolha o serviço abaixo."); return; }
    const lv = found.lastVisit;
    const ids = (lv?.serviceIds ?? []).filter((id) => shop.services.some((s) => s.id === id));
    const barberOk = lv && shop.barbers.some((b) => b.id === lv.barberId);
    if (ids.length === 0 || !barberOk) {
      setRepeatMsg(`Olá, ${found.firstName}! Seu último serviço não está mais disponível online. Escolha abaixo.`);
      return;
    }
    setServiceIds(ids);
    setSelected({ barber: lv!.barberId, date: "", slot: "" });
    setRepeatOpen(false);
    setStep("datetime");
  }

  // Horários dos próximos 14 dias ao entrar na etapa de horário
  const slotsKey = step === "datetime" && selected.barber && serviceIds.length > 0 ? `${selected.barber}|${serviceIds.join(",")}` : null;
  useEffect(() => {
    if (!slotsKey) return;
    let alive = true;
    const [barberId, ids] = slotsKey.split("|");
    const today = todaySP();
    const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i));
    Promise.all(dates.map((date) =>
      fetch(`/api/booking/${slug}/slots?barberId=${barberId}&serviceIds=${ids}&date=${date}`)
        .then((r) => r.json()).then((d) => ({ date, slots: (d.slots || []) as string[] }))
        .catch(() => ({ date, slots: [] as string[] }))
    )).then((results) => {
      if (!alive) return;
      setDaySlots(results);
      setSelected((s) => {
        if (s.date && results.some((r) => r.date === s.date && r.slots.length > 0)) return s;
        const first = results.find((r) => r.slots.length > 0);
        return { ...s, date: first?.date ?? "", slot: "" };
      });
    });
    return () => { alive = false; };
  }, [slotsKey, slug]);

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setBookError(null);
    const clientName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const isAllowed = !activeSub || activeSub.allowedBarberIds.length === 0 || activeSub.allowedBarberIds.includes(selected.barber);
    const r = await fetch(`/api/booking/${slug}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName, clientPhone: form.phone,
        barberId: selected.barber, serviceIds,
        date: selected.date, startTime: selected.slot,
        subscriptionId: activeSub && isAllowed ? activeSub.subscriptionId : undefined,
        // Remarcação: o servidor cria o novo e cancela o antigo de uma vez só.
        rescheduleFromId: rescheduleFrom?.id,
      }),
    });
    const d = await r.json();
    if (r.ok) {
      if (rescheduleFrom) {
        try { sessionStorage.removeItem("remarcar"); } catch { /* ignora */ }
      }
      setBooked(d.appointment); setStep("confirmado");
    }
    else setBookError(d.error || "Não foi possível concluir o agendamento.");
    setLoading(false);
  }

  if (unavailable) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-ink-3" />
          </div>
          <h1 className="font-display text-xl font-bold text-ink mb-2">Agendamento indisponível</h1>
          <p className="text-ink-3 text-sm leading-relaxed">
            Esta barbearia não está aceitando agendamentos online no momento. Entre em contato diretamente com o estabelecimento.
          </p>
        </div>
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Carregando" />
      </div>
    );
  }

  const selectedServices = shop.services.filter((s) => serviceIds.includes(s.id));
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const servicesText = selectedServices.map((s) => s.name).join(" + ");
  const selectedBarber = shop.barbers.find((b) => b.id === selected.barber);
  const subCovers = !!activeSub && (activeSub.allowedBarberIds.length === 0 || activeSub.allowedBarberIds.includes(selected.barber));
  const priceText = subCovers ? "no plano" : brl(totalPrice);
  const isFormValid = form.firstName.trim().length > 0 && form.phone.replace(/\D/g, "").length >= 10;
  const stepIndex = STEPS.indexOf(step);

  // Aberto agora?
  const todayHours = shop.openingHours.find((h) => h.dayOfWeek === dow(todaySP()));
  const nowMin = nowMinSP();
  const openNow = !!todayHours?.isOpen && nowMin >= toMin(todayHours.openTime) && nowMin < toMin(todayHours.closeTime);
  const address = [shop.address && `${shop.address}${shop.streetNumber ? `, ${shop.streetNumber}` : ""}`, shop.neighborhood, shop.city].filter(Boolean).join(" · ");
  const mapsQuery = encodeURIComponent([shop.address, shop.streetNumber, shop.neighborhood, shop.city, shop.state].filter(Boolean).join(", "));

  const primaryRgb = shop.primaryColor ? hexToRgb(shop.primaryColor) : null;
  const secondaryRgb = shop.secondaryColor ? hexToRgb(shop.secondaryColor) : null;

  const backButton = (to: Step) => (
    <div className="flex items-center gap-2.5 h-12">
      <button type="button" onClick={() => setStep(to)} aria-label="Voltar"
        className="w-11 h-11 rounded-[10px] border border-control bg-surface inline-flex items-center justify-center hover:bg-surface-3">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <span className="flex-1 text-[15px] font-semibold truncate">{shop.name}</span>
    </div>
  );

  const progress = (right: string) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-3 text-[13px] text-ink-2">
        <span className="shrink-0"><strong className="text-ink">Passo {stepIndex + 1} de 4</strong> · {STEP_NAMES[stepIndex]}</span>
        <span className="truncate text-right">{right}</span>
      </div>
      <div className="h-1 rounded-sm bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={stepIndex + 1}>
        <div className="h-full rounded-sm bg-primary transition-all" style={{ width: `${(stepIndex + 1) * 25}%` }} />
      </div>
    </div>
  );

  // Barra fixa de rodapé (total + Continuar)
  const footer = (main: React.ReactNode, sub: React.ReactNode, action: React.ReactNode) => (
    <div className="fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line">
      <div className="max-w-md mx-auto px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="text-base font-bold truncate">{main}</span>
          <span className="text-xs text-ink-3 truncate">{sub}</span>
        </div>
        {action}
      </div>
    </div>
  );
  const continueBtn = (onClick: () => void, disabled: boolean) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className="h-[52px] px-[26px] rounded-xl bg-primary text-white text-base font-semibold shrink-0 disabled:opacity-40">
      Continuar
    </button>
  );

  return (
    <>
      {(primaryRgb || secondaryRgb) && (
        <style dangerouslySetInnerHTML={{ __html: `:root{${primaryRgb ? `--primary:${primaryRgb};` : ""}${secondaryRgb ? `--secondary:${secondaryRgb};` : ""}}` }} />
      )}
      <div className="min-h-screen bg-ground text-ink">

        {/* ── 1. Serviço ── */}
        {step === "service" && (
          <>
            <header className="bg-ink text-white">
              <div className="max-w-md mx-auto px-4 pt-[22px] pb-5 flex flex-col gap-3.5">
                <div className="flex items-center gap-3.5">
                  <div className="w-[60px] h-[60px] rounded-2xl bg-primary flex items-center justify-center shrink-0 overflow-hidden">
                    {shop.logoUrl
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={shop.logoUrl} alt="" className="w-full h-full object-cover" />
                      : <Scissors className="w-7 h-7 text-white" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <h1 className="font-display text-2xl font-bold truncate">{shop.name}</h1>
                    {todayHours && (
                      <span className="flex items-center gap-1.5 text-[13px] text-night-text">
                        <span className={cn("w-[7px] h-[7px] rounded-full", openNow ? "bg-[#4CC38A]" : "bg-ink-4")} aria-hidden />
                        {openNow ? `Aberto agora · fecha às ${todayHours.closeTime.replace(":00", "h")}` : todayHours.isOpen && nowMin < toMin(todayHours.openTime) ? `Abre hoje às ${todayHours.openTime.replace(":00", "h")}` : "Fechado agora"}
                      </span>
                    )}
                  </div>
                </div>
                {shop.description && <p className="text-[13px] text-night-text">{shop.description}</p>}
                {(shop.rating || address) && (
                  <div className="flex gap-2 flex-wrap">
                    {shop.rating && (
                      <span className="h-7 px-2.5 rounded-full bg-night-3 text-xs text-[#E9E4DA] inline-flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 fill-current text-[#E9B949]" aria-hidden />
                        {shop.rating.average.toFixed(1).replace(".", ",")} · {shop.rating.count} {shop.rating.count === 1 ? "avaliação" : "avaliações"}
                      </span>
                    )}
                    {address && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer"
                        className="h-7 px-2.5 rounded-full bg-night-3 text-xs text-[#E9E4DA] inline-flex items-center gap-1.5 max-w-full">
                        <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden /><span className="truncate">{address}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </header>

            <main className="max-w-md mx-auto px-4 pt-4 pb-32 flex flex-col gap-4">
              {progress("Profissional → Horário → Dados")}

              {/* Já é cliente? */}
              <div className="rounded-[14px] bg-surface border border-line">
                <button type="button" onClick={() => setRepeatOpen((v) => !v)} aria-expanded={repeatOpen}
                  className="w-full flex items-center gap-3 p-3.5 text-left">
                  <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><RotateCcw className="w-[18px] h-[18px]" aria-hidden /></span>
                  <span className="flex-1 flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">Já é cliente? Repita o último corte</span>
                    <span className="text-xs text-ink-3">Entre com seu WhatsApp e pule direto para o horário</span>
                  </span>
                  <ChevronRight className={cn("w-5 h-5 text-ink-3 transition-transform", repeatOpen && "rotate-90")} aria-hidden />
                </button>
                {repeatOpen && (
                  <form onSubmit={repeatLastCut} className="px-3.5 pb-3.5 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input type="tel" inputMode="tel" autoComplete="tel" value={repeatPhone} onChange={(e) => setRepeatPhone(e.target.value)}
                        placeholder="(41) 99999-9999" aria-label="Seu WhatsApp"
                        className="flex-1 min-w-0 h-12 px-3.5 rounded-xl border border-control bg-surface text-base outline-none focus:border-ink" />
                      <button type="submit" disabled={lookingUp || repeatPhone.replace(/\D/g, "").length < 10}
                        className="h-12 px-4 rounded-xl bg-ink text-white text-sm font-semibold disabled:opacity-40">
                        {lookingUp ? "…" : "Buscar"}
                      </button>
                    </div>
                    {repeatMsg && <p className="text-[13px] text-ink-2" role="status">{repeatMsg}</p>}
                  </form>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <h2 className="font-display text-[22px] font-bold">O que você vai fazer?</h2>
                <span className="text-sm text-ink-3">Pode escolher mais de um</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {shop.services.map((s) => {
                  const on = serviceIds.includes(s.id);
                  return (
                    <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleService(s.id)}
                      className={cn("flex items-center gap-3.5 p-3.5 rounded-[14px] text-left transition-colors",
                        on ? "border-2 border-ink bg-surface" : "border border-line bg-surface hover:border-control")}>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="flex items-center gap-2 text-base font-semibold flex-wrap">
                          {s.name}
                          {s.id === shop.popularServiceId && (
                            <span className="h-5 px-[7px] rounded-full bg-surface-3 text-ink-2 text-[11px] font-semibold inline-flex items-center">mais pedido</span>
                          )}
                        </span>
                        {s.description && <span className="text-[13px] text-ink-3">{s.description}</span>}
                        <span className="text-[13px] text-ink-2">{s.duration} min</span>
                      </span>
                      <span className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-base font-bold">{brl(s.price)}</span>
                        <span className={cn("w-6 h-6 rounded-[7px] flex items-center justify-center",
                          on ? "bg-ink text-white" : "border-[1.5px] border-[#B9B0A1]")} aria-hidden>
                          {on && <Check className="w-4 h-4" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
                {shop.services.length === 0 && <p className="text-sm text-ink-3">Nenhum serviço disponível para agendar online.</p>}
              </div>

              <ManageLink slug={slug} />
            </main>

            {footer(
              serviceIds.length > 0 ? brl(totalPrice) : "Escolha um serviço",
              serviceIds.length > 0 ? `${servicesText} · ${totalDuration} min` : "toque para selecionar",
              continueBtn(() => setStep("barber"), serviceIds.length === 0),
            )}
          </>
        )}

        {/* ── 2. Profissional ── */}
        {step === "barber" && (
          <>
            <main className="max-w-md mx-auto px-4 pt-3 pb-32 flex flex-col gap-4">
              {backButton("service")}
              {progress(`${servicesText} · ${totalDuration} min`)}
              <h2 className="font-display text-[22px] font-bold">Com quem você quer cortar?</h2>
              <div role="radiogroup" aria-label="Profissional" className="flex flex-col gap-2.5">
                {shop.barbers.map((b) => {
                  const on = selected.barber === b.id;
                  const inPlan = activeSub && (activeSub.allowedBarberIds.length === 0 || activeSub.allowedBarberIds.includes(b.id));
                  return (
                    <button key={b.id} type="button" role="radio" aria-checked={on}
                      onClick={() => setSelected({ barber: b.id, date: "", slot: "" })}
                      className={cn("flex items-center gap-3.5 p-3.5 rounded-[14px] text-left",
                        on ? "border-2 border-ink bg-surface" : "border border-line bg-surface hover:border-control")}>
                      <span className={cn("w-14 h-14 rounded-full overflow-hidden text-[17px] font-bold flex items-center justify-center shrink-0",
                        on ? "bg-ink text-white" : "bg-surface-2 text-ink-2")}>
                        {b.photoUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={b.photoUrl} alt="" className="w-full h-full object-cover" />
                          : initials(b.user.name)}
                      </span>
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-base font-semibold">{b.user.name}</span>
                        {b.bio && <span className="text-[13px] text-ink-3">{b.bio}</span>}
                        {activeSub && (
                          <span className={cn("text-[13px] font-semibold", inPlan ? "text-positive" : "text-warning")}>
                            {inPlan ? "Incluso no seu plano" : "Fora do seu plano · paga no local"}
                          </span>
                        )}
                      </span>
                      <span className={cn("w-6 h-6 rounded-full shrink-0", on ? "border-[7px] border-ink" : "border-[1.5px] border-[#B9B0A1]")} aria-hidden />
                    </button>
                  );
                })}
              </div>
            </main>
            {footer(
              subCovers ? "No plano" : brl(totalPrice),
              selectedBarber ? `com ${barberName(selectedBarber)}` : "escolha o profissional",
              continueBtn(() => { setDaySlots(null); setStep("datetime"); }, !selected.barber),
            )}
          </>
        )}

        {/* ── 3. Dia e horário ── */}
        {step === "datetime" && (() => {
          const current = daySlots?.find((d) => d.date === selected.date);
          const groups = [
            { name: "Manhã", slots: (current?.slots ?? []).filter((t) => toMin(t) < 12 * 60) },
            { name: "Tarde", slots: (current?.slots ?? []).filter((t) => toMin(t) >= 12 * 60 && toMin(t) < 18 * 60) },
            { name: "Noite", slots: (current?.slots ?? []).filter((t) => toMin(t) >= 18 * 60) },
          ].filter((g) => g.slots.length > 0);
          const openDay = (d: string) => shop.openingHours.find((h) => h.dayOfWeek === dow(d))?.isOpen ?? true;
          return (
            <>
              <main className="max-w-md mx-auto px-4 pt-3 pb-32 flex flex-col gap-4">
                {backButton("barber")}
                {progress(`${servicesText}${selectedBarber ? ` · ${barberName(selectedBarber)}` : ""}`)}
{rescheduleFrom && (
                  <p className="text-[13px] text-ink-2 bg-surface border border-line rounded-xl px-3.5 py-2.5">
                    Remarcando o horário de <strong>{rescheduleFrom.when}</strong>. Ele só é cancelado quando você confirmar o novo.
                  </p>
                )}
                <h2 className="font-display text-[22px] font-bold">Quando fica bom?</h2>

                {daySlots === null ? (
                  <div className="flex flex-col items-center py-12 gap-3 text-ink-3">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-hidden />
                    <p className="text-sm">Buscando horários…</p>
                  </div>
                ) : (
                  <>
                    <div role="radiogroup" aria-label="Dia" className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 snap-x">
                      {daySlots.map((d) => {
                        const on = d.date === selected.date;
                        const open = openDay(d.date);
                        const has = d.slots.length > 0;
                        return (
                          <button key={d.date} type="button" role="radio" aria-checked={on} disabled={!has}
                            onClick={() => setSelected((s) => ({ ...s, date: d.date, slot: "" }))}
                            className={cn("w-[64px] h-[70px] shrink-0 snap-start rounded-xl border flex flex-col items-center justify-center gap-0.5",
                              on ? "bg-ink border-ink text-white" : has ? "bg-surface border-line text-ink" : "bg-surface-3 border-line text-ink-4")}>
                            <span className="text-xs font-semibold">{d.date === todaySP() ? "Hoje" : DOW[dow(d.date)]}</span>
                            <span className="text-lg font-bold">{dayNum(d.date)}</span>
                            <span className="text-[11px] opacity-85">{has ? `${d.slots.length} hor.` : open ? "lotado" : "fechado"}</span>
                          </button>
                        );
                      })}
                    </div>

                    {groups.length === 0 ? (
                      <p className="text-sm text-ink-3 bg-surface border border-line rounded-[14px] p-5 text-center">
                        Nenhum horário livre nos próximos 14 dias com {selectedBarber ? barberName(selectedBarber) : "esse profissional"}. Tente outro profissional ou entre na lista de espera.
                      </p>
                    ) : groups.map((g) => (
                      <div key={g.name} className="flex flex-col gap-2">
                        <span className="text-sm font-semibold text-ink-2">{g.name}</span>
                        <div role="radiogroup" aria-label={g.name} className="grid grid-cols-4 gap-2">
                          {g.slots.map((t) => {
                            const on = t === selected.slot;
                            return (
                              <button key={t} type="button" role="radio" aria-checked={on}
                                onClick={() => setSelected((s) => ({ ...s, slot: t }))}
                                className={cn("h-12 rounded-[10px] text-[15px] font-semibold",
                                  on ? "bg-primary border-2 border-primary text-white" : "bg-surface border border-[#B9B0A1] text-ink hover:border-ink")}>
                                {t}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <WaitlistBox
                      key={selected.barber}
                      slug={slug}
                      barberId={selected.barber}
                      barberName={selectedBarber ? barberName(selectedBarber) : "o profissional"}
                      serviceIds={serviceIds}
                      days={daySlots.filter((d) => openDay(d.date)).map((d) => ({ date: d.date, full: d.slots.length === 0 }))}
                      defaultDate={selected.date}
                      dayLabel={(d) => dayLabel(d)}
                    />
                  </>
                )}
              </main>
              {footer(
                selected.slot ? `${dayLabel(selected.date)}, ${selected.slot}` : "Escolha o horário",
                `${selectedBarber ? `com ${barberName(selectedBarber)} · ` : ""}${priceText}`,
                continueBtn(() => setStep("dados"), !selected.slot),
              )}
            </>
          );
        })()}

        {/* ── 4. Seus dados ── */}
        {step === "dados" && (
          <form onSubmit={handleBook}>
            <main className="max-w-md mx-auto px-4 pt-3 pb-32 flex flex-col gap-4">
              {backButton("datetime")}
              {progress("quase lá")}

              <section aria-label="Resumo do agendamento" className="bg-surface border border-line rounded-[14px] px-4 py-1">
                <div className="flex items-center gap-3 min-h-12">
                  <Clock className="w-[18px] h-[18px] text-ink-3 shrink-0" aria-hidden />
                  <span className="flex-1 text-[15px] font-semibold">{dayLabel(selected.date)}, {selected.slot} – {toHHMM(toMin(selected.slot) + totalDuration)}</span>
                  <button type="button" onClick={() => setStep("datetime")} className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">Trocar</button>
                </div>
                <div className="flex items-center gap-3 min-h-12 border-t border-line-3">
                  <Scissors className="w-[18px] h-[18px] text-ink-3 shrink-0" aria-hidden />
                  <span className="flex-1 text-[15px]">{servicesText} com {selectedBarber ? barberName(selectedBarber) : ""}</span>
                  <span className="text-[15px] font-bold">{priceText}</span>
                </div>
              </section>

              <h2 className="font-display text-[22px] font-bold mt-1">Seus dados</h2>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="wpp" className="text-sm font-semibold">WhatsApp</label>
                <div className="relative">
                  <input id="wpp" required type="tel" inputMode="tel" autoComplete="tel" value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)} placeholder="(41) 99999-9999"
                    className="w-full h-[52px] px-3.5 rounded-xl border-2 border-ink bg-surface text-[17px] outline-none" />
                  {lookingUp && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden />}
                </div>
                <span className="text-xs text-ink-3">É por aqui que enviamos a confirmação{shop.reminderEnabled ? " e o lembrete" : ""}.</span>
              </div>

              {clientFound && (
                <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-positive-soft border border-[#BFDFCB]" role="status">
                  <User className="w-5 h-5 text-positive shrink-0" aria-hidden />
                  <span className="flex flex-col gap-0.5 text-positive">
                    <span className="text-sm font-semibold">Que bom te ver de novo, {form.firstName}!</span>
                    <span className="text-[13px]">
                      Preenchemos seu nome.{lastVisit ? ` Última visita: ${dayNum(lastVisit.date)} de ${MONTHS[Number(lastVisit.date.slice(5, 7)) - 1]}.` : ""}
                    </span>
                  </span>
                </div>
              )}

              {activeSub && (
                subCovers ? (
                  <p className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-positive-soft text-[13px] text-positive">
                    <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    <span><strong>{activeSub.planName}</strong>: este horário é coberto pelo seu plano.</span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-warning-soft text-[13px] text-warning">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                    <span>
                      {selectedBarber?.user.name} não atende pelo seu plano ({activeSub.planName}). Você pode{" "}
                      <button type="button" onClick={() => setStep("barber")} className="font-semibold underline">trocar de profissional</button> ou pagar no local.
                    </span>
                  </p>
                )
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nome" className="text-sm font-semibold">Nome</label>
                  <input id="nome" required autoComplete="given-name" value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="h-[50px] px-3.5 rounded-xl border border-[#D8D0C2] bg-surface text-base outline-none focus:border-ink" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="sobrenome" className="text-sm font-semibold">Sobrenome</label>
                  <input id="sobrenome" autoComplete="family-name" value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="h-[50px] px-3.5 rounded-xl border border-[#D8D0C2] bg-surface text-base outline-none focus:border-ink" />
                </div>
              </div>

              <p className="text-[13px] text-ink-3 leading-relaxed">
                Pagamento na barbearia.
                {shop.cancelByClientEnabled
                  ? ` Precisa desmarcar? Cancele grátis pelo link de "meus horários"${shop.minCancelHours > 0 ? `, até ${shop.minCancelHours}h antes` : ""}.`
                  : " Para desmarcar, fale com a barbearia."}
              </p>

              {bookError && (
                <div className="flex items-start gap-2 px-3.5 py-3 rounded-xl bg-danger-soft text-sm text-danger" role="alert">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                  <span>
                    {bookError}{" "}
                    <a href={`/agendar/${slug}/cancelar`} className="underline font-semibold">Ver meus horários</a>
                  </span>
                </div>
              )}
            </main>
            <div className="fixed inset-x-0 bottom-0 z-30 bg-surface border-t border-line">
              <div className="max-w-md mx-auto px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
                <button type="submit" disabled={!isFormValid || loading}
                  className="w-full h-[54px] rounded-xl bg-primary text-white text-[17px] font-semibold disabled:opacity-40">
                  {loading ? "Confirmando…" : "Confirmar agendamento"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── 5. Confirmado ── */}
        {step === "confirmado" && (() => {
          const start = booked?.startTime ?? selected.slot;
          const startDate = new Date(`${selected.date}T${start}:00-03:00`);
          const endDate = new Date(startDate.getTime() + totalDuration * 60_000);
          const gcal = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
          const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${servicesText} · ${shop.name}`)}&dates=${gcal(startDate)}/${gcal(endDate)}&details=${encodeURIComponent(`Com ${selectedBarber?.user.name ?? ""}`)}${mapsQuery ? `&location=${mapsQuery}` : ""}`;
          const reminderAt = shop.reminderEnabled ? toHHMM(Math.max(0, toMin(start) - shop.reminderMinutes)) : null;
          return (
            <main className="max-w-md mx-auto px-4 pt-10 pb-8 flex flex-col gap-5">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="w-[76px] h-[76px] rounded-full bg-primary text-white flex items-center justify-center"><Check className="w-9 h-9" aria-hidden /></div>
                <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">{rescheduleFrom ? "Horário remarcado!" : `Tudo certo, ${form.firstName.trim() || "até lá"}!`}</h1>
                <span className="text-base text-ink-2">{rescheduleFrom ? `O de ${rescheduleFrom.when} foi cancelado.` : "Seu horário está reservado."}</span>
              </div>

              <section aria-label="Detalhes do agendamento" className="bg-surface border border-line rounded-2xl overflow-hidden">
                <div className="px-[18px] pt-[18px] pb-3.5 flex flex-col gap-1 border-b border-dashed border-[#D8D0C2]">
                  <span className="text-[13px] font-semibold tracking-[0.06em] uppercase text-ink-3">
                    {selected.date === todaySP() ? `Hoje · ${fullDate(selected.date)}` : selected.date === addDays(todaySP(), 1) ? `Amanhã · ${fullDate(selected.date)}` : fullDate(selected.date)}
                  </span>
                  <span className="font-display text-4xl font-bold">{start}</span>
                </div>
                <dl className="px-[18px] py-1.5 text-[15px]">
                  <Row label="Serviço" value={`${servicesText} · ${totalDuration} min`} />
                  <Row label="Profissional" value={selectedBarber?.user.name ?? ""} />
                  <Row label="Valor" value={subCovers ? `${activeSub!.planName}` : `${brl(totalPrice)} · pague na barbearia`} />
                  {address && <Row label="Onde" value={address} />}
                </dl>
              </section>

              <p className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-positive-soft text-sm text-positive">
                <MessageCircle className="w-5 h-5 shrink-0" aria-hidden />
                Mandamos a confirmação no seu WhatsApp.{reminderAt && selected.date === todaySP() ? ` Às ${reminderAt} chega o lembrete.` : reminderAt ? " Antes do horário chega o lembrete." : ""}
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <a href={calUrl} target="_blank" rel="noreferrer"
                  className="h-[52px] rounded-xl border border-[#D8D0C2] bg-surface text-[15px] font-semibold inline-flex items-center justify-center gap-2">
                  <CalendarPlus className="w-[18px] h-[18px]" aria-hidden />Pôr na agenda
                </a>
                {mapsQuery ? (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer"
                    className="h-[52px] rounded-xl border border-[#D8D0C2] bg-surface text-[15px] font-semibold inline-flex items-center justify-center gap-2">
                    <Navigation className="w-[18px] h-[18px]" aria-hidden />Como chegar
                  </a>
                ) : <span />}
              </div>

              <div className="flex flex-col items-center gap-1.5 pt-1.5">
                <a href={`/agendar/${slug}/cancelar`} className="h-11 inline-flex items-center text-[15px] font-semibold text-ink-2 underline underline-offset-2">Remarcar ou cancelar</a>
                <button type="button" className="h-11 text-[15px] font-semibold text-ink-2 underline underline-offset-2"
                  onClick={() => { setStep("service"); setSelected({ barber: "", date: "", slot: "" }); setServiceIds([]); setBooked(null); setRescheduleFrom(null); }}>
                  Agendar outro horário
                </button>
              </div>
            </main>
          );
        })()}

        {step === "confirmado" && (
          <div className="text-center pb-6">
            <a href="https://iadebarbearia.com.br" target="_blank" rel="noopener noreferrer" className="text-xs text-ink-4 hover:text-ink-3">
              Agendamento por IA de Barbearia
            </a>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 min-h-[42px] items-center border-t border-line-3 first:border-t-0">
      <dt className="text-ink-3 shrink-0">{label}</dt>
      <dd className="font-semibold text-right">{value}</dd>
    </div>
  );
}

function ManageLink({ slug }: { slug: string }) {
  return (
    <p className="text-center text-[13px] text-ink-3 pt-2">
      Já tem horário marcado?{" "}
      <a href={`/agendar/${slug}/cancelar`} className="font-semibold text-ink-2 underline underline-offset-2">Ver, remarcar ou cancelar</a>
    </p>
  );
}
