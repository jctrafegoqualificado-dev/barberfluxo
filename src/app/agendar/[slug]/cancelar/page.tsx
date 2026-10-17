"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Check, AlertCircle, MessageCircle, Clock } from "lucide-react";
import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";

interface Appointment {
  id: string; date: string; startTime: string; endTime: string; status: string;
  serviceName: string; barberName: string; barberId: string; serviceIds: string[]; price: number;
}
interface ShopRules { name: string; phone: string | null; cancelByClientEnabled: boolean; minCancelHours: number }

const DOW = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const REASONS = ["Imprevisto", "Não vou conseguir chegar", "Marquei errado", "Vou remarcar depois"];

const todaySP = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());
function dayLabel(day: string) {
  const d = new Date(day + "T12:00:00Z");
  const base = `${DOW[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
  return day === todaySP() ? `Hoje · ${base}` : base.charAt(0).toUpperCase() + base.slice(1);
}
const hoursUntil = (a: Appointment) => (new Date(`${a.date}T${a.startTime}:00-03:00`).getTime() - Date.now()) / 3_600_000;
const brl = (v: number) => formatCurrency(v).replace(",00", "");
const waLink = (phone: string | null, text: string) => {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? `https://wa.me/${d.startsWith("55") ? d : `55${d}`}?text=${encodeURIComponent(text)}` : null;
};

type View = "phone" | "list" | "cancel" | "cancelled";

/** Meus horários (docs/design/Cancelar-agendamento-celular.dc.html): ver, remarcar ou cancelar. */
export default function MeusHorariosPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [shop, setShop] = useState<ShopRules | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [view, setView] = useState<View>("phone");
  const [target, setTarget] = useState<Appointment | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const firstName = clientName.split(" ")[0];

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/booking/${slug}/meus-agendamentos?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erro ao buscar seus horários."); return; }
      setClientName(data.clientName || "");
      setShop(data.shop ?? null);
      setAppointments(data.appointments ?? []);
      setView("list");
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function canChange(a: Appointment) {
    if (!shop?.cancelByClientEnabled) return false;
    return shop.minCancelHours <= 0 || hoursUntil(a) >= shop.minCancelHours;
  }

  async function cancel() {
    if (!target) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/v1/barbershops/${slug}/appointments/${target.id}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Não foi possível cancelar."); return; }
      setAppointments((cur) => cur.filter((a) => a.id !== target.id));
      setView("cancelled");
    } finally {
      setLoading(false);
    }
  }

  /** Remarcar: escolhe o novo horário no link; o antigo só é cancelado depois que o novo for marcado. */
  function reschedule(a: Appointment) {
    try {
      sessionStorage.setItem("remarcar", JSON.stringify({ id: a.id, slug, serviceIds: a.serviceIds, barberId: a.barberId, phone, when: `${dayLabel(a.date)}, ${a.startTime}` }));
    } catch { /* sem armazenamento: segue como agendamento novo */ }
    router.push(`/agendar/${slug}?remarcar=1`);
  }

  const contact = waLink(shop?.phone ?? null, `Olá! Aqui é ${clientName || "um cliente"}. Preciso falar sobre o meu horário.`);
  const limitText = shop && shop.minCancelHours > 0 ? `até ${shop.minCancelHours} ${shop.minCancelHours === 1 ? "hora" : "horas"} antes do horário` : "até o horário";

  return (
    <div className="min-h-screen bg-ground text-ink">
      <main className="max-w-md mx-auto px-4 pt-3 pb-10 flex flex-col gap-4">
        <div className="flex items-center gap-2.5 h-12">
          <Link href={`/agendar/${slug}`} aria-label="Voltar para o agendamento"
            className="w-11 h-11 rounded-[10px] border border-control bg-surface inline-flex items-center justify-center hover:bg-surface-3">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="flex-1 text-[15px] font-semibold truncate">{shop?.name ?? "Agendamento"}</span>
        </div>

        {view === "phone" && (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-[26px] font-bold">Meus horários</h1>
              <p className="text-sm text-ink-3">Veja, remarque ou cancele o que você marcou.</p>
            </div>
            <form onSubmit={search} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="wpp" className="text-sm font-semibold">Seu WhatsApp</label>
                <input id="wpp" type="tel" inputMode="tel" autoComplete="tel" required value={phone}
                  onChange={(e) => setPhone(e.target.value)} placeholder="(41) 99999-9999"
                  className="h-[52px] px-3.5 rounded-xl border-2 border-ink bg-surface text-[17px] outline-none" />
                <span className="text-xs text-ink-3">O mesmo número que você usou para agendar.</span>
              </div>
              {error && <p className="text-sm text-danger" role="alert">{error}</p>}
              <button type="submit" disabled={loading || phone.replace(/\D/g, "").length < 10}
                className="h-[52px] rounded-xl bg-primary text-white text-base font-semibold disabled:opacity-40">
                {loading ? "Buscando…" : "Buscar meus horários"}
              </button>
            </form>
          </>
        )}

        {view === "list" && (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h1 className="font-display text-[26px] font-bold">{firstName ? `Olá, ${firstName}` : "Seus horários"}</h1>
                <p className="text-sm text-ink-3">
                  {appointments.length === 0 ? "Nenhum horário marcado." : `${appointments.length} ${appointments.length === 1 ? "horário marcado" : "horários marcados"} · ${phone}`}
                </p>
              </div>
              <button type="button" onClick={() => { setView("phone"); setAppointments([]); setClientName(""); }}
                className="h-9 px-3 rounded-lg text-[13px] font-semibold text-ink-2 underline underline-offset-2 shrink-0">Não é você?</button>
            </div>

            {appointments.length === 0 ? (
              <div className="bg-surface border border-line rounded-[14px] p-6 text-center flex flex-col gap-3 items-center">
                <Clock className="w-8 h-8 text-ink-4" aria-hidden />
                <p className="text-sm text-ink-2">Você não tem horários futuros nesta barbearia.</p>
                <Link href={`/agendar/${slug}`} className="h-12 px-5 rounded-xl bg-primary text-white text-sm font-semibold inline-flex items-center">Marcar um horário</Link>
              </div>
            ) : appointments.map((a) => {
              const ok = canChange(a);
              return (
                <section key={a.id} className="bg-surface border border-line rounded-2xl overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-dashed border-[#D8D0C2]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-semibold tracking-[0.04em] uppercase text-ink-3">{dayLabel(a.date)}</span>
                      <span className="font-display text-[32px] font-bold leading-tight">{a.startTime}</span>
                    </div>
                    <span className={cn("h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center",
                      a.status === "CONFIRMED" ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning")}>
                      {a.status === "CONFIRMED" ? "Confirmado" : "Aguardando confirmação"}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between gap-3 text-[15px]">
                    <span><strong className="font-semibold">{a.serviceName}</strong> <span className="text-ink-3">com {a.barberName.split(" ")[0]}</span></span>
                    <span className="font-semibold shrink-0">{brl(a.price)}</span>
                  </div>
                  {ok ? (
                    <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => reschedule(a)}
                        className="h-12 rounded-xl border border-control bg-surface text-[15px] font-semibold hover:bg-surface-3">Remarcar</button>
                      <button type="button" onClick={() => { setTarget(a); setReason(null); setError(""); setView("cancel"); }}
                        className="h-12 rounded-xl border border-[#F2C9C4] bg-surface text-danger-strong text-[15px] font-semibold hover:bg-danger-soft">Cancelar</button>
                    </div>
                  ) : (
                    <div className="px-4 pb-4 flex flex-col gap-2.5">
                      <p className="flex items-start gap-2 text-[13px] text-warning bg-warning-soft rounded-[10px] px-3 py-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
                        {shop?.cancelByClientEnabled
                          ? `Faltam menos de ${shop.minCancelHours} ${shop.minCancelHours === 1 ? "hora" : "horas"}, então não dá mais para mudar por aqui. Se precisar, fale direto com a barbearia.`
                          : "Para remarcar ou cancelar, fale direto com a barbearia."}
                      </p>
                      {contact && (
                        <a href={contact} target="_blank" rel="noreferrer"
                          className="h-12 rounded-xl bg-[#1F9D5A] text-white text-[15px] font-semibold inline-flex items-center justify-center gap-2">
                          <MessageCircle className="w-[18px] h-[18px]" aria-hidden /> Chamar a barbearia no WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </section>
              );
            })}

            {shop?.cancelByClientEnabled && appointments.length > 0 && (
              <p className="text-[13px] text-ink-3 leading-relaxed">
                Dá para remarcar ou cancelar por aqui {limitText}. Pagamento é feito só na barbearia.
              </p>
            )}
          </>
        )}

        {view === "cancel" && target && (
          <>
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-[26px] font-bold">Cancelar horário</h1>
              <p className="text-sm text-ink-2">{dayLabel(target.date)}, {target.startTime} · {target.serviceName} com {target.barberName.split(" ")[0]}</p>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Por que vai desmarcar? <span className="font-normal text-ink-3">opcional</span></span>
              <div role="radiogroup" aria-label="Motivo" className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(reason === r ? null : r)}
                    className={cn("h-10 px-3.5 rounded-full text-[13px] font-semibold",
                      reason === r ? "bg-ink text-white" : "bg-surface border border-control text-ink-2")}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-surface border border-line">
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-sm font-semibold">Só precisa trocar o dia?</span>
                <span className="text-[13px] text-ink-3">Remarque e continue com {target.barberName.split(" ")[0]}.</span>
              </span>
              <button type="button" onClick={() => reschedule(target)} className="h-10 px-3.5 rounded-[10px] bg-ink text-white text-[13px] font-semibold shrink-0">Remarcar</button>
            </div>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setView("list")} className="h-[52px] rounded-xl border border-control bg-surface text-[15px] font-semibold">Manter horário</button>
              <button type="button" onClick={cancel} disabled={loading}
                className="h-[52px] rounded-xl bg-danger-strong text-white text-[15px] font-semibold disabled:opacity-50">
                {loading ? "Cancelando…" : "Cancelar horário"}
              </button>
            </div>
          </>
        )}

        {view === "cancelled" && target && (
          <>
            <div className="flex flex-col items-center gap-3 text-center pt-6">
              <div className="w-[68px] h-[68px] rounded-full bg-surface-2 text-ink-2 flex items-center justify-center"><Check className="w-8 h-8" aria-hidden /></div>
              <h1 className="font-display text-[26px] font-bold">Horário cancelado</h1>
              <p className="text-[15px] text-ink-2">Obrigado por avisar{firstName ? `, ${firstName}` : ""}. Assim a vaga fica livre para outro cliente.</p>
            </div>
            <section className="bg-surface border border-line rounded-2xl px-4 py-3.5 flex flex-col gap-1">
              <span className="text-[13px] text-ink-3">{dayLabel(target.date)}</span>
              <span className="flex items-center justify-between gap-3">
                <span className="font-display text-2xl font-bold line-through text-ink-3">{target.startTime}</span>
                <span className="h-6 px-2.5 rounded-full bg-surface-2 text-ink-2 text-xs font-semibold inline-flex items-center">Cancelado</span>
              </span>
              <span className="text-sm text-ink-2">{target.serviceName} com {target.barberName.split(" ")[0]} · {brl(target.price)}</span>
            </section>
            <p className="text-[13px] text-ink-3 text-center">A barbearia já foi avisada.</p>
            {appointments.length > 0 && (
              <p className="text-sm text-ink-2 text-center">
                Seu horário de {dayLabel(appointments[0].date).toLowerCase()} às {appointments[0].startTime} continua marcado.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Link href={`/agendar/${slug}`} className="h-[52px] rounded-xl bg-primary text-white text-[15px] font-semibold inline-flex items-center justify-center">Marcar outro horário</Link>
              <button type="button" onClick={() => setView("list")} className="h-11 text-[15px] font-semibold text-ink-2 underline underline-offset-2">Ver meus horários</button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
