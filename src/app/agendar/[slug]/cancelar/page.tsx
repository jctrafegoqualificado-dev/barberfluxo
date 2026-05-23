"use client";
import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { ChevronLeft, Calendar, Clock, Scissors, X, Check, AlertCircle, Phone } from "lucide-react";
import Link from "next/link";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceName: string;
  barberName: string;
  price: number;
}

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  if (dateStr === todayStr) return "Hoje";
  if (dateStr === tomorrowStr) return "Amanhã";
  return `${DIAS_PT[d.getDay()]}, ${d.getDate()} de ${MESES_PT[d.getMonth()]}`;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type PageState = "phone" | "list" | "empty" | "cancelled";

export default function CancelarPage() {
  const { slug } = useParams<{ slug: string }>();
  const [phone, setPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pageState, setPageState] = useState<PageState>("phone");
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ id: string; msg: string } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/booking/${slug}/meus-agendamentos?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao buscar agendamentos");
        return;
      }
      setClientName(data.clientName || "");
      const active = (data.appointments as Appointment[]).filter((a) => !cancelledIds.has(a.id));
      setAppointments(active);
      setPageState(active.length === 0 ? "empty" : "list");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    setCancelError(null);
    try {
      const res = await fetch(`/api/v1/barbershops/${slug}/appointments/${id}/cancel`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (res.ok) {
        setCancelledIds((prev) => new Set([...prev, id]));
        setAppointments((prev) => prev.filter((a) => a.id !== id));
        if (appointments.length === 1) setPageState("cancelled");
      } else {
        setCancelError({ id, msg: data.error || "Não foi possível cancelar." });
        setConfirmId(null);
      }
    } catch {
      setCancelError({ id, msg: "Erro de conexão. Tente novamente." });
      setConfirmId(null);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-md mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <Link href={`/agendar/${slug}`} className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm mb-6 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Voltar para agendamento
          </Link>
          <h1 className="text-2xl font-bold">Meus agendamentos</h1>
          <p className="text-zinc-400 text-sm mt-1">Visualize e cancele seus horários marcados</p>
        </div>

        {/* STATE: phone input */}
        {pageState === "phone" && (
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Informe seu WhatsApp</p>
                  <p className="text-zinc-500 text-xs">O mesmo número usado no agendamento</p>
                </div>
              </div>

              <div>
                <input
                  ref={inputRef}
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(""); }}
                  placeholder="(41) 99999-9999"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {error && (
                  <p className="text-red-400 text-xs mt-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />{error}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || phone.replace(/\D/g, "").length < 8}
                className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-40 disabled:cursor-default transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Buscando...
                  </span>
                ) : "Buscar meus agendamentos"}
              </button>
            </div>
          </form>
        )}

        {/* STATE: lista de agendamentos */}
        {pageState === "list" && (
          <div className="space-y-4">
            {clientName && (
              <p className="text-zinc-400 text-sm">
                Olá, <span className="text-white font-semibold">{clientName}</span>! Seus próximos agendamentos:
              </p>
            )}

            {appointments.map((appt) => (
              <div key={appt.id} className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                        <span className="text-sm font-semibold">{formatDate(appt.date)}</span>
                        <span className="text-xs text-zinc-500">{appt.startTime}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Scissors className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="text-sm text-zinc-300 truncate">{appt.serviceName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className="text-xs text-zinc-500">com {appt.barberName}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-primary/80 font-bold text-sm">{formatCurrency(appt.price)}</p>
                      <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                        {appt.status === "CONFIRMED" ? "Confirmado" : "Aguardando"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botão cancelar / confirmação inline */}
                {confirmId === appt.id ? (
                  <div className="border-t border-zinc-800 bg-red-950/30 p-3">
                    <p className="text-xs text-red-300 text-center mb-2.5">
                      Tem certeza que deseja cancelar este agendamento?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmId(null)}
                        className="flex-1 py-2 rounded-xl border border-zinc-700 text-zinc-400 text-xs font-medium hover:bg-zinc-800 transition-colors"
                      >
                        Manter
                      </button>
                      <button
                        onClick={() => handleCancel(appt.id)}
                        disabled={cancellingId === appt.id}
                        className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {cancellingId === appt.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <><X className="w-3.5 h-3.5" /> Confirmar cancelamento</>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-zinc-800 px-4 py-2.5">
                    <button
                      onClick={() => setConfirmId(appt.id)}
                      className="w-full text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center justify-center gap-1.5 py-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancelar este agendamento
                    </button>
                  </div>
                )}

                {cancelError?.id === appt.id && (
                  <div className="border-t border-red-900/40 bg-red-950/20 px-4 py-2.5">
                    <p className="text-xs text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {cancelError.msg}
                    </p>
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={() => { setPageState("phone"); setPhone(""); setAppointments([]); }}
              className="w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              Buscar com outro número
            </button>
          </div>
        )}

        {/* STATE: sem agendamentos futuros */}
        {pageState === "empty" && (
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800 mb-4">
              <Calendar className="w-8 h-8 text-zinc-500" />
            </div>
            <h2 className="font-semibold text-zinc-300 mb-1">Nenhum agendamento futuro</h2>
            <p className="text-zinc-500 text-sm mb-6">
              {clientName ? `${clientName}, não` : "Não"} encontramos agendamentos ativos para este número.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href={`/agendar/${slug}`}
                className="py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all text-center block"
              >
                Fazer um agendamento
              </Link>
              <button
                onClick={() => { setPageState("phone"); setPhone(""); }}
                className="py-2.5 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                Tentar outro número
              </button>
            </div>
          </div>
        )}

        {/* STATE: cancelamento bem-sucedido (todos cancelados) */}
        {pageState === "cancelled" && (
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="font-semibold text-zinc-100 mb-1">Agendamento cancelado</h2>
            <p className="text-zinc-400 text-sm mb-6">
              Seu agendamento foi cancelado com sucesso.
            </p>
            <Link
              href={`/agendar/${slug}`}
              className="py-3 px-6 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all inline-block"
            >
              Fazer novo agendamento
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
