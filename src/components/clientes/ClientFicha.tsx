"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, MessageCircle, Phone, Crown, CalendarClock, ChevronLeft } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditarClienteModal, OferecerPlanoModal } from "./ClienteModals";
import {
  type Ficha, LAPSED, PAYMENT_LABELS, birthdayLabel, comebackMessage, dayMonth, dayMonthShort,
  formatPhone, monthYear, waLink,
} from "./types";

const money = (v: number) => formatCurrency(v).replace(",00", "");

/** Link da agenda que já abre o "Novo agendamento" com o cliente e o de sempre. */
export function agendarHref(f: Ficha) {
  const p = new URLSearchParams({ novo: "1", cliente: f.client.name, tel: f.client.phone ?? "" });
  if (f.preferred) {
    p.set("barbeiro", f.preferred.barberId);
    if (f.preferred.serviceIds.length) p.set("servicos", f.preferred.serviceIds.join(","));
  }
  return `/painel/agendamentos?${p.toString()}`;
}

/**
 * Ficha do cliente. `panel` = coluna ao lado da lista no computador (Clientes-desktop);
 * `page` = tela inteira no celular (Ficha-cliente-celular).
 */
export default function ClientFicha({ id, variant, onChanged, onDeleted, backHref }: {
  id: string;
  variant: "panel" | "page";
  /** Algo mudou (dados, bloqueio, assinatura) — a lista recarrega. */
  onChanged?: () => void;
  onDeleted?: () => void;
  /** Só no celular: para onde volta a seta do topo. */
  backHref?: string;
}) {
  const { token, user } = useAuthStore();
  const isOwner = user?.role === "OWNER";
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [offering, setOffering] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/barbershop/clientes/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "Não foi possível abrir a ficha."); return; }
    setFicha(d);
    setError(null);
    setMessage(comebackMessage({ name: d.client.name, shopName: d.shop?.name, barberName: d.preferred?.barberName, slug: d.shop?.slug }));
  }, [id, token]);

  // O painel troca de cliente remontando (key), então aqui só carrega.
  useEffect(() => { load(); }, [load]);

  const changed = () => { load(); onChanged?.(); };

  async function toggleBlock() {
    if (!ficha) return;
    await fetch(`/api/barbershop/clientes/${ficha.client.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isBlocked: !ficha.client.isBlocked }),
    });
    setConfirmBlock(false);
    changed();
  }

  async function remove() {
    if (!ficha) return;
    const r = await fetch(`/api/barbershop/clientes/${ficha.client.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    setConfirmDelete(false);
    if (r.ok) { setEditing(false); onDeleted?.(); }
  }

  if (error) return <p className="p-6 text-sm text-ink-3">{error}</p>;
  if (!ficha) {
    return (
      <div className="p-5 space-y-3 animate-pulse" aria-busy>
        <div className="flex gap-3 items-center"><div className="w-[52px] h-[52px] rounded-full bg-surface-2" /><div className="h-5 w-40 rounded bg-surface-2" /></div>
        <div className="h-24 rounded-xl bg-surface-2" />
        <div className="h-32 rounded-xl bg-surface-2" />
      </div>
    );
  }

  const { client, stats, rhythm, preferred, subscription, note, upcoming, history } = ficha;
  const isPage = variant === "page";
  const visibleHistory = showAll ? history : history.slice(0, isPage ? 5 : 3);
  const next = upcoming[0];

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Prefere", value: preferred ? [preferred.barberName, preferred.services].filter(Boolean).join(" · ") : "—" },
    { label: "Aniversário", value: birthdayLabel(client.birthday) ?? <button type="button" onClick={() => setEditing(true)} className="font-semibold text-ink-3 underline underline-offset-2">Adicionar</button> },
    {
      label: "Assinatura",
      value: subscription ? (
        <span className="inline-flex items-center gap-1.5">
          <Crown className="w-3.5 h-3.5 text-primary" aria-hidden />
          {subscription.planName}
          {subscription.status !== "ACTIVE" && <span className="text-danger">· {subscription.status === "OVERDUE" ? "em atraso" : "pausada"}</span>}
        </span>
      ) : isOwner ? (
        <button type="button" onClick={() => setOffering(true)} className="font-semibold text-primary underline-offset-2 hover:underline">Oferecer plano</button>
      ) : "—",
    },
  ];

  return (
    <div className={cn("flex flex-col", isPage ? "gap-4" : "h-full")}>
      {isPage && (
        <div className="flex items-center justify-between">
          <Link href={backHref ?? "/painel/clientes"} aria-label="Voltar para clientes"
            className="w-11 h-11 rounded-xl border border-line bg-surface flex items-center justify-center">
            <ChevronLeft className="w-5 h-5" aria-hidden />
          </Link>
          <button type="button" onClick={() => setEditing(true)} className="h-11 px-4 rounded-xl border border-line bg-surface text-sm font-semibold">
            Editar
          </button>
        </div>
      )}
      {/* Cabeçalho */}
      <div className={cn("flex gap-3", isPage ? "flex-col items-center text-center pt-1" : "items-start px-5 pt-[18px] pb-3.5")}>
        <div className={cn("rounded-full bg-surface-2 text-ink-2 font-bold flex items-center justify-center shrink-0",
          isPage ? "w-16 h-16 text-xl" : "w-[52px] h-[52px] text-[17px]")}>
          {getInitials(client.name)}
        </div>
        <div className="min-w-0 flex-1 flex flex-col gap-[3px]">
          <h2 className={cn("font-display font-bold tracking-[-0.01em] break-words", isPage ? "text-2xl" : "text-[21px]")}>{client.name}</h2>
          <span className="text-[13px] text-ink-3">
            {[formatPhone(client.phone), `cliente desde ${monthYear(client.since)}`].filter(Boolean).join(" · ")}
          </span>
          {client.isBlocked && <span className="self-start mt-1 h-6 px-2.5 rounded-full bg-surface-2 text-ink-2 text-xs font-semibold inline-flex items-center">Bloqueado</span>}
        </div>
      </div>

      {/* Ações rápidas (celular) */}
      {isPage && (
        <div className="grid grid-cols-3 gap-2">
          {client.phone ? (
            <a href={waLink(client.phone)} target="_blank" rel="noreferrer" className="h-14 rounded-xl border border-line bg-surface flex flex-col items-center justify-center gap-0.5 text-xs font-semibold">
              <MessageCircle className="w-[18px] h-[18px]" aria-hidden /> WhatsApp
            </a>
          ) : <span />}
          {client.phone ? (
            <a href={`tel:${client.phone.replace(/\D/g, "")}`} className="h-14 rounded-xl border border-line bg-surface flex flex-col items-center justify-center gap-0.5 text-xs font-semibold">
              <Phone className="w-[18px] h-[18px]" aria-hidden /> Ligar
            </a>
          ) : <span />}
          <Link href={agendarHref(ficha)} className="h-14 rounded-xl bg-primary text-white flex flex-col items-center justify-center gap-0.5 text-xs font-semibold">
            <CalendarPlus className="w-[18px] h-[18px]" aria-hidden /> Agendar
          </Link>
        </div>
      )}

      <div className={cn("flex flex-col gap-4", !isPage && "flex-1 overflow-y-auto pb-4")}>
        {/* Sumido: chamar de volta */}
        {rhythm.lapsed && (
          <div className={cn("rounded-xl border p-3.5 flex flex-col gap-2", LAPSED.bg, LAPSED.border, !isPage && "mx-5")}>
            <span className={cn("text-sm font-semibold", LAPSED.text)}>
              Sumido há {rhythm.overdueDays} {rhythm.overdueDays === 1 ? "dia" : "dias"} além do normal
            </span>
            <span className={cn("text-[13px]", LAPSED.text)}>
              {rhythm.avgFrequency ? `Costuma voltar a cada ${rhythm.avgFrequency} dias.` : "Veio uma vez só."}
              {rhythm.lastVisit && ` Última visita: ${dayMonth(rhythm.lastVisit.date)}, com ${rhythm.lastVisit.barberName}.`}
            </span>
            {client.phone && (
              <>
                <label htmlFor={`msg-${client.id}`} className="sr-only">Mensagem</label>
                <textarea id={`msg-${client.id}`} value={message} onChange={(e) => setMessage(e.target.value)} rows={isPage ? 4 : 3}
                  className="w-full rounded-[10px] border border-[#F3D3BD] bg-surface/70 px-3 py-2.5 text-[13px] text-ink resize-none focus:outline-none focus:border-ink-4" />
                <a href={waLink(client.phone, message)} target="_blank" rel="noreferrer"
                  className="h-10 rounded-[9px] bg-ink text-white text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-ink/90">
                  <MessageCircle className="w-[15px] h-[15px]" aria-hidden /> {isPage ? "Enviar mensagem" : "Chamar de volta pelo WhatsApp"}
                </a>
              </>
            )}
            {ficha.lastRetentionAt && (
              <span className={cn("text-xs", LAPSED.text)}>A mensagem automática de retorno foi enviada em {new Date(ficha.lastRetentionAt).toLocaleDateString("pt-BR")}.</span>
            )}
          </div>
        )}

        {/* Próximo horário */}
        {next && (
          <div className={cn("rounded-xl border border-line bg-surface-3/50 px-3.5 py-3 flex items-center gap-3", !isPage && "mx-5")}>
            <CalendarClock className="w-5 h-5 text-ink-3 shrink-0" aria-hidden />
            <div className="min-w-0 text-[13px]">
              <p className="font-semibold">Marcado: {dayMonth(next.date)}, {next.startTime}</p>
              <p className="text-ink-3 truncate">{next.services} · {next.barberName}</p>
            </div>
          </div>
        )}

        {/* Números */}
        <div className={cn("grid grid-cols-2 gap-px rounded-xl overflow-hidden bg-line-2 border border-line-2", !isPage && "mx-5")}>
          {[
            ["Visitas", String(stats.visits)],
            ["Gastou no total", money(stats.spent)],
            ["Ticket médio", stats.visits ? money(Math.round(stats.avgTicket)) : "—"],
            ["Faltas", String(stats.noShows)],
          ].map(([l, v]) => (
            <div key={l} className="bg-surface p-3 flex flex-col gap-0.5">
              <span className="text-xs text-ink-3">{l}</span>
              <span className={cn("text-lg font-bold", l === "Faltas" && stats.noShows >= 2 && "text-danger")}>{v}</span>
            </div>
          ))}
        </div>

        {/* Preferências */}
        <div className={cn("flex flex-col", isPage ? "bg-surface rounded-xl border border-line px-3.5" : "px-5")}>
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between items-center gap-3 min-h-9 py-1.5 text-sm border-b border-line-3">
              <span className="text-ink-3 shrink-0">{r.label}</span>
              <span className="font-semibold text-right min-w-0">{r.value}</span>
            </div>
          ))}
          <div className="flex flex-col gap-1 py-2.5 text-sm last:border-0">
            <div className="flex justify-between gap-3">
              <span className="text-ink-3">Observações</span>
              <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-semibold text-ink-3 underline underline-offset-2">
                {note ? "Editar" : "Adicionar"}
              </button>
            </div>
            {note && <p className="text-ink whitespace-pre-line">{note.content}</p>}
          </div>
        </div>

        {/* Histórico */}
        <div className={cn("flex flex-col gap-2", !isPage && "px-5")}>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Histórico</span>
            {isPage && <span className="text-[13px] text-ink-3">{stats.visits} {stats.visits === 1 ? "visita" : "visitas"}</span>}
          </div>
          {history.length === 0 ? (
            <p className="text-[13px] text-ink-3">Ainda não veio.</p>
          ) : isPage ? (
            <ul className="bg-surface rounded-xl border border-line divide-y divide-line-3">
              {visibleHistory.map((h) => {
                const d = dayMonthShort(h.date);
                return (
                  <li key={h.id} className="flex items-center gap-3 px-3.5 py-3">
                    <div className="w-11 h-11 rounded-[10px] bg-surface-3 flex flex-col items-center justify-center shrink-0 leading-none">
                      <span className="text-[15px] font-bold">{d.day}</span>
                      <span className="text-[11px] text-ink-3 mt-0.5">{d.month}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{h.services}</p>
                      <p className="text-xs text-ink-3 truncate">
                        {h.barberName}{h.status === "DONE" && h.paymentMethod && !h.viaPlan ? ` · ${PAYMENT_LABELS[h.paymentMethod] ?? h.paymentMethod}` : ""}
                      </p>
                    </div>
                    <HistoryValue h={h} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col gap-2">
              {visibleHistory.map((h) => {
                const d = dayMonthShort(h.date);
                return (
                  <div key={h.id} className="flex justify-between gap-3 text-[13px]">
                    <span className="truncate">{d.day} {d.month} · {h.services} · {h.barberName}</span>
                    <HistoryValue h={h} />
                  </div>
                );
              })}
            </div>
          )}
          {history.length > visibleHistory.length && (
            <button type="button" onClick={() => setShowAll(true)} className="self-start text-[13px] font-semibold text-ink-2 underline-offset-2 hover:underline">
              Ver o histórico todo ({history.length})
            </button>
          )}
        </div>

        {isPage && (
          <button type="button" onClick={() => (client.isBlocked ? toggleBlock() : setConfirmBlock(true))}
            className={cn("h-11 text-sm font-semibold", client.isBlocked ? "text-ink-2" : "text-danger")}>
            {client.isBlocked ? "Desbloquear cliente" : "Bloquear cliente"}
          </button>
        )}
      </div>

      {/* Rodapé do painel (computador) */}
      {!isPage && (
        <div className="mt-auto grid grid-cols-[1.4fr_1fr] gap-2 px-5 pt-3.5 pb-[18px] border-t border-line-2">
          <Link href={agendarHref(ficha)} className="h-11 rounded-[10px] bg-primary text-white text-sm font-semibold flex items-center justify-center hover:bg-primary/90">
            Agendar horário
          </Link>
          <button type="button" onClick={() => setEditing(true)} className="h-11 rounded-[10px] border border-control bg-surface text-sm font-semibold hover:bg-surface-3">
            Editar dados
          </button>
        </div>
      )}

      {editing && (
        <EditarClienteModal ficha={ficha} onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); changed(); }}
          onDelete={isOwner ? () => setConfirmDelete(true) : undefined} />
      )}
      {offering && <OferecerPlanoModal ficha={ficha} onClose={() => setOffering(false)} onDone={() => { setOffering(false); changed(); }} />}
      <ConfirmDialog isOpen={confirmDelete} title="Excluir cliente?"
        message="Os horários marcados e a assinatura dele aqui são cancelados. O histórico de atendimentos e pagamentos fica guardado."
        confirmLabel="Excluir" onConfirm={remove} onCancel={() => setConfirmDelete(false)} />
      <ConfirmDialog isOpen={confirmBlock} title={`Bloquear ${client.name.split(" ")[0]}?`}
        message="O atendente do WhatsApp deixa de marcar horário para ele. Dá para desbloquear quando quiser."
        confirmLabel="Bloquear" onConfirm={toggleBlock} onCancel={() => setConfirmBlock(false)} />
    </div>
  );
}

function HistoryValue({ h }: { h: Ficha["history"][number] }) {
  if (h.status === "NO_SHOW") return <span className="text-[13px] font-semibold text-danger shrink-0">faltou</span>;
  if (h.viaPlan && h.price === 0) return <span className="text-[13px] font-semibold text-ink-3 shrink-0">plano</span>;
  return <span className="text-[13px] font-semibold shrink-0">{money(h.price)}</span>;
}
