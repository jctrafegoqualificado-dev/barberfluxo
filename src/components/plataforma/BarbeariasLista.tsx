"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { fieldCls } from "@/components/catalogo/SidePanel";

export type Situacao = "em_dia" | "vence" | "carencia" | "atrasada" | "sem_plano" | "desativada";
export interface ShopRow {
  id: string; name: string; slug: string; city: string | null; createdAt: string;
  owner: { name: string; email: string } | null;
  plan: string; planLabel: string | null; annual: boolean; barbers: number;
  situacao: Situacao; expiresAt: string | null; daysLeft: number | null;
  whatsapp: string; ia: "on" | "off" | "sem_plano"; lastActivity: string | null; fee: number; billing: boolean;
}

export const SITUACAO: Record<Situacao, [string, string, string]> = {
  em_dia: ["Em dia", "bg-positive-soft text-positive", "bg-positive"],
  vence: ["Vence em breve", "bg-warning-soft text-warning", "bg-warning"],
  carencia: ["Na carência", "bg-danger-soft text-danger", "bg-danger"],
  atrasada: ["Atrasada", "bg-danger-soft text-danger", "bg-danger-strong"],
  sem_plano: ["Sem plano", "bg-surface-2 text-ink-2", "bg-ink-4"],
  desativada: ["Desativada", "bg-surface-2 text-ink-3", "bg-ink-4"],
};
const SEGMENTS: [string, string, string][] = [
  ["todas", "Todas", ""], ["em_dia", "Em dia", "pagando"], ["vence", "Vence em 7 dias", "renovar"],
  ["atrasada", "Atrasadas", "carência ou pausadas"], ["sem_plano", "Sem plano", "nunca pagaram"], ["desativada", "Desativadas", ""],
];
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
function ago(iso: string | null) {
  if (!iso) return "nunca";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : shortDate(iso);
}

/** Lista de barbearias da plataforma: situação, filtros e ordenação; cada linha abre o cliente. */
export default function BarbeariasLista({ shops }: { shops: ShopRow[] }) {
  const [seg, setSeg] = useState("todas");
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("all");
  const [wa, setWa] = useState("all");
  const [sort, setSort] = useState("atividade");
  const [limit, setLimit] = useState(25);

  const count = (k: string) => (k === "todas" ? shops.length : shops.filter((s) => (k === "atrasada" ? s.situacao === "atrasada" || s.situacao === "carencia" : s.situacao === k)).length);
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out = shops.filter((s) =>
      (seg === "todas" || (seg === "atrasada" ? s.situacao === "atrasada" || s.situacao === "carencia" : s.situacao === seg)) &&
      (plan === "all" || s.plan === plan) &&
      (wa === "all" || (wa === "on" ? s.whatsapp === "CONNECTED" : s.whatsapp !== "CONNECTED")) &&
      (!term || s.name.toLowerCase().includes(term) || s.slug.toLowerCase().includes(term) || (s.owner?.email ?? "").toLowerCase().includes(term)));
    const key: Record<string, (a: ShopRow, b: ShopRow) => number> = {
      atividade: (a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""),
      recentes: (a, b) => b.createdAt.localeCompare(a.createdAt),
      valor: (a, b) => b.fee - a.fee,
      nome: (a, b) => a.name.localeCompare(b.name),
    };
    return out.sort(key[sort]);
  }, [shops, seg, q, plan, wa, sort]);

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Situação das barbearias" className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {SEGMENTS.map(([k, label, hint]) => (
          <button key={k} type="button" aria-pressed={seg === k} onClick={() => { setSeg(k); setLimit(25); }}
            className={cn("flex flex-col items-start gap-1 px-3.5 py-3 rounded-xl border text-left", seg === k ? "bg-ink text-white border-ink" : "bg-surface border-line hover:bg-surface-2")}>
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              {k !== "todas" && <span className={cn("w-2 h-2 rounded-full", SITUACAO[k as Situacao][2])} />}{label}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-[22px] font-bold leading-none">{count(k)}</span>
              {hint && <span className={cn("text-xs", seg === k ? "text-white/70" : "text-ink-3")}>{hint}</span>}
            </span>
          </button>
        ))}
      </div>

      <section aria-label="Lista de barbearias" className="bg-surface border border-line rounded-2xl overflow-hidden">
        <div className="flex flex-wrap gap-2.5 items-end p-4 border-b border-line-2">
          <label className="flex-1 min-w-[220px] flex items-center h-11 rounded-[10px] border border-control bg-surface px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
            <Search className="w-4 h-4 text-ink-3 mr-2" aria-hidden />
            <input type="search" aria-label="Buscar barbearia" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail do dono ou link" className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
          </label>
          {([["Plano", plan, setPlan, [["all", "Todos"], ["ELITE", "Gestão + Atendente de IA"], ["PRO", "Gestão"], ["BASIC", "Básico (antigo)"]]],
            ["WhatsApp", wa, setWa, [["all", "Todos"], ["on", "Conectado"], ["off", "Desconectado"]]],
            ["Ordenar", sort, setSort, [["atividade", "Última atividade"], ["recentes", "Mais recentes"], ["valor", "Maior mensalidade"], ["nome", "Nome"]]]] as [string, string, (v: string) => void, [string, string][]][]).map(([label, v, set, opts]) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-3">{label}</span>
              <select value={v} onChange={(e) => set(e.target.value)} className={cn(fieldCls, "w-auto min-w-[150px]")}>
                {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
          ))}
        </div>

        <div className="hidden xl:grid grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_80px_minmax(0,1.1fr)_minmax(0,1.1fr)_110px_120px_32px] gap-3 px-4 py-2.5 text-xs font-semibold text-ink-3 border-b border-line-2">
          <span>Barbearia</span><span>Plano</span><span>Barbeiros</span><span>Situação</span><span>WhatsApp e IA</span><span>Última atividade</span><span className="text-right">Mensalidade</span><span />
        </div>
        {list.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-3">Nenhuma barbearia com esses filtros.</p>}
        {list.slice(0, limit).map((s) => {
          const [sLabel, sCls] = SITUACAO[s.situacao];
          return (
            <Link key={s.id} href={`/plataforma/clientes/${s.id}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_80px_minmax(0,1.1fr)_minmax(0,1.1fr)_110px_120px_32px] gap-x-3 gap-y-1.5 items-center px-4 py-3 border-b border-line-2 last:border-b-0 hover:bg-ground">
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-full bg-surface-2 text-ink-2 text-xs font-bold flex items-center justify-center shrink-0">{getInitials(s.name)}</span>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-semibold truncate">{s.name}</span>
                  <span className="text-xs text-ink-3 truncate">{s.owner?.email ?? s.slug}{s.city ? ` · ${s.city}` : ""}</span>
                </span>
              </span>
              <span className="xl:hidden justify-self-end"><span className={cn("h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center", sCls)}>{sLabel}</span></span>
              <span className="flex flex-col min-w-0 text-[13px]">
                <span className="font-semibold truncate">{s.planLabel ?? "Sem plano pago"}</span>
                <span className="text-xs text-ink-3">{s.planLabel ? (s.annual ? "anual" : "mensal") : s.plan === "BASIC" ? "Básico (antigo)" : ""}</span>
              </span>
              <span className="hidden xl:block text-sm">{s.barbers}</span>
              <span className="hidden xl:flex flex-col gap-0.5 items-start">
                <span className={cn("h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center", sCls)}>{sLabel}</span>
                {s.expiresAt && s.situacao !== "sem_plano" && (
                  <span className="text-xs text-ink-3">{s.daysLeft != null && s.daysLeft >= 0 ? `vence ${shortDate(s.expiresAt)}` : `venceu ${shortDate(s.expiresAt)}`}</span>
                )}
              </span>
              <span className="hidden xl:flex flex-col gap-0.5 text-xs">
                <span className="flex items-center gap-1.5"><span className={cn("w-1.5 h-1.5 rounded-full", s.whatsapp === "CONNECTED" ? "bg-positive" : "bg-ink-4")} />{s.whatsapp === "CONNECTED" ? "WhatsApp conectado" : "WhatsApp desconectado"}</span>
                <span className="flex items-center gap-1.5 text-ink-3"><span className={cn("w-1.5 h-1.5 rounded-full", s.ia === "on" ? "bg-positive" : "bg-ink-4")} />{s.ia === "on" ? "IA ligada" : s.ia === "off" ? "IA desligada" : "Sem IA no plano"}</span>
              </span>
              <span className="hidden xl:block text-[13px] text-ink-2">{ago(s.lastActivity)}</span>
              <span className="hidden xl:flex flex-col items-end text-[13px]">
                <span className="font-semibold">{s.fee ? formatCurrency(s.fee) : "—"}</span>
                {s.fee > 0 && !s.billing && <span className="text-xs text-danger">não está pagando</span>}
              </span>
              <ChevronRight className="hidden xl:block w-4 h-4 text-ink-4" aria-hidden />
            </Link>
          );
        })}
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-ink-3 bg-ground/60">
          <span>Mostrando {Math.min(limit, list.length)} de {list.length}</span>
          {list.length > limit && <button type="button" onClick={() => setLimit(limit + 50)} className="font-semibold text-ink-2 hover:text-ink">Mostrar mais</button>}
        </div>
      </section>
    </div>
  );
}
