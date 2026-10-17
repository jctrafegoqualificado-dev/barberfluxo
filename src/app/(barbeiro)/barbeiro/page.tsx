"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Cake, MessageCircle, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency } from "@/lib/utils";
import RecadosEquipeCard from "@/components/recados/RecadosEquipeCard";

interface Inicio {
  name: string; today: string; nowMin: number; isOpen: boolean;
  next: {
    id: string; startTime: string; endTime: string; status: string; arrived: boolean; minutesUntil: number;
    client: { id: string; name: string; phone: string | null }; services: string; price: number; notes: string | null; birthday: string | null;
  } | null;
  day: { total: number; done: number; open: number; noShow: number; earned: number; projected: number };
  unclosed: { id: string; startTime: string; name: string }[];
  free: { start: string; end: string; minutes: number; fits: number }[];
  freeMinutes: number;
  meta: { target: number | null; revenue: number; daysLeft: number; perDay: number | null; scheduledWeek: number; month: string };
  week: { date: string; real: number; sched: number; last: number }[];
  reviews: { count: number; avg: number | null; shopAvg: number | null; comments: { client: string; rating: number; comment: string | null; at: string }[] };
  comeback: { clientId: string; name: string; phone: string | null; note: string }[];
  birthdays: { clientId: string; name: string; phone: string | null; date: string; inDays: number; visits: number }[];
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEK_LONG = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const brl = (v: number) => formatCurrency(v).replace(",00", "");
const dow = (k: string) => new Date(`${k}T12:00:00Z`).getUTCDay();
const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`);
const wa = (phone: string | null, text: string) => {
  const p = phone?.replace(/\D/g, "");
  return p ? `https://wa.me/${p.startsWith("55") ? p : "55" + p}?text=${encodeURIComponent(text)}` : null;
};
const card = "bg-surface border border-line rounded-2xl";
const kicker = "text-xs font-semibold tracking-[0.06em] uppercase text-ink-3";

function untilText(min: number) {
  if (min <= 0) return "agora";
  if (min < 60) return `em ${min} min`;
  return `em ${hm(min)}`;
}

export default function InicioBarbeiroPage() {
  const { token } = useAuthStore();
  const [d, setD] = useState<Inicio | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/barber/inicio", { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { setError(data.error ?? "Não foi possível carregar."); return; }
    setD(data);
  }, [token]);
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // "em 12 min" e o próximo cliente andam sozinhos
    return () => clearInterval(t);
  }, [load]);

  async function arrived() {
    if (!d?.next) return;
    const r = await fetch("/api/barbershop/appointments", {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: d.next.id, arrived: !d.next.arrived }),
    });
    if (!r.ok) { toast.error("Não deu certo. Tente de novo."); return; }
    load();
  }

  if (error) return <p className="text-sm text-danger bg-danger-soft rounded-xl px-4 py-3">{error}</p>;
  if (!d) return <div className="flex flex-col gap-4"><div className="h-16 w-64 rounded-xl bg-surface-3/60 animate-pulse" /><div className="grid lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-44 rounded-2xl bg-surface-3/60 animate-pulse" />)}</div></div>;

  const first = d.name.split(" ")[0];
  const hour = Math.floor(d.nowMin / 60);
  const hello = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const [, m, day] = d.today.split("-").map(Number);
  const monthName = MONTHS[Number(d.meta.month.slice(5, 7)) - 1];
  const earnedPct = d.day.projected > 0 ? (d.day.earned / d.day.projected) * 100 : 0;
  const metaPct = d.meta.target ? Math.min(100, (d.meta.revenue / d.meta.target) * 100) : 0;
  const schedPct = d.meta.target ? Math.min(100 - metaPct, (d.meta.scheduledWeek / d.meta.target) * 100) : 0;
  const week = d.week.filter((w, i) => i < 6 || w.real + w.sched + w.last > 0);
  const weekMax = Math.max(1, ...week.map((w) => Math.max(w.real + w.sched, w.last)));
  const next = d.next;

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-ink-3">{WEEK_LONG[dow(d.today)]}, {day} de {MONTHS[m - 1]}</span>
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">{hello}, {first}</h1>
        </div>
        <div className="hidden sm:flex gap-2">
          <Link href="/barbeiro/agenda" className="h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold inline-flex items-center hover:bg-surface-3">Minha agenda</Link>
          <Link href="/barbeiro/agenda?novo=1" className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90"><Plus className="w-4 h-4" aria-hidden />Novo agendamento</Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Próximo cliente */}
        <section aria-labelledby="prox-t" className={cn("rounded-2xl px-5 py-[18px] flex flex-col gap-2.5 bg-surface", next ? "border-2 border-primary" : d.unclosed.length ? "border-2 border-warning/50" : "border border-line")}>
          <div className="flex justify-between items-center gap-2">
            <h2 id="prox-t" className={kicker}>{!next && d.unclosed.length ? "Para fechar" : "Próximo cliente"}</h2>
            {next && <span className="h-6 px-2.5 rounded-full bg-primary/10 text-primary text-xs font-semibold inline-flex items-center">{next.arrived ? "já chegou" : untilText(next.minutesUntil)}</span>}
          </div>
          {next ? (
            <>
              <div className="flex items-baseline gap-3 min-w-0">
                <span className="font-display text-[28px] font-bold">{next.startTime}</span>
                <span className="font-display text-xl font-semibold truncate">{next.client.name}</span>
              </div>
              <span className="text-sm text-ink-2">
                {next.services} · {brl(next.price)}{next.notes ? ` · “${next.notes}”` : ""}{next.birthday ? ` · ${next.birthday}` : ""}
              </span>
              <div className="flex gap-2 mt-auto pt-1">
                <button type="button" onClick={arrived} aria-pressed={next.arrived}
                  className={cn("flex-1 h-[42px] rounded-[10px] border text-sm font-semibold", next.arrived ? "bg-positive-soft border-positive/30 text-positive" : "border-control bg-ground")}>
                  {next.arrived ? "Chegou ✓" : "Chegou"}
                </button>
                <Link href={`/barbeiro/agenda?comanda=${next.id}`} className="flex-1 h-[42px] rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center justify-center hover:bg-primary/90">Fechar comanda</Link>
                {next.client.phone && <a href={`tel:${next.client.phone}`} aria-label={`Ligar para ${next.client.name}`} className="w-[42px] h-[42px] rounded-[10px] border border-control inline-flex items-center justify-center shrink-0"><Phone className="w-4 h-4" aria-hidden /></a>}
              </div>
              {d.unclosed.length > 0 && (
                <Link href="/barbeiro/agenda" className="text-[13px] font-semibold text-warning underline underline-offset-2">
                  + {d.unclosed.length} horário{d.unclosed.length === 1 ? "" : "s"} de antes sem comanda
                </Link>
              )}
            </>
          ) : d.unclosed.length > 0 ? (
            <>
              <p className="font-display text-xl font-semibold">{d.unclosed.length} sem comanda</p>
              <p className="text-sm text-ink-2">Horários de hoje que já passaram e ainda estão abertos. Feche a comanda ou marque falta para o ganho do dia ficar certo.</p>
              <div className="flex flex-col gap-1">
                {d.unclosed.slice(0, 4).map((u) => (
                  <Link key={u.id} href={`/barbeiro/agenda?comanda=${u.id}`} className="flex justify-between gap-2 h-9 px-3 rounded-[9px] bg-ground hover:bg-surface-3 items-center text-sm">
                    <span className="truncate"><strong>{u.startTime}</strong> {u.name}</span><span className="text-xs font-semibold text-ink-2 shrink-0">Fechar</span>
                  </Link>
                ))}
              </div>
              {d.unclosed.length > 4 && <Link href="/barbeiro/agenda" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">Ver os {d.unclosed.length} na agenda</Link>}
            </>
          ) : (
            <>
              <p className="font-display text-xl font-semibold">{d.day.total ? "Ninguém mais hoje" : "Agenda livre hoje"}</p>
              <p className="text-sm text-ink-2">{d.day.total ? `${d.day.done} atendimento${d.day.done === 1 ? "" : "s"} feito${d.day.done === 1 ? "" : "s"}.` : "Nenhum horário marcado com você hoje."}</p>
              <Link href="/barbeiro/agenda?novo=1" className="mt-auto h-[42px] rounded-[10px] border border-control text-sm font-semibold inline-flex items-center justify-center gap-2"><Plus className="w-4 h-4" aria-hidden />Novo agendamento</Link>
            </>
          )}
        </section>

        {/* Ganhos de hoje */}
        <section aria-labelledby="ganhos-t" className="rounded-2xl bg-ink text-white px-5 py-[18px] flex flex-col gap-3.5">
          <div className="flex justify-between items-center gap-2">
            <h2 id="ganhos-t" className="text-xs font-semibold tracking-[0.06em] uppercase text-night-text">Seus ganhos hoje</h2>
            <span className="text-xs text-night-text">{d.day.done} feito{d.day.done === 1 ? "" : "s"} · {d.day.open} a atender</span>
          </div>
          <div className="flex items-end gap-6">
            <div className="flex flex-col gap-0.5"><span className="text-[13px] text-night-text">Já ganhou</span><span className="font-display text-[34px] font-bold leading-none">{brl(d.day.earned)}</span></div>
            <div className="flex flex-col gap-0.5 pb-0.5"><span className="text-[13px] text-night-text">Até o fim do dia</span><span className="font-display text-[22px] font-bold leading-none text-primary">{brl(d.day.projected)}</span></div>
          </div>
          <div className="flex h-2 gap-0.5 rounded overflow-hidden bg-night-3">
            <div className="bg-white" style={{ width: `${earnedPct}%` }} />
            {d.day.projected > d.day.earned && <div className="bg-primary" style={{ width: `${100 - earnedPct}%` }} />}
          </div>
          <Link href="/barbeiro/producao" className="text-[13px] font-semibold text-night-text underline underline-offset-2 self-start mt-auto">Ver ganhos do mês</Link>
        </section>

        {/* Horários livres */}
        <section aria-labelledby="livres-t" className={cn(card, "px-5 py-[18px] flex flex-col gap-2.5")}>
          <div className="flex justify-between items-center gap-2">
            <h2 id="livres-t" className={kicker}>Horários livres hoje</h2>
            {d.freeMinutes > 0 && <span className="text-xs text-ink-3">{hm(d.freeMinutes)} sem cliente</span>}
          </div>
          {!d.isOpen ? <p className="text-sm text-ink-2">A barbearia não abre hoje.</p> : d.free.length === 0 ? (
            <p className="text-sm text-ink-2">Agenda cheia até o fim do expediente.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {d.free.slice(0, 4).map((f) => (
                <Link key={f.start} href="/barbeiro/agenda?novo=1" className="flex items-center justify-between h-[38px] px-3 rounded-[10px] bg-ground hover:bg-surface-3">
                  <span className="text-[15px] font-semibold">{f.start} – {f.end}</span>
                  <span className="text-xs text-ink-3">{f.fits >= 2 ? `cabe ${f.fits} atendimentos` : "cabe 1 atendimento"}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
        {/* Meta e semana */}
        <section aria-labelledby="meta-t" className={cn(card, "px-5 md:px-[22px] py-5 flex flex-col gap-3.5")}>
          <div className="flex justify-between items-start gap-4">
            <div className="flex flex-col gap-1">
              <h2 id="meta-t" className="text-[15px] font-semibold">{d.meta.target ? `Sua meta de ${monthName}` : `Seu ${monthName}`}</h2>
              <span className="text-[13px] text-ink-3">{d.meta.daysLeft ? `Faltam ${d.meta.daysLeft} dia${d.meta.daysLeft === 1 ? "" : "s"} de trabalho` : "Último dia do mês"}</span>
            </div>
            <Link href="/barbeiro/producao" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">Ver ganhos</Link>
          </div>
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <span className="font-display text-[30px] md:text-[34px] font-bold tracking-[-0.02em]">{brl(d.meta.revenue)}</span>
            <span className="text-[15px] text-ink-2">{d.meta.target ? `de ${brl(d.meta.target)} · ${Math.round(metaPct)}%` : "em atendimentos concluídos"}</span>
          </div>
          {d.meta.target ? (
            <>
              <div className="relative h-3.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${metaPct}%` }} />
                <div className="absolute inset-y-0 bg-primary/40" style={{ left: `${metaPct}%`, width: `${schedPct}%` }} />
              </div>
              <span className="text-[13px] text-ink-2">
                {d.meta.revenue >= d.meta.target ? <>Meta batida! 🎉</> : d.meta.perDay != null ? <>Você precisa de <strong className="text-ink">{brl(d.meta.perDay)} por dia</strong> para bater a meta.</> : null}
                {d.meta.scheduledWeek > 0 && <> A agenda desta semana já garante <strong className="text-ink">{brl(d.meta.scheduledWeek)}</strong>.</>}
              </span>
            </>
          ) : (
            <span className="text-[13px] text-ink-3">O dono ainda não definiu uma meta para você.{d.meta.scheduledWeek > 0 && <> A agenda desta semana já tem <strong className="text-ink">{brl(d.meta.scheduledWeek)}</strong> marcados.</>}</span>
          )}

          <div className="flex flex-col gap-2.5 pt-3.5 border-t border-line-2">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold">Sua semana</span>
              <div className="flex gap-3.5 text-xs text-ink-2">
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-bar-soft" />Semana passada</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-ink" />Realizado</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-primary/40" />Agendado</span>
              </div>
            </div>
            <div className="flex gap-3 md:gap-5 h-[130px] items-end border-b border-line-2" role="img" aria-label="Faturamento por dia da semana">
              {week.map((w) => (
                <div key={w.date} title={`${WEEK[dow(w.date)]}: ${brl(w.real)} realizado${w.sched ? ` + ${brl(w.sched)} agendado` : ""} · semana passada ${brl(w.last)}`} className="flex-1 flex items-end gap-1 h-full">
                  <div className="flex-1 bg-bar-soft rounded-t" style={{ height: `${(w.last / weekMax) * 100}%` }} />
                  <div className="flex-1 flex flex-col justify-end h-full">
                    <div className="bg-primary/40 rounded-t" style={{ height: `${(w.sched / weekMax) * 100}%` }} />
                    <div className={cn("bg-ink", !w.sched && "rounded-t")} style={{ height: `${(w.real / weekMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 md:gap-5">
              {week.map((w) => (
                <div key={w.date} className="flex-1 flex flex-col items-center">
                  <span className={cn("text-xs", w.date === d.today ? "font-bold text-ink" : "text-ink-2")}>{w.date === d.today ? "Hoje" : WEEK[dow(w.date)]}</span>
                  <span className="text-[11px] text-ink-3">{w.real + w.sched ? brl(w.real + w.sched) : "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-4">
          <RecadosEquipeCard />
          <section aria-labelledby="aval-t" className={cn(card, "p-5 flex flex-col gap-3")}>
            <div className="flex justify-between items-baseline gap-2">
              <h2 id="aval-t" className="text-[15px] font-semibold">Suas avaliações</h2>
              <span className="text-[13px] text-ink-3">{d.reviews.count} no mês</span>
            </div>
            {d.reviews.avg == null ? <p className="text-sm text-ink-3">Nenhuma avaliação em {monthName} ainda.</p> : (
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[34px] font-bold">{d.reviews.avg.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}</span>
                <span className="text-[13px] text-ink-2">nota média{d.reviews.shopAvg != null ? ` · a barbearia tem ${d.reviews.shopAvg.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}` : ""}</span>
              </div>
            )}
            {d.reviews.comments.map((c, i) => (
              <div key={i} className="flex flex-col gap-1 pt-3 border-t border-line-3">
                <div className="flex justify-between text-xs text-ink-3"><span className="font-semibold text-ink">{c.client} · nota {c.rating}</span></div>
                <span className="text-sm text-ink-2">“{c.comment}”</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="voltar-t" className={cn(card, "p-5 flex flex-col")}>
          <div className="flex flex-col gap-0.5 pb-2">
            <h2 id="voltar-t" className="text-[15px] font-semibold">Clientes para chamar de volta</h2>
            <span className="text-[13px] text-ink-3">Passaram do tempo que costumam voltar</span>
          </div>
          {d.comeback.length === 0 ? <p className="text-sm text-ink-3 pt-1">Ninguém sumido. Seus clientes estão em dia.</p> : d.comeback.map((c) => {
            const link = wa(c.phone, `Oi, ${c.name.split(" ")[0]}! Tudo bem? Já faz um tempinho desde o último corte. Quer que eu reserve um horário para você esta semana?`);
            return (
              <div key={c.clientId} className="flex items-center gap-3 min-h-[52px] border-t border-line-3 py-1.5">
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{c.name}</p><p className="text-xs text-ink-3 truncate">{c.note}</p></div>
                {link && <a href={link} target="_blank" rel="noreferrer" aria-label={`Chamar ${c.name} no WhatsApp`} className="h-9 px-3 rounded-[9px] border border-control text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0"><MessageCircle className="w-4 h-4" aria-hidden />Chamar</a>}
              </div>
            );
          })}
        </section>

        <section aria-labelledby="niver-t" className={cn(card, "p-5 flex flex-col")}>
          <div className="flex flex-col gap-0.5 pb-2">
            <h2 id="niver-t" className="text-[15px] font-semibold">Seus clientes fazendo aniversário</h2>
            <span className="text-[13px] text-ink-3">Nos próximos 7 dias</span>
          </div>
          {d.birthdays.length === 0 ? <p className="text-sm text-ink-3 pt-1">Nenhum aniversário nos próximos dias.</p> : d.birthdays.map((b) => {
            const link = wa(b.phone, `Feliz aniversário, ${b.name.split(" ")[0]}! 🎉 Muitas felicidades. Passa aqui para dar aquele trato no visual!`);
            return (
              <div key={b.clientId} className="flex items-center gap-3 min-h-[52px] border-t border-line-3 py-1.5">
                <div className="w-10 h-10 rounded-[10px] bg-ground flex flex-col items-center justify-center shrink-0">
                  <span className="text-sm font-bold leading-none">{Number(b.date.slice(8))}</span>
                  <span className="text-[10px] font-semibold text-ink-3 uppercase">{MON[Number(b.date.slice(5, 7)) - 1]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{b.name}</p>
                  <p className="text-xs text-ink-3">{b.inDays === 0 ? "hoje" : b.inDays === 1 ? "amanhã" : `em ${b.inDays} dias`} · {b.visits} visita{b.visits === 1 ? "" : "s"} com você</p>
                </div>
                {link && <a href={link} target="_blank" rel="noreferrer" aria-label={`Dar parabéns a ${b.name} no WhatsApp`} className="h-9 px-3 rounded-[9px] border border-control text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0"><Cake className="w-4 h-4" aria-hidden />Parabéns</a>}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
