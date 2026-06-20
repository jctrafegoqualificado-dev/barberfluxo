"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Check, ChevronLeft, ChevronRight, Clock, Calendar, AlertCircle, UserCheck, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface Service { id: string; name: string; price: number; duration: number; description: string | null }
interface Barber { id: string; nickname: string | null; user: { name: string } }
interface Shop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  services: Service[];
  barbers: Barber[]
}
interface DaySlots { date: string; label: string; slots: string[] }

type Step = "service" | "barber" | "datetime" | "dados" | "confirmado";

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ?
    `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` :
    null;
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (dateStr === localDateStr(today)) return "Hoje";
  if (dateStr === localDateStr(tomorrow)) return "Amanhã";
  return `${DIAS_PT[d.getDay()]}, ${d.getDate()} ${MESES_PT[d.getMonth()]}`;
}

export default function AgendarPage() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [step, setStep] = useState<Step>("service");
  const [selected, setSelected] = useState({ barber: "", date: "", slot: "" });
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [clientFound, setClientFound] = useState<boolean | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState<{ startTime: string } | null>(null);
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlots[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [activeSub, setActiveSub] = useState<{ subscriptionId: string; planName: string; allowedBarberIds: string[] } | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  // Calendar strip state
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = week 1 (days 0-6), 1 = week 2 (days 7-13)

  useEffect(() => {
    fetch(`/api/booking/${slug}`)
      .then((r) => r.json())
      .then((d) => setShop(d.shop));
  }, [slug]);

  function handlePhoneChange(phone: string) {
    setForm((f) => ({ ...f, phone }));
    setClientFound(null);
    setActiveSub(null);

    if (phoneDebounce.current) clearTimeout(phoneDebounce.current);

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return;

    phoneDebounce.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const r = await fetch(`/api/booking/${slug}/cliente?phone=${encodeURIComponent(phone)}`);
        const d = await r.json();
        if (d.found) {
          setForm((f) => ({ ...f, firstName: d.firstName, lastName: d.lastName }));
          setClientFound(true);

          const subRes = await fetch(`/api/booking/${slug}/subscriber?phone=${encodeURIComponent(digits)}`);
          const subData = await subRes.json();
          if (subData.subscriptionId) {
            setActiveSub(subData);
          }
        } else {
          setClientFound(false);
        }
      } finally {
        setLookingUp(false);
      }
    }, 600);
  }

  // Carrega os próximos 14 dias ao entrar no step datetime
  useEffect(() => {
    if (step !== "datetime" || !selected.barber || serviceIds.length === 0) return;

    setLoadingSlots(true);
    setDaySlots([]);
    setSelectedDate("");
    setWeekOffset(0);

    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(localDateStr(d));
    }

    Promise.all(
      dates.map((date) =>
        fetch(`/api/booking/${slug}/slots?barberId=${selected.barber}&serviceIds=${serviceIds.join(",")}&date=${date}`)
          .then((r) => r.json())
          .then((d) => ({ date, label: formatDayLabel(date), slots: d.slots || [] }))
      )
    ).then((results) => {
      setDaySlots(results);
      // Auto-seleciona o primeiro dia com horário disponível
      const firstAvailable = results.find((d) => d.slots.length > 0);
      if (firstAvailable) {
        setSelectedDate(firstAvailable.date);
        const idx = results.indexOf(firstAvailable);
        if (idx >= 7) setWeekOffset(1);
      }
      setLoadingSlots(false);
    });
  }, [step, selected.barber, serviceIds.join(","), slug]);

  function sel(key: string, val: string) { setSelected((s) => ({ ...s, [key]: val })); }
  function toggleService(id: string) {
    setServiceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function pickSlot(date: string, slot: string) {
    setSelected((s) => ({ ...s, date, slot }));
    setStep("dados");
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setBookError(null);
    const clientName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const isAllowed = !activeSub || activeSub.allowedBarberIds.length === 0 || activeSub.allowedBarberIds.includes(selected.barber);
    const subscriptionId = activeSub && isAllowed ? activeSub.subscriptionId : undefined;

    const r = await fetch(`/api/booking/${slug}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName, clientPhone: form.phone,
        barberId: selected.barber, serviceIds,
        date: selected.date, startTime: selected.slot,
        subscriptionId,
      }),
    });
    const d = await r.json();
    if (r.ok) { setBooked(d.appointment); setStep("confirmado"); }
    else { setBookError(d.error || "Não foi possível concluir o agendamento."); }
    setLoading(false);
  }

  const selectedServices = shop?.services.filter((s) => serviceIds.includes(s.id)) ?? [];
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const selectedBarber = shop?.barbers.find((b) => b.id === selected.barber);
  const hasAnySlot = daySlots.some((d) => d.slots.length > 0);
  const isFormValid = form.firstName.trim().length > 0 && form.phone.trim().length >= 8;

  // Semana atual visível no strip (7 dias por vez)
  const weekDays = daySlots.slice(weekOffset * 7, weekOffset * 7 + 7);
  const currentDaySlots = daySlots.find((d) => d.date === selectedDate);

  if (!shop) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const primaryRgb = shop.primaryColor ? hexToRgb(shop.primaryColor) : "245, 158, 11";
  const secondaryRgb = shop.secondaryColor ? hexToRgb(shop.secondaryColor) : "251, 191, 36";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --primary: ${primaryRgb};
          --secondary: ${secondaryRgb};
        }
      `}} />
      <div className="min-h-screen bg-zinc-950 text-white">
        <div className="max-w-md mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          {shop.logoUrl ? (
            <div className="inline-flex items-center justify-center mb-3">
              <img
                src={shop.logoUrl}
                alt={shop.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-primary/20 shadow-md"
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-3">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{shop.name}</h1>
          {shop.description && <p className="text-zinc-400 text-sm mt-1">{shop.description}</p>}
        </div>

        {/* Stepper */}
        {step !== "confirmado" && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {(["service", "barber", "datetime", "dados"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s ? "bg-primary text-white"
                  : ["service","barber","datetime","dados"].indexOf(step) > i ? "bg-green-500 text-white"
                  : "bg-zinc-800 text-zinc-500"
                }`}>
                  {["service","barber","datetime","dados"].indexOf(step) > i ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < 3 && <div className="w-8 h-0.5 bg-zinc-800" />}
              </div>
            ))}
          </div>
        )}

        {/* STEP 1 — Serviço */}
        {step === "service" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold mb-1">Escolha o serviço</h2>
            <p className="text-xs text-zinc-500 mb-4">Você pode selecionar mais de um.</p>
            {shop.services.map((s) => {
              const checked = serviceIds.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggleService(s.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${checked ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${checked ? "border-primary bg-primary text-white" : "border-zinc-600"}`}>
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        {s.description && <p className="text-xs text-zinc-400 mt-0.5">{s.description}</p>}
                        <span className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />{s.duration}min
                        </span>
                      </div>
                    </div>
                    <span className="text-primary/80 font-bold text-lg shrink-0">{formatCurrency(s.price)}</span>
                  </div>
                </button>
              );
            })}
            {serviceIds.length > 0 && (
              <div className="sticky bottom-0 pt-3 bg-gradient-to-t from-black via-black/95 to-transparent">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center justify-between mb-3">
                  <p className="text-sm text-zinc-400">{serviceIds.length} serviço{serviceIds.length > 1 ? "s" : ""} · {totalDuration}min</p>
                  <p className="text-primary/80 font-bold text-lg">{formatCurrency(totalPrice)}</p>
                </div>
                <Button onClick={() => setStep("barber")} className="w-full" size="lg">Continuar</Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Profissional */}
        {step === "barber" && (
          <div className="space-y-3">
            <button onClick={() => setStep("service")} className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm mb-4">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-semibold mb-4">Escolha o profissional</h2>
            {shop.barbers.map((b) => {
              const isAllowed = !activeSub || activeSub.allowedBarberIds.length === 0 || activeSub.allowedBarberIds.includes(b.id);
              return (
                <button key={b.id} onClick={() => { sel("barber", b.id); setStep("datetime"); }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${selected.barber === b.id ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{b.user.name}</p>
                      {b.nickname && <p className="text-xs text-zinc-400">{b.nickname}</p>}
                    </div>
                    {activeSub && (
                      isAllowed ? (
                        <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded">✓ Incluso no plano</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded">💰 Não incluso</span>
                      )
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 3 — Data e Horário com calendar strip */}
        {step === "datetime" && (
          <div className="space-y-4">
            <button onClick={() => setStep("barber")} className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            <div>
              <h2 className="text-lg font-semibold">Escolha data e horário</h2>
            </div>

            {loadingSlots ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                <p className="text-zinc-500 text-sm">Buscando horários disponíveis...</p>
              </div>
            ) : !hasAnySlot ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 bg-zinc-900 rounded-xl border border-zinc-800">
                <AlertCircle className="w-10 h-10 text-zinc-600" />
                <p className="text-zinc-400 text-sm text-center">Nenhum horário disponível<br />nos próximos 14 dias</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* ── Calendar strip ── */}
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-3">
                  <div className="flex items-center gap-2">
                    {/* Seta semana anterior */}
                    <button
                      onClick={() => {
                        setWeekOffset(0);
                        const firstInWeek = daySlots.slice(0, 7).find((d) => d.slots.length > 0);
                        if (firstInWeek) setSelectedDate(firstInWeek.date);
                      }}
                      disabled={weekOffset === 0}
                      className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-default transition-all shrink-0 active:scale-95"
                      aria-label="Semana anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {/* Dias da semana */}
                    <div className="flex gap-1.5 flex-1 overflow-hidden">
                      {weekDays.map(({ date, slots }) => {
                        const d = new Date(date + "T12:00:00");
                        const isSelected = selectedDate === date;
                        const hasSlots = slots.length > 0;
                        const isToday = date === localDateStr(new Date());
                        return (
                          <button
                            key={date}
                            onClick={() => hasSlots && setSelectedDate(date)}
                            disabled={!hasSlots}
                            className={`flex-1 flex flex-col items-center py-2.5 px-0.5 rounded-xl text-center transition-all active:scale-95 min-w-0 ${
                              isSelected
                                ? "bg-primary text-white shadow-lg shadow-primary/30"
                                : hasSlots
                                ? "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                                : "bg-zinc-800/40 text-zinc-600 cursor-default"
                            }`}
                          >
                            <span className={`text-[9px] font-semibold uppercase tracking-wider ${isSelected ? "text-white/80" : "text-zinc-500"}`}>
                              {DIAS_PT[d.getDay()]}
                            </span>
                            <span className="text-base font-bold leading-tight mt-0.5">
                              {d.getDate()}
                            </span>
                            <span className={`text-[9px] ${isSelected ? "text-white/70" : "text-zinc-500"}`}>
                              {MESES_PT[d.getMonth()]}
                            </span>
                            {/* Indicador de disponibilidade */}
                            {hasSlots && !isSelected && (
                              <div className="w-1 h-1 rounded-full bg-primary mt-1" />
                            )}
                            {isToday && !isSelected && (
                              <div className="w-1 h-1 rounded-full bg-zinc-400 mt-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Seta próxima semana */}
                    <button
                      onClick={() => {
                        setWeekOffset(1);
                        const firstInWeek = daySlots.slice(7, 14).find((d) => d.slots.length > 0);
                        if (firstInWeek) setSelectedDate(firstInWeek.date);
                      }}
                      disabled={weekOffset === 1}
                      className="p-2 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-20 disabled:cursor-default transition-all shrink-0 active:scale-95"
                      aria-label="Próxima semana"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Label da semana */}
                  <p className="text-center text-xs text-zinc-600 mt-2">
                    {weekOffset === 0 ? "Esta semana" : "Próxima semana"}
                  </p>
                </div>

                {/* ── Horários do dia selecionado ── */}
                {selectedDate && currentDaySlots ? (
                  currentDaySlots.slots.length > 0 ? (
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary/80" />
                          <span className="font-semibold text-sm">{formatDayLabel(selectedDate)}</span>
                        </div>
                        <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                          {currentDaySlots.slots.length} horário{currentDaySlots.slots.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 p-3">
                        {currentDaySlots.slots.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => pickSlot(selectedDate, slot)}
                            className="py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-primary hover:text-white text-zinc-200 transition-all active:scale-95 border border-zinc-700 hover:border-primary"
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 text-center">
                      <p className="text-zinc-500 text-sm">Sem horários disponíveis neste dia</p>
                      <p className="text-zinc-600 text-xs mt-1">Selecione outro dia no calendário acima</p>
                    </div>
                  )
                ) : (
                  <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8 text-center">
                    <p className="text-zinc-500 text-sm">Selecione um dia acima para ver os horários</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4 — Dados pessoais */}
        {step === "dados" && (
          <div className="space-y-4">
            <button onClick={() => setStep("datetime")} className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-semibold">Seus dados</h2>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-1 text-sm">
              <p className="text-zinc-400">Serviço{selectedServices.length > 1 ? "s" : ""}: <span className="text-white font-medium">{selectedServices.map((s) => s.name).join(" + ")}</span></p>
              <p className="text-zinc-400">Profissional: <span className="text-white font-medium">{selectedBarber?.user.name}</span></p>
              <p className="text-zinc-400">Data: <span className="text-white font-medium">{formatDayLabel(selected.date)} às {selected.slot}</span></p>
              <p className="text-zinc-400">Valor: <span className="text-primary/80 font-bold">{formatCurrency(totalPrice)}</span></p>
            </div>
            <form onSubmit={handleBook} className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">WhatsApp</label>
                <div className="relative">
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(41) 99999-9999"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {lookingUp && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {clientFound === true && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
                  <UserCheck className="w-4 h-4 text-green-400 shrink-0" />
                  <p className="text-sm text-green-400 font-medium">
                    Olá, {form.firstName}! Seus dados foram encontrados.
                  </p>
                </div>
              )}

              {activeSub && (
                (() => {
                  const isAllowed = activeSub.allowedBarberIds.length === 0 || activeSub.allowedBarberIds.includes(selected.barber);
                  return isAllowed ? (
                    <div className="flex flex-col gap-1 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400 shrink-0" />
                        <p className="text-sm text-green-400 font-bold">
                          Assinatura Ativa: {activeSub.planName}
                        </p>
                      </div>
                      <p className="text-xs text-green-500/90 pl-6">
                        ✓ Este agendamento está 100% coberto pelo seu plano e o profissional {selectedBarber?.user.name} está autorizado!
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <p className="text-sm text-amber-400 font-bold">
                          Restrição de Profissional
                        </p>
                      </div>
                      <p className="text-xs text-amber-400/90 pl-6">
                        O profissional <strong>{selectedBarber?.user.name}</strong> não está incluído no seu plano de assinatura (<strong>{activeSub.planName}</strong>).
                      </p>
                      <div className="pl-6 flex gap-3 mt-1">
                        <button
                          type="button"
                          onClick={() => setStep("barber")}
                          className="text-xs font-bold text-amber-300 hover:text-amber-200 underline transition-all"
                        >
                          Alterar profissional
                        </button>
                        <span className="text-xs text-zinc-500">ou continue para pagar no local</span>
                      </div>
                    </div>
                  );
                })()
              )}

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-400 mb-1">Nome</label>
                  <input
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    placeholder="João"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-zinc-400 mb-1">Sobrenome</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    placeholder="Silva"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {bookError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-400">
                    <p>{bookError}</p>
                    <a href={`/agendar/${slug}/cancelar`} className="underline text-red-300 hover:text-red-200 text-xs mt-1 inline-block">
                      Gerenciar meus agendamentos →
                    </a>
                  </div>
                </div>
              )}

              <Button type="submit" loading={loading} disabled={!isFormValid} className="w-full" size="lg">
                Confirmar Agendamento
              </Button>
            </form>
          </div>
        )}

        {/* CONFIRMADO */}
        {step === "confirmado" && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
              <Check className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Agendado!</h2>
            <p className="text-zinc-400 mb-6">Seu horário foi confirmado.</p>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 text-left space-y-2 text-sm mb-6">
              <p className="text-zinc-400">Serviço{selectedServices.length > 1 ? "s" : ""}: <span className="text-white">{selectedServices.map((s) => s.name).join(" + ")}</span></p>
              <p className="text-zinc-400">Profissional: <span className="text-white">{selectedBarber?.user.name}</span></p>
              <p className="text-zinc-400">Data: <span className="text-white">{formatDayLabel(selected.date)} às {booked?.startTime}</span></p>
            </div>
            <p className="text-xs text-zinc-500 mb-5">
              Precisa cancelar?{" "}
              <a href={`/agendar/${slug}/cancelar`} className="text-primary/80 underline hover:text-primary">
                Gerenciar meus agendamentos
              </a>
            </p>
            <Button onClick={() => { setStep("service"); setSelected({ barber: "", date: "", slot: "" }); setServiceIds([]); }} variant="secondary">
              Fazer novo agendamento
            </Button>
          </div>
        )}

      </div>

      {/* Rodapé: acesso rápido ao cancelamento */}
      {step !== "confirmado" && (
        <div className="text-center py-4 border-t border-zinc-800/50">
          <p className="text-xs text-zinc-600">
            Já tem um agendamento?{" "}
            <a href={`/agendar/${slug}/cancelar`} className="text-zinc-500 underline underline-offset-2 hover:text-zinc-300 transition-colors">
              Ver ou cancelar meus horários
            </a>
          </p>
        </div>
      )}

      {/* Powered by — PLG passivo para donos de barbearia que chegam como clientes */}
      <div className="text-center py-3">
        <a
          href="https://iadebarbearia.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-500 transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          Agendamento por IaDeBarbearia
        </a>
      </div>
    </div>
    </>
  );
}
