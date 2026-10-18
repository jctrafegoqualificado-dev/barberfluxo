"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, MessageCircle, Search, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import { Segmented } from "@/components/catalogo/SidePanel";

interface Cliente {
  id: string; name: string; phone: string | null;
  totalVisits: number; thisMonthVisits: number; lastVisit: string | null; daysSinceLastVisit: number | null;
  expectedInterval: number | null; lapsed: boolean; overdueDays: number; hasUpcoming: boolean;
  activePlan: string | null; preferredBarber: string | null; isNew: boolean;
  visitsWithMe?: number; mine?: boolean;
}
type Tab = "mine" | "lapsed" | "all";

const ago = (d: number | null) => (d == null ? "nunca veio" : d === 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`);
const wa = (phone: string | null, text: string) => {
  const p = phone?.replace(/\D/g, "");
  return p ? `https://wa.me/${p.startsWith("55") ? p : "55" + p}?text=${encodeURIComponent(text)}` : null;
};

export default function BarbeiroClientesPage() {
  const { token } = useAuthStore();
  const [list, setList] = useState<Cliente[] | null>(null);
  const [tab, setTab] = useState<Tab>("mine");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(30);

  useEffect(() => {
    fetch("/api/barbershop/clientes", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((d) => setList(d.clientes || [])).catch(() => setList([]));
  }, [token]);

  const all = useMemo(() => list ?? [], [list]);
  const mine = all.filter((c) => (c.visitsWithMe ?? 0) > 0);
  // Só quem é cliente dele hoje (o profissional que mais o atende) — igual ao Início
  const lapsed = mine.filter((c) => c.lapsed && c.mine).sort((a, b) => b.overdueDays - a.overdueDays);
  const base = tab === "mine" ? mine : tab === "lapsed" ? lapsed : all;
  const q = search.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = base.filter((c) => !q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && (c.phone ?? "").includes(digits)));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Clientes</h1>
          <span className="text-sm text-ink-3">{list ? `${mine.length} já atendidos por você · ${lapsed.length} passaram do tempo de voltar` : " "}</span>
        </div>
      </header>

      <section aria-label="Clientes" className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-b border-line-2">
          <Segmented value={tab} onChange={(v) => { setTab(v); setShown(30); }} label="Quais clientes"
            options={[["mine", `Meus · ${mine.length}`], ["lapsed", `Para chamar · ${lapsed.length}`], ["all", `Todos · ${all.length}`]]} />
          <label className="flex items-center gap-2 h-10 px-3 rounded-[10px] border border-control bg-ground w-full sm:w-64">
            <Search className="w-4 h-4 text-ink-3 shrink-0" aria-hidden />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou telefone" aria-label="Buscar cliente" className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
          </label>
        </div>

        {!list ? <div className="h-64 animate-pulse bg-surface-3/50" aria-busy /> : visible.length === 0 ? (
          <div className="px-6 py-12 flex flex-col items-center gap-2 text-center">
            <Users className="w-9 h-9 text-ink-4" aria-hidden />
            <p className="font-semibold">{q ? "Ninguém encontrado" : tab === "lapsed" ? "Ninguém sumido" : "Nenhum cliente aqui"}</p>
            {tab === "lapsed" && !q && <p className="text-[13px] text-ink-3">Seus clientes estão voltando no ritmo de sempre.</p>}
          </div>
        ) : (
          <div className="divide-y divide-line-3">
            {visible.slice(0, shown).map((c) => {
              const first = c.name.split(" ")[0];
              const call = c.lapsed ? wa(c.phone, `Oi, ${first}! Tudo bem? Já faz um tempinho desde o último corte. Quer que eu reserve um horário para você esta semana?`) : null;
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 min-h-[64px] py-2.5">
                  <div className={cn("w-10 h-10 rounded-full text-xs font-bold flex items-center justify-center shrink-0", c.mine ? "bg-primary/10 text-primary" : "bg-surface-2 text-ink-2")}>{getInitials(c.name)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                      <span className="truncate">{c.name}</span>
                      {c.activePlan && <span className="h-5 px-2 rounded-full bg-primary/10 text-primary text-[11px] font-semibold inline-flex items-center shrink-0">{c.activePlan}</span>}
                    </p>
                    <p className="text-xs text-ink-3 truncate">
                      {(c.visitsWithMe ?? 0) > 0 ? `${c.visitsWithMe} visita${c.visitsWithMe === 1 ? "" : "s"} com você` : c.preferredBarber ? `cliente do ${c.preferredBarber}` : "ainda não veio"}
                      {c.expectedInterval ? ` · vem a cada ${c.expectedInterval} dias` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 hidden sm:block">
                    <p className={cn("text-[13px] font-semibold", c.lapsed ? "text-danger" : "text-ink")}>{ago(c.daysSinceLastVisit)}</p>
                    <p className="text-xs text-ink-3">{c.hasUpcoming ? "tem horário marcado" : c.lapsed ? `${c.overdueDays} dias atrasado` : "última visita"}</p>
                  </div>
                  {call ? (
                    <a href={call} target="_blank" rel="noreferrer" aria-label={`Chamar ${c.name} no WhatsApp`} className="h-9 px-3 rounded-[9px] bg-ink text-white text-[13px] font-semibold inline-flex items-center gap-1.5 shrink-0"><MessageCircle className="w-4 h-4" aria-hidden /><span className="hidden sm:inline">Chamar</span></a>
                  ) : (
                    <Link href={`/barbeiro/agenda?novo=1&cliente=${encodeURIComponent(c.name)}&tel=${encodeURIComponent(c.phone ?? "")}`} aria-label={`Agendar ${c.name}`}
                      className="h-9 w-9 sm:w-auto sm:px-3 rounded-[9px] border border-control text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 shrink-0"><CalendarPlus className="w-4 h-4" aria-hidden /><span className="hidden sm:inline">Agendar</span></Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {visible.length > shown && (
          <button type="button" onClick={() => setShown((n) => n + 30)} className="w-full h-11 border-t border-line-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-3">Mostrar mais ({visible.length - shown})</button>
        )}
      </section>
    </div>
  );
}
