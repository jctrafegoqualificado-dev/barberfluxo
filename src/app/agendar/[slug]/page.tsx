"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Check, ChevronLeft, Clock, Calendar, AlertCircle, UserCheck } from "lucide-react";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";

interface Service { id: string; name: string; price: number; duration: number; description: string | null }
interface Barber { id: string; nickname: string | null; user: { name: string } }
interface Shop { id: string; name: string; slug: string; description: string | null; services: Service[]; barbers: Barber[] }
interface DaySlots { date: string; label: string; slots: string[] }

type Step = "service" | "barber" | "datetime" | "dados" | "confirmado";

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [selected, setSelected] = useState({ service: "", barber: "", date: "", slot: "" });
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [clientFound, setClientFound] = useState<boolean | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState<{ startTime: string } | null>(null);
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlots[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetch(`/api/booking/${slug}`)
      .then((r) => r.json())
      .then((d) => setShop(d.shop));
  }, [slug]);

  function handlePhoneChange(phone: string) {
    setForm((f) => ({ ...f, phone }));
    setClientFound(null);

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
        } else {
          setClientFound(false);
        }
      } finally {
        setLookingUp(false);
      }
    }, 600);
  }

  // Carrega os próximos 14 dias com horários disponíveis ao entrar no step datetime
  useEffect(() => {
    if (step !== "datetime" || !selected.barber || !selected.service) return;

    setLoadingSlots(true);
    setDaySlots([]);

    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }

    Promise.all(
      dates.map((date) =>
        fetch(`/api/booking/${slug}/slots?barberId=${selected.barber}&serviceId=${selected.service}&date=${date}`)
          .then((r) => r.json())
          .then((d) => ({ date, label: formatDayLabel(date), slots: d.slots || [] }))
      )
    ).then((results) => {
      setDaySlots(results);
      setLoadingSlots(false);
    });
  }, [step, selected.barber, selected.service, slug]);

  function sel(key: string, val: string) { setSelected((s) => ({ ...s, [key]: val })); }

  function pickSlot(date: string, slot: string) {
    setSelected((s) => ({ ...s, date, slot }));
    setStep("dados");
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const clientName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const r = await fetch(`/api/booking/${slug}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName, clientPhone: form.phone,
        barberId: selected.barber, serviceId: selected.service,
        date: selected.date, startTime: selected.slot,
      }),
    });
    const d = await r.json();
    if (r.ok) { setBooked(d.appointment); setStep("confirmado"); }
    setLoading(false);
  }

  const selectedService = shop?.services.find((s) => s.id === selected.service);
  const selectedBarber = shop?.barbers.find((b) => b.id === selected.barber);
  const hasAnySlot = daySlots.some((d) => d.slots.length > 0);
  const isFormValid = form.firstName.trim().length > 0 && form.phone.trim().length >= 8;

  if (!shop) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-3">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
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
            <h2 className="text-lg font-semibold mb-4">Escolha o serviço</h2>
            {shop.services.map((s) => (
              <button key={s.id} onClick={() => { sel("service", s.id); setStep("barber"); }}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${selected.service === s.id ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{s.name}</p>
                    {s.description && <p className="text-xs text-zinc-400 mt-0.5">{s.description}</p>}
                    <span className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />{s.duration}min
                    </span>
                  </div>
                  <span className="text-primary/80 font-bold text-lg">{formatCurrency(s.price)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* STEP 2 — Profissional */}
        {step === "barber" && (
          <div className="space-y-3">
            <button onClick={() => setStep("service")} className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm mb-4">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            <h2 className="text-lg font-semibold mb-4">Escolha o profissional</h2>
            {shop.barbers.map((b) => (
              <button key={b.id} onClick={() => { sel("barber", b.id); setStep("datetime"); }}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${selected.barber === b.id ? "border-primary bg-primary/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"}`}>
                <p className="font-semibold">{b.user.name}</p>
                {b.nickname && <p className="text-xs text-zinc-400">{b.nickname}</p>}
              </button>
            ))}
          </div>
        )}

        {/* STEP 3 — Data e Horário (smart) */}
        {step === "datetime" && (
          <div className="space-y-4">
            <button onClick={() => setStep("barber")} className="flex items-center gap-1 text-zinc-400 hover:text-white text-sm">
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
            <div>
              <h2 className="text-lg font-semibold">Escolha data e horário</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Próximos 14 dias — clique direto no horário desejado</p>
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
              <div className="space-y-3">
                {daySlots.map(({ date, label, slots }) => {
                  if (slots.length === 0) return null;
                  return (
                    <div key={date} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="font-semibold text-sm">{label}</span>
                        </div>
                        <span className="text-xs text-zinc-500">{slots.length} horário{slots.length > 1 ? "s" : ""}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 p-3">
                        {slots.map((slot) => (
                          <button
                            key={slot}
                            onClick={() => pickSlot(date, slot)}
                            className="py-2 rounded-lg text-sm font-semibold bg-zinc-800 hover:bg-primary hover:text-white text-zinc-200 transition-colors"
                          >
                            {slot}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
              <p className="text-zinc-400">Serviço: <span className="text-white font-medium">{selectedService?.name}</span></p>
              <p className="text-zinc-400">Profissional: <span className="text-white font-medium">{selectedBarber?.user.name}</span></p>
              <p className="text-zinc-400">Data: <span className="text-white font-medium">{formatDayLabel(selected.date)} às {selected.slot}</span></p>
              <p className="text-zinc-400">Valor: <span className="text-primary/80 font-bold">{formatCurrency(selectedService?.price || 0)}</span></p>
            </div>
            <form onSubmit={handleBook} className="space-y-3">
              {/* Telefone primeiro — dispara lookup */}
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

              {/* Feedback de reconhecimento */}
              {clientFound === true && (
                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5">
                  <UserCheck className="w-4 h-4 text-green-400 shrink-0" />
                  <p className="text-sm text-green-400 font-medium">
                    Olá, {form.firstName}! Seus dados foram encontrados.
                  </p>
                </div>
              )}

              {/* Nome e sobrenome — sempre visíveis para editar */}
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
              <p className="text-zinc-400">Serviço: <span className="text-white">{selectedService?.name}</span></p>
              <p className="text-zinc-400">Profissional: <span className="text-white">{selectedBarber?.user.name}</span></p>
              <p className="text-zinc-400">Data: <span className="text-white">{formatDayLabel(selected.date)} às {booked?.startTime}</span></p>
            </div>
            <Button onClick={() => { setStep("service"); setSelected({ service: "", barber: "", date: "", slot: "" }); }} variant="secondary">
              Fazer novo agendamento
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
