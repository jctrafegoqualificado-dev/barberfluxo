"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Calendar, CheckCircle, XCircle, UserX, Clock, DollarSign, TrendingUp, Phone, ChevronLeft, ChevronRight, Scissors, Plus, X, AlertCircle, UserCheck, Lock, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

interface Appointment {
  id: string; startTime: string; endTime: string; status: string; price: number;
  client: { name: string; phone: string | null };
  service: { name: string; duration: number };
  subscription: { plan: { name: string } } | null;
}

interface Service { id: string; name: string; price: number; duration: number; description: string | null }
interface DaySlots { date: string; slots: string[] }
interface Block { id: string; startTime: string; endTime: string; reason: string | null }

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2 horas", value: 120 },
  { label: "3 horas", value: 180 },
  { label: "Dia todo", value: 480 },
];

const PX_PER_MIN = 1.5;
const CAL_START = 7;
const CAL_END = 22;
const PX_PER_HOUR = PX_PER_MIN * 60;

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function timeToTop(t: string) {
  return (timeToMin(t) - CAL_START * 60) * PX_PER_MIN;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function BloquearAgendaModal({ token, date, onClose, onBlocked }: { token: string; date: string; onClose: () => void; onBlocked: () => void }) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(Math.ceil(now.getMinutes() / 15) * 15 % 60).padStart(2, "0")}`;
  const [startTime, setStartTime] = useState(currentTime);
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const endTime = addMinutes(startTime, duration);

  async function handleBlock() {
    setSaving(true);
    await fetch("/api/barber/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, startTime, endTime, reason }),
    });
    setSaving(false);
    onBlocked();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-zinc-900">Bloquear Agenda</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">Duração do bloqueio</label>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button key={d.value} onClick={() => setDuration(d.value)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${duration === d.value ? "bg-red-500 border-red-500 text-white" : "bg-white border-zinc-200 text-zinc-700 hover:border-red-300"}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Início</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>

          <div className="bg-red-50 rounded-xl border border-red-100 px-4 py-3 text-sm text-red-700">
            Agenda bloqueada das <strong>{startTime}</strong> às <strong>{endTime}</strong>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Motivo (opcional)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Almoço, Reunião..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>

          <button onClick={handleBlock} disabled={saving}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Lock className="w-4 h-4" /> Bloquear Agora</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function getTodayBR() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const todayBR = getTodayBR();
  const tomorrowDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowBR = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
  if (dateStr === todayBR) return "Hoje";
  if (dateStr === tomorrowBR) return "Amanhã";
  return `${DIAS_PT[d.getDay()]}, ${d.getDate()} ${MESES_PT[d.getMonth()]}`;
}

type BookStep = "service" | "datetime" | "dados" | "confirmado";

function NovoAgendamentoModal({ token, onClose, onBooked }: { token: string; onClose: () => void; onBooked: () => void }) {
  const [bookingData, setBookingData] = useState<{ barberId: string; slug: string; services: Service[] } | null>(null);
  const [step, setStep] = useState<BookStep>("service");
  const [selected, setSelected] = useState({ service: "", date: "", slot: "" });
  const [daySlots, setDaySlots] = useState<DaySlots[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [clientFound, setClientFound] = useState<boolean | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<{ startTime: string } | null>(null);
  const phoneDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/barber/booking-data", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setBookingData(d));
  }, [token]);

  useEffect(() => {
    if (step !== "datetime" || !bookingData || !selected.service) return;
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
        fetch(`/api/booking/${bookingData.slug}/slots?barberId=${bookingData.barberId}&serviceId=${selected.service}&date=${date}&barber=true`)
          .then((r) => r.json())
          .then((d) => ({ date, slots: d.slots || [] }))
      )
    ).then((results) => { setDaySlots(results); setLoadingSlots(false); });
  }, [step, selected.service, bookingData]);

  function handlePhoneChange(phone: string) {
    setForm((f) => ({ ...f, phone }));
    setClientFound(null);
    if (phoneDebounce.current) clearTimeout(phoneDebounce.current);
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) return;
    phoneDebounce.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const r = await fetch(`/api/booking/${bookingData!.slug}/cliente?phone=${encodeURIComponent(phone)}`);
        const d = await r.json();
        if (d.found) { setForm((f) => ({ ...f, firstName: d.firstName, lastName: d.lastName })); setClientFound(true); }
        else setClientFound(false);
      } finally { setLookingUp(false); }
    }, 600);
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingData) return;
    setBooking(true);
    const clientName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const r = await fetch(`/api/booking/${bookingData.slug}/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName, clientPhone: form.phone,
        barberId: bookingData.barberId, serviceId: selected.service,
        date: selected.date, startTime: selected.slot,
      }),
    });
    const d = await r.json();
    if (r.ok) { setBooked(d.appointment); setStep("confirmado"); onBooked(); }
    setBooking(false);
  }

  const selectedService = bookingData?.services.find((s) => s.id === selected.service);
  const hasAnySlot = daySlots.some((d) => d.slots.length > 0);
  const isFormValid = form.firstName.trim().length > 0 && form.phone.replace(/\D/g, "").length >= 8;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            {step !== "service" && step !== "confirmado" && (
              <button onClick={() => setStep(step === "datetime" ? "service" : "datetime")} className="p-1 rounded-lg hover:bg-zinc-100">
                <ChevronLeft className="w-5 h-5 text-zinc-500" />
              </button>
            )}
            <h2 className="font-bold text-zinc-900">Novo Agendamento</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-5">
          {!bookingData && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {bookingData && step === "service" && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-500 mb-4">Escolha o serviço</p>
              {bookingData.services.map((s) => (
                <button key={s.id}
                  onClick={() => { setSelected((x) => ({ ...x, service: s.id })); setStep("datetime"); }}
                  className="w-full text-left p-4 rounded-xl border border-zinc-200 hover:border-amber-400 hover:bg-amber-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-zinc-900">{s.name}</p>
                      {s.description && <p className="text-xs text-zinc-400 mt-0.5">{s.description}</p>}
                      <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{s.duration}min
                      </p>
                    </div>
                    <span className="text-amber-600 font-bold">{formatCurrency(s.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {bookingData && step === "datetime" && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">Escolha data e horário</p>
              {loadingSlots ? (
                <div className="flex flex-col items-center py-12 gap-3">
                  <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-zinc-400 text-sm">Buscando horários...</p>
                </div>
              ) : !hasAnySlot ? (
                <div className="flex flex-col items-center py-12 gap-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <AlertCircle className="w-10 h-10 text-zinc-400" />
                  <p className="text-zinc-500 text-sm text-center">Nenhum horário disponível<br />nos próximos 14 dias</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {daySlots.map(({ date, slots }) => {
                    if (slots.length === 0) return null;
                    return (
                      <div key={date} className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-amber-500" />
                            <span className="font-semibold text-sm text-zinc-900">{formatDayLabel(date)}</span>
                          </div>
                          <span className="text-xs text-zinc-400">{slots.length} horário{slots.length > 1 ? "s" : ""}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 p-3">
                          {slots.map((slot) => (
                            <button key={slot}
                              onClick={() => { setSelected((x) => ({ ...x, date, slot })); setStep("dados"); }}
                              className="py-2 rounded-lg text-sm font-semibold bg-white border border-zinc-200 hover:bg-amber-500 hover:text-white hover:border-amber-500 text-zinc-700 transition-colors">
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

          {bookingData && step === "dados" && (
            <div className="space-y-4">
              <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 space-y-1 text-sm">
                <p className="text-zinc-500">Serviço: <span className="font-semibold text-zinc-900">{selectedService?.name}</span></p>
                <p className="text-zinc-500">Data: <span className="font-semibold text-zinc-900">{formatDayLabel(selected.date)} às {selected.slot}</span></p>
                <p className="text-zinc-500">Valor: <span className="font-bold text-amber-600">{formatCurrency(selectedService?.price || 0)}</span></p>
              </div>

              <form onSubmit={handleBook} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">WhatsApp do cliente</label>
                  <div className="relative">
                    <input required type="tel" value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(41) 99999-9999"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                    {lookingUp && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {clientFound === true && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
                    <UserCheck className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-sm text-green-700 font-medium">Olá, {form.firstName}! Dados encontrados.</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Nome</label>
                    <input required value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      placeholder="João"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Sobrenome</label>
                    <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      placeholder="Silva"
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>

                <button type="submit" disabled={!isFormValid || booking}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                  {booking ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Confirmar Agendamento"}
                </button>
              </form>
            </div>
          )}

          {step === "confirmado" && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-1">Agendado!</h3>
              <p className="text-zinc-500 text-sm mb-6">O horário foi confirmado com sucesso.</p>
              <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 text-left space-y-1.5 text-sm mb-6">
                <p className="text-zinc-500">Cliente: <span className="font-semibold text-zinc-900">{form.firstName} {form.lastName}</span></p>
                <p className="text-zinc-500">Serviço: <span className="font-semibold text-zinc-900">{selectedService?.name}</span></p>
                <p className="text-zinc-500">Data: <span className="font-semibold text-zinc-900">{formatDayLabel(selected.date)} às {booked?.startTime}</span></p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setStep("service"); setSelected({ service: "", date: "", slot: "" }); setForm({ firstName: "", lastName: "", phone: "" }); setBooked(null); setClientFound(null); }}
                  className="flex-1 border border-zinc-200 text-zinc-700 font-semibold py-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-sm">
                  Novo Agendamento
                </button>
                <button onClick={onClose}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface DashData {
  barberName: string;
  hoje: { total: number; done: number; pending: number; noShow: number; faturado: number };
  mes: { atendimentos: number; faturado: number; comissao: number; avulso: number; assinatura: number };
  agenda: Appointment[];
  proximoAgendamento: Appointment | null;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const STATUS_BG: Record<string, string> = {
  CONFIRMED: "bg-amber-500",
  PENDING: "bg-amber-400",
  DONE: "bg-green-500",
  NO_SHOW: "bg-red-400",
  CANCELLED: "bg-zinc-300",
};

function ApptActionModal({ appt, onClose, onUpdate }: {
  appt: Appointment;
  onClose: () => void;
  onUpdate: (id: string, status: string, paymentMethod?: string) => void;
}) {
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const isActive = appt.status === "CONFIRMED" || appt.status === "PENDING";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl">
        {/* Info do agendamento */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="font-bold text-zinc-900 text-lg">{appt.client.name}</p>
            <p className="text-sm text-zinc-500">{appt.service.name} · {appt.startTime}–{appt.endTime}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {isActive && !showPayment && (
            <>
              <button
                onClick={() => setShowPayment(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 font-semibold hover:bg-green-100 active:bg-green-200 transition-colors text-left">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span>Marcar como concluído</span>
              </button>
              <button
                onClick={() => { onUpdate(appt.id, "NO_SHOW"); onClose(); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-semibold hover:bg-red-100 active:bg-red-200 transition-colors text-left">
                <UserX className="w-5 h-5 shrink-0" />
                <span>Cliente não compareceu</span>
              </button>
              <button
                onClick={() => { onUpdate(appt.id, "CANCELLED"); onClose(); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-100 active:bg-zinc-200 transition-colors text-left">
                <XCircle className="w-5 h-5 shrink-0" />
                <span>Cancelar agendamento</span>
              </button>
            </>
          )}

          {showPayment && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-semibold text-zinc-900 text-center">Como o cliente pagou?</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "CASH", label: "Dinheiro" },
                  { id: "PIX", label: "Pix" },
                  { id: "CREDIT_CARD", label: "Cartão de Crédito" },
                  { id: "DEBIT_CARD", label: "Cartão de Débito" },
                  { id: "SUBSCRIPTION", label: "Clube (Assinatura)" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPaymentMethod(p.id)}
                    className={`p-3 rounded-xl border text-sm font-semibold transition-colors ${paymentMethod === p.id ? "bg-green-500 border-green-500 text-white" : "bg-white border-zinc-200 text-zinc-700 hover:border-green-300"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowPayment(false)} className="flex-1 py-3 border border-zinc-200 text-zinc-600 font-semibold rounded-xl hover:bg-zinc-50 transition-colors">Voltar</button>
                <button onClick={() => { onUpdate(appt.id, "DONE", paymentMethod); onClose(); }} className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors">Confirmar Pagamento</button>
              </div>
            </div>
          )}

          {appt.status === "DONE" && (
            <div className="text-center py-4">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-green-700">Atendimento concluído</p>
            </div>
          )}
          {appt.status === "NO_SHOW" && (
            <div className="text-center py-4">
              <UserX className="w-10 h-10 text-red-400 mx-auto mb-2" />
              <p className="font-semibold text-red-600">Cliente não compareceu</p>
            </div>
          )}
          {appt.status === "CANCELLED" && (
            <div className="text-center py-4">
              <XCircle className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
              <p className="font-semibold text-zinc-500">Agendamento cancelado</p>
            </div>
          )}

          {appt.client.phone && (
            <a href={`tel:${appt.client.phone}`}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors text-sm">
              <Phone className="w-4 h-4" /> Ligar para {appt.client.name.split(" ")[0]}
            </a>
          )}
        </div>
        <div className="pb-6" />
      </div>
    </div>
  );
}

export default function BarbeiroAgendaPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [agendaDate, setAgendaDate] = useState(getTodayBR);
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  const [showBloquear, setShowBloquear] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [agendaAppts, setAgendaAppts] = useState<Appointment[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/barber/dashboard", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setData(d);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadAgenda = useCallback(async (d: string) => {
    const [apptRes, blockRes] = await Promise.all([
      fetch(`/api/barbershop/appointments?date=${d}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/barber/blocks?date=${d}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const apptData = await apptRes.json();
    const blockData = await blockRes.json();
    setAgendaAppts(apptData.appointments || []);
    setBlocks(blockData.blocks || []);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAgenda(agendaDate); }, [agendaDate, loadAgenda]);

  // Auto-scroll para o horário atual
  useEffect(() => {
    if (!calendarRef.current) return;
    const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const top = (br.getHours() * 60 + br.getMinutes() - CAL_START * 60) * PX_PER_MIN;
    calendarRef.current.scrollTop = Math.max(0, top - 80);
  }, [agendaDate]);

  async function deleteBlock(id: string) {
    await fetch("/api/barber/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    loadAgenda(agendaDate);
  }

  async function updateStatus(id: string, status: string, paymentMethod?: string) {
    const r = await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status, paymentMethod }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert("Erro ao atualizar: " + (d.error || r.status));
      return;
    }
    load();
    loadAgenda(agendaDate);
  }

  function prevDay() {
    const d = new Date(agendaDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setAgendaDate(d.toISOString().slice(0, 10));
  }
  function nextDay() {
    const d = new Date(agendaDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setAgendaDate(d.toISOString().slice(0, 10));
  }

  const isToday = agendaDate === getTodayBR();
  const totalHeight = (CAL_END - CAL_START) * PX_PER_HOUR;
  const hours = Array.from({ length: CAL_END - CAL_START + 1 }, (_, i) => CAL_START + i);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-500">
      <Scissors className="w-10 h-10 text-zinc-300" />
      <p className="text-sm">Perfil de barbeiro não encontrado para este usuário.</p>
    </div>
  );

  const d = data;

  // Current time indicator
  const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const nowTop = (brNow.getHours() * 60 + brNow.getMinutes() - CAL_START * 60) * PX_PER_MIN;
  const showNowLine = isToday && nowTop >= 0 && nowTop <= totalHeight;

  return (
    <div className="space-y-6">
      {showNovoAgendamento && (
        <NovoAgendamentoModal
          token={token!}
          onClose={() => setShowNovoAgendamento(false)}
          onBooked={() => { load(); loadAgenda(agendaDate); }}
        />
      )}
      {showBloquear && (
        <BloquearAgendaModal
          token={token!}
          date={agendaDate}
          onClose={() => setShowBloquear(false)}
          onBlocked={() => loadAgenda(agendaDate)}
        />
      )}
      {selectedAppt && (
        <ApptActionModal
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onUpdate={(id, status) => { updateStatus(id, status); setSelectedAppt(null); }}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Olá, {d.barberName.split(" ")[0]}!</h1>
        <p className="text-zinc-500 text-sm mt-0.5">{formatDate(new Date())} — Aqui está o resumo do seu dia</p>
      </div>

      {/* KPIs de hoje */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-zinc-100 p-4 text-center">
          <Calendar className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-zinc-900">{d.hoje.total}</p>
          <p className="text-xs text-zinc-400">hoje</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-700">{d.hoje.done}</p>
          <p className="text-xs text-green-600">concluídos</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-700">{d.hoje.pending}</p>
          <p className="text-xs text-amber-600">pendentes</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-100 p-4 text-center">
          <DollarSign className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-zinc-900">{formatCurrency(d.hoje.faturado)}</p>
          <p className="text-xs text-zinc-400">faturado hoje</p>
        </div>
      </div>

      {/* Próximo agendamento */}
      {d.proximoAgendamento && (
        <div className="bg-amber-500 rounded-xl p-4 text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-400 flex items-center justify-center shrink-0 text-white font-bold">
            {getInitials(d.proximoAgendamento.client.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs opacity-80 font-medium mb-0.5">PRÓXIMO CLIENTE</p>
            <p className="font-bold truncate">{d.proximoAgendamento.client.name}</p>
            <p className="text-sm opacity-90">{d.proximoAgendamento.service.name} · {d.proximoAgendamento.startTime}</p>
          </div>
          {d.proximoAgendamento.client.phone && (
            <a href={`tel:${d.proximoAgendamento.client.phone}`}
              className="flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
              <Phone className="w-3.5 h-3.5" /> Ligar
            </a>
          )}
        </div>
      )}

      {/* Resumo do mês */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
        <h2 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-amber-500" /> Minha produção este mês
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-zinc-900">{d.mes.atendimentos}</p>
            <p className="text-xs text-zinc-400">atendimentos</p>
            <p className="text-xs text-zinc-400 mt-0.5">{d.mes.avulso} avulsos · {d.mes.assinatura} assinaturas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-900">{formatCurrency(d.mes.faturado)}</p>
            <p className="text-xs text-zinc-400">faturado</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(d.mes.comissao)}</p>
            <p className="text-xs text-zinc-400">sua comissão</p>
          </div>
        </div>
      </div>

      {/* Agenda — Calendário */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Navegação de dias */}
            <button onClick={prevDay} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-zinc-500" />
            </button>
            <div className="text-center min-w-[120px]">
              <p className="text-sm font-bold text-zinc-900">{formatDayLabel(agendaDate)}</p>
              {!isToday && <p className="text-xs text-zinc-400">{agendaDate}</p>}
              {isToday && <p className="text-xs text-amber-600 font-medium">Hoje</p>}
            </div>
            <button onClick={nextDay} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>
            {!isToday && (
              <button onClick={() => setAgendaDate(getTodayBR())}
                className="text-xs text-amber-600 font-semibold hover:underline px-1">
                Hoje
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowBloquear(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
              <Lock className="w-3.5 h-3.5" /> Bloquear
            </button>
            <button onClick={() => setShowNovoAgendamento(true)}
              className="flex items-center gap-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Novo</span>
            </button>
          </div>
        </div>

        {/* Grid de calendário */}
        <div ref={calendarRef} className="overflow-y-auto" style={{ maxHeight: "65vh" }}>
          <div className="flex">
            {/* Eixo de tempo */}
            <div className="w-12 flex-shrink-0 relative select-none bg-white" style={{ height: `${totalHeight}px` }}>
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ top: `${(h - CAL_START) * PX_PER_HOUR - 8}px` }}
                  className="absolute right-2 text-[10px] text-zinc-300 font-medium leading-none"
                >
                  {`${h.toString().padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {/* Área de eventos */}
            <div className="flex-1 relative border-l border-zinc-100" style={{ height: `${totalHeight}px` }}>
              {/* Linhas de hora */}
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ top: `${(h - CAL_START) * PX_PER_HOUR}px` }}
                  className="absolute left-0 right-0 border-t border-zinc-100"
                />
              ))}
              {/* Linhas de meia hora */}
              {Array.from({ length: CAL_END - CAL_START }, (_, i) => i).map((i) => (
                <div
                  key={`half-${i}`}
                  style={{ top: `${i * PX_PER_HOUR + PX_PER_HOUR / 2}px` }}
                  className="absolute left-0 right-0 border-t border-dashed border-zinc-50"
                />
              ))}

              {/* Linha do horário atual */}
              {showNowLine && (
                <div style={{ top: `${nowTop}px` }} className="absolute left-0 right-0 z-30 flex items-center pointer-events-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                  <div className="flex-1 border-t-2 border-red-500" />
                </div>
              )}

              {/* Bloqueios */}
              {blocks.map((b) => {
                const top = timeToTop(b.startTime);
                const dur = timeToMin(b.endTime) - timeToMin(b.startTime);
                const height = Math.max(dur * PX_PER_MIN, 26);
                return (
                  <div
                    key={b.id}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    className="absolute left-1 right-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1 z-20 flex items-center justify-between overflow-hidden"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <Lock className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="text-xs font-semibold text-red-500 truncate">{b.reason || "Bloqueado"}</span>
                    </div>
                    <button
                      onClick={() => deleteBlock(b.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors shrink-0 ml-1"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                );
              })}

              {/* Agendamentos */}
              {agendaAppts.map((a) => {
                const top = timeToTop(a.startTime);
                const height = Math.max(a.service.duration * PX_PER_MIN, 28);
                const bg = STATUS_BG[a.status] ?? "bg-amber-500";
                const isActive = a.status === "CONFIRMED" || a.status === "PENDING";
                return (
                  <div
                    key={a.id}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    className={`absolute left-1 right-1 ${bg} rounded-lg px-2 py-1 z-20 overflow-hidden cursor-pointer active:brightness-90`}
                    onClick={() => setSelectedAppt(a)}
                  >
                    <div className="flex items-start gap-1 h-full">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate leading-tight">{a.client.name}</p>
                        {height >= 42 && (
                          <p className="text-[11px] text-white/85 truncate leading-tight">{a.service.name}</p>
                        )}
                        {height >= 58 && a.client.phone && (
                          <p className="text-[10px] text-white/70 flex items-center gap-0.5 leading-tight truncate">
                            <Phone className="w-2.5 h-2.5 shrink-0" /> {a.client.phone}
                          </p>
                        )}
                      </div>
                      {/* Botão ✓ sempre visível para fechar rápido */}
                      {isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateStatus(a.id, "DONE"); }}
                          className="shrink-0 w-6 h-6 rounded-full bg-white/30 hover:bg-white/50 active:bg-white/60 flex items-center justify-center transition-colors mt-0.5"
                          title="Marcar como concluído"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Estado vazio */}
              {agendaAppts.length === 0 && blocks.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <Calendar className="w-8 h-8 text-zinc-200" />
                  <p className="text-xs text-zinc-300">Nenhum agendamento</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="px-4 py-2.5 border-t border-zinc-100 flex items-center gap-3 flex-wrap">
          {[
            { label: "Confirmado", color: "bg-amber-500" },
            { label: "Concluído", color: "bg-green-500" },
            { label: "Não compareceu", color: "bg-red-400" },
            { label: "Cancelado", color: "bg-zinc-300" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
              <span className="text-[11px] text-zinc-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowNovoAgendamento(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold px-5 py-3.5 rounded-2xl shadow-xl transition-all text-sm">
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline">Novo Agendamento</span>
      </button>
    </div>
  );
}
