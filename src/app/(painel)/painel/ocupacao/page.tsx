"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import { Segmented } from "@/components/catalogo/SidePanel";

type Periodo = "semana" | "mes";
interface Dia { data: string; taxa: number | null; atendimentos: number; status: "open" | "closed" | "future" }
interface Ocupacao {
  periodo: Periodo; start: string; end: string; today: string;
  taxaGeral: number; taxaAnterior: number | null;
  totalOcupadoGeral: number; totalDisponivelGeral: number; totalAtendimentos: number; diasAbertos: number;
  porBarbeiro: { id: string; name: string; atendimentos: number; minOcupados: number; minDisponiveis: number; taxa: number }[];
  porDia: Dia[]; melhorDia: Dia | null; piorDia: Dia | null;
  hours: number[]; heat: Record<string, (number | null)[][]>;
}
interface Retencao {
  porBarbeiro: { id: string; name: string; clientesMesPassado: number; clientesRetornaram: number; taxaRetorno: number | null; mediaFrequencia: number | null; totalClientesUnicos: number }[];
  taxaGeralRetorno: number; totalLastMonth: number; totalRetornaram: number;
}

const DOW_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DOW_LONG = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ROWS = [1, 2, 3, 4, 5, 6, 0]; // segunda primeiro
const dowOf = (k: string) => new Date(k + "T12:00:00Z").getUTCDay();
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const hm = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`; };
const monthName = (k: string, delta = 0) => {
  const d = new Date(k.slice(0, 8) + "15T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
};

function band(v: number) { return v < 40 ? 0 : v < 60 ? 1 : v < 75 ? 2 : v < 90 ? 3 : 4; }
const BAND_CLS = ["bg-primary/10 text-ink", "bg-primary/25 text-ink", "bg-primary/45 text-ink", "bg-primary/75 text-ink", "bg-ink text-white"];
const BAND_LABEL = ["até 39%", "40–59%", "60–74%", "75–89%", "90%+"];
const barCls = (r: number) => (r >= 70 ? "bg-ink" : r >= 40 ? "bg-bar" : "bg-danger-strong");

function verdict(r: number): [string, string] {
  if (r >= 70) return ["Ótimo", "bg-positive-soft text-positive"];
  if (r >= 40) return ["Regular", "bg-warning-soft text-warning"];
  return ["Baixo", "bg-danger-soft text-danger"];
}

export default function OcupacaoPage() {
  const { token } = useAuthStore();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [d, setD] = useState<Ocupacao | null>(null);
  const [ret, setRet] = useState<Retencao | null>(null);
  const [who, setWho] = useState("all");
  const [error, setError] = useState(false);

  const load = useCallback(async (p: Periodo) => {
    setError(false);
    const h = { Authorization: `Bearer ${token}` };
    try {
      const [r1, r2] = await Promise.all([fetch(`/api/barbershop/ocupacao?periodo=${p}`, { headers: h }), fetch("/api/barbershop/retencao", { headers: h })]);
      if (!r1.ok) throw new Error();
      setD(await r1.json());
      if (r2.ok) setRet(await r2.json());
    } catch {
      setError(true);
    }
  }, [token]);
  useEffect(() => { load(periodo); }, [load, periodo]);

  const hints = useMemo(() => {
    if (!d) return [];
    const out: { tone: string; title: string; body: string; cta: string; href: string }[] = [];
    const grid = d.heat.all ?? [];
    let low: [number, number, number] | null = null;
    let high: [number, number, number] | null = null;
    for (let dw = 0; dw < grid.length; dw++) {
      for (let i = 0; i < grid[dw].length; i++) {
        const v = grid[dw][i];
        if (v == null) continue;
        if (v < 40 && (!low || v < low[2])) low = [dw, i, v];
        if (v >= 90 && (!high || v > high[2])) high = [dw, i, v];
      }
    }
    const when = d.periodo === "semana" ? "nesta semana" : "neste mês";
    if (low) {
      const [dw, i, v] = low;
      out.push({ tone: "bg-danger", title: `${DOW_LONG[dw]} às ${d.hours[i]}h fica quase vazia`, body: `Só ${v}% ocupado ${when}. Chame os clientes que sumiram e ofereça esse horário.`, cta: "Ver clientes", href: "/painel/clientes" });
    }
    const idle = d.porBarbeiro.length > 1 ? [...d.porBarbeiro].sort((a, b) => (b.minDisponiveis - b.minOcupados) - (a.minDisponiveis - a.minOcupados))[0] : null;
    if (idle && idle.taxa < 60 && idle.minDisponiveis > 0) {
      out.push({ tone: "bg-warning", title: `${idle.name} tem ${hm(idle.minDisponiveis - idle.minOcupados)} livres`, body: `Ocupou ${idle.taxa}% do horário ${when}. Indique ele para clientes novos e para quem não tem barbeiro preferido.`, cta: "Ver profissionais", href: "/painel/barbeiros" });
    }
    if (high) {
      const [dw, i, v] = high;
      out.push({ tone: "bg-positive", title: `${DOW_LONG[dw]} às ${d.hours[i]}h está lotado`, body: `${v}% ocupado: quem procura esse horário não acha vaga. Vale abrir mais cedo ou ter mais um profissional nesse período.`, cta: "Ajustar horários", href: "/painel/configuracoes#horarios" });
    }
    return out;
  }, [d]);

  const header = (
    <header className="flex items-end justify-between gap-3 flex-wrap">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Ocupação</h1>
        <span className="text-sm text-ink-3">Quanto do tempo das cadeiras virou atendimento · conta só comandas fechadas</span>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap">
        <Segmented value={periodo} onChange={setPeriodo} label="Período" options={[["semana", "Esta semana"], ["mes", "Este mês"]]} />
        <Link href="/painel/configuracoes#horarios" className="h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold inline-flex items-center gap-2 hover:bg-surface-2">
          <Clock className="w-4 h-4" aria-hidden />Horários de funcionamento
        </Link>
      </div>
    </header>
  );

  if (error) return <div className="flex flex-col gap-5">{header}<p role="alert" className="rounded-2xl bg-danger-soft text-danger px-5 py-4 text-sm">Não foi possível carregar a ocupação. <button type="button" className="font-semibold underline" onClick={() => load(periodo)}>Tentar de novo</button></p></div>;
  if (!d) return <div className="flex flex-col gap-5">{header}<div className="h-64 rounded-2xl bg-surface border border-line animate-pulse" /><div className="h-96 rounded-2xl bg-surface border border-line animate-pulse" /></div>;

  const [vLabel, vCls] = verdict(d.taxaGeral);
  const isWeek = d.periodo === "semana";
  const title = isWeek ? "Ocupação desta semana" : `Ocupação de ${monthName(d.today)}`;
  const gap70 = 70 - d.taxaGeral;
  const note = [
    isWeek ? `De segunda ${ddmm(d.start)} até agora.` : `De 1º de ${monthName(d.today)} até agora.`,
    gap70 > 0 ? `Faltam ${gap70} pontos para chegar em 70%.` : null,
    d.taxaAnterior != null ? `${isWeek ? "A semana passada" : monthName(d.today, -1).replace(/^./, (c) => c.toUpperCase())} fechou em ${d.taxaAnterior}%.` : null,
  ].filter(Boolean).join(" ");
  const grid = d.heat[who] ?? d.heat.all;
  const whoName = who === "all" ? "Barbearia toda" : d.porBarbeiro.find((b) => b.id === who)?.name ?? "";
  const dayLabel = (k: string) => (k === d.today ? "hoje" : `${DOW_SHORT[dowOf(k)].toLowerCase()} ${Number(k.slice(8, 10))}`);
  const kpis = [
    { label: "Tempo ocupado", value: hm(d.totalOcupadoGeral), sub: `somando os ${d.porBarbeiro.length} profissionais` },
    { label: "Tempo disponível", value: hm(d.totalDisponivelGeral), sub: "horário aberto × profissionais" },
    { label: "Atendimentos", value: String(d.totalAtendimentos), sub: "comandas fechadas" },
    { label: "Dias abertos", value: String(d.diasAbertos), sub: "hoje conta até agora" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {header}

      <section aria-labelledby="geral-t" className="bg-surface border border-line rounded-2xl grid lg:grid-cols-[300px_minmax(0,1fr)_280px] overflow-hidden">
        <div className="px-6 py-[22px] flex flex-col gap-3 border-b lg:border-b-0 lg:border-r border-line-2">
          <h2 id="geral-t" className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">{title}</h2>
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[56px] font-bold tracking-[-0.03em] leading-none">{d.taxaGeral}%</span>
            <span className={cn("h-6 px-2.5 rounded-full text-xs font-semibold flex items-center", vCls)}>{vLabel}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="relative h-3 rounded-md bg-surface-2">
              <div className="h-full rounded-md bg-ink" style={{ width: `${d.taxaGeral}%` }} />
              <div className="absolute -top-1 -bottom-1 left-[70%] w-0.5 bg-primary" />
            </div>
            <div className="flex justify-between text-xs text-ink-3"><span>0%</span><span className="font-semibold text-ink-2">70% é ótimo</span><span>100%</span></div>
          </div>
          <span className="text-[13px] text-ink-2 leading-snug">{note}</span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-line-2">
          {kpis.map((k) => (
            <div key={k.label} className="bg-surface px-[22px] py-[18px] flex flex-col gap-1">
              <span className="text-[13px] text-ink-3">{k.label}</span>
              <span className="font-display text-[28px] font-bold tracking-[-0.02em] leading-tight">{k.value}</span>
              <span className="text-xs text-ink-4">{k.sub}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-[18px] flex flex-col gap-2.5 border-t lg:border-t-0 lg:border-l border-line-2">
          <div className="flex-1 px-3.5 py-3 rounded-xl bg-positive-soft flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-positive">Melhor dia</span>
            {d.melhorDia ? <>
              <span className="text-base font-bold">{DOW_LONG[dowOf(d.melhorDia.data)]}, {ddmm(d.melhorDia.data)}</span>
              <span className="text-[13px] text-positive">{d.melhorDia.taxa}% ocupado · {d.melhorDia.atendimentos} atendimentos</span>
            </> : <span className="text-[13px] text-positive">Ainda sem dias fechados</span>}
          </div>
          <div className="flex-1 px-3.5 py-3 rounded-xl bg-danger-soft flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-danger">Dia mais vazio</span>
            {d.piorDia ? <>
              <span className="text-base font-bold">{DOW_LONG[dowOf(d.piorDia.data)]}, {ddmm(d.piorDia.data)}</span>
              <span className="text-[13px] text-danger">{d.piorDia.taxa}% ocupado · {d.piorDia.atendimentos} atendimentos</span>
            </> : <span className="text-[13px] text-danger">Ainda sem dias para comparar</span>}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] items-stretch">
        <section aria-labelledby="mapa-t" className="bg-surface border border-line rounded-2xl px-5 pt-[18px] pb-5 flex flex-col gap-3.5 min-w-0">
          <div className="flex flex-col gap-0.5">
            <h2 id="mapa-t" className="text-[15px] font-semibold">Mapa de horários</h2>
            <span className="text-[13px] text-ink-3">{isWeek ? "Esta semana" : `Média de ${monthName(d.today)}`} · {whoName} · % do horário ocupado</span>
          </div>
          {d.porBarbeiro.length > 1 && (
            <div role="group" aria-label="Filtrar por profissional" className="flex gap-2 flex-wrap">
              {[{ id: "all", name: "Barbearia toda" }, ...d.porBarbeiro].map((b) => (
                <button key={b.id} type="button" aria-pressed={who === b.id} onClick={() => setWho(b.id)}
                  className={cn("h-9 px-3.5 rounded-full border text-[13px] font-semibold", who === b.id ? "bg-ink text-white border-ink" : "bg-surface border-control")}>
                  {b.name.split(" ")[0]}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-x-auto -mx-1 px-1">
            <div role="table" aria-label="Ocupação por dia da semana e hora" className="flex flex-col gap-1 min-w-[560px]">
              <div role="row" className="grid gap-1" style={{ gridTemplateColumns: `44px repeat(${d.hours.length}, minmax(0, 1fr))` }}>
                <span role="columnheader" />
                {d.hours.map((h) => <span key={h} role="columnheader" className="text-xs text-ink-3 text-center">{h}h</span>)}
              </div>
              {ROWS.map((dw) => {
                const row = grid[dw] ?? [];
                const closed = row.every((v) => v == null);
                return (
                  <div key={dw} role="row" className="grid gap-1" style={{ gridTemplateColumns: `44px repeat(${d.hours.length}, minmax(0, 1fr))` }}>
                    <span role="rowheader" className={cn("text-[13px] font-semibold flex items-center", closed && "text-ink-4")}>{DOW_SHORT[dw]}</span>
                    {closed ? (
                      <div role="cell" className="h-11 rounded-[7px] bg-ground border border-dashed border-line flex items-center justify-center text-xs text-ink-4" style={{ gridColumn: `span ${d.hours.length}` }}>
                        {isWeek ? "Fechado ou ainda não chegou" : "Fechado"}
                      </div>
                    ) : row.map((v, i) => (
                      <div key={i} role="cell" title={v == null ? `${DOW_LONG[dw]} ${d.hours[i]}h: sem horário` : `${DOW_LONG[dw]} ${d.hours[i]}h: ${v}% ocupado`}
                        className={cn("h-11 rounded-[7px] flex items-center justify-center text-xs font-semibold",
                          v == null ? "bg-ground border border-line-2" : BAND_CLS[band(v)], v != null && v < 40 && "border-[1.5px] border-dashed border-danger")}>
                        {v == null ? "" : `${v}%`}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-3.5 flex-wrap text-xs text-ink-2">
              {BAND_LABEL.map((l, b) => (
                <span key={l} className="flex items-center gap-1.5">
                  <span className={cn("w-3.5 h-3.5 rounded", BAND_CLS[b], b === 0 && "border-[1.5px] border-dashed border-danger")} />{l}
                </span>
              ))}
            </div>
            <span className="text-xs text-ink-4">Contorno tracejado = horário quase vazio</span>
          </div>
        </section>

        <aside aria-labelledby="dicas-t" className="bg-surface border border-line rounded-2xl flex flex-col overflow-hidden">
          <div className="px-5 pt-[18px] pb-3 flex flex-col gap-0.5">
            <h2 id="dicas-t" className="text-[15px] font-semibold">Como encher a agenda</h2>
            <span className="text-[13px] text-ink-3">Sugestões a partir do mapa</span>
          </div>
          {hints.length === 0 && <p className="px-5 pb-5 text-[13px] text-ink-3">Nada chamando atenção: os horários estão equilibrados.</p>}
          {hints.map((t) => (
            <div key={t.title} className="px-5 py-3.5 border-t border-line-2 flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm font-semibold"><span className={cn("w-2 h-2 rounded-full shrink-0", t.tone)} />{t.title}</span>
              <span className="text-[13px] text-ink-2 leading-snug">{t.body}</span>
              <Link href={t.href} className="self-start h-9 px-3 rounded-[9px] border border-control bg-surface text-[13px] font-semibold inline-flex items-center gap-1.5 hover:bg-surface-2">
                {t.cta}<ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </div>
          ))}
        </aside>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="dia-t" className="bg-surface border border-line rounded-2xl px-5 py-[18px] flex flex-col gap-3.5 min-w-0">
          <div className="flex justify-between items-baseline gap-3">
            <h2 id="dia-t" className="text-[15px] font-semibold">Ocupação por dia</h2>
            <span className="text-[13px] text-ink-3">número embaixo = atendimentos</span>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <div className="flex items-end gap-1.5 h-[196px]" style={{ minWidth: d.porDia.length * 30 }}>
              {d.porDia.map((x) => {
                const today = x.data === d.today;
                return (
                  <div key={x.data} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                    <span className="text-[11px] font-semibold text-ink-2 h-4">{x.status === "open" && x.taxa != null ? `${x.taxa}%` : ""}</span>
                    <div className="w-full h-[130px] flex items-end">
                      <div className={cn("w-full rounded-[5px_5px_2px_2px]",
                        x.status === "closed" ? "bg-surface-2" : x.status === "future" ? "bg-surface border border-dashed border-line" : today ? "bg-ink/50" : barCls(x.taxa ?? 0))}
                        style={{ height: x.status === "closed" ? 6 : x.status === "future" ? "100%" : `${Math.max(x.taxa ?? 0, 2)}%` }} />
                    </div>
                    <span className={cn("text-[11px] whitespace-nowrap", today ? "font-bold text-ink" : "text-ink-3")}>{dayLabel(x.data)}</span>
                    <span className="text-[11px] text-ink-4 h-4">{x.status === "closed" ? "fechado" : x.status === "open" ? x.atendimentos : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3.5 flex-wrap text-xs text-ink-2 pt-1.5 border-t border-line-2">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-ink" />70% ou mais</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-bar" />40 a 69%</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-danger-strong" />abaixo de 40%</span>
          </div>
        </section>

        <section aria-labelledby="prof-t" className="bg-surface border border-line rounded-2xl flex flex-col">
          <div className="flex justify-between items-baseline px-5 pt-[18px] pb-2.5">
            <h2 id="prof-t" className="text-[15px] font-semibold">Por profissional</h2>
            <span className="text-[13px] text-ink-3">respeita folga e horário de cada um</span>
          </div>
          {d.porBarbeiro.length === 0 && <p className="px-5 pb-5 text-[13px] text-ink-3">Nenhum profissional ativo.</p>}
          {d.porBarbeiro.map((b) => {
            const free = Math.max(0, b.minDisponiveis - b.minOcupados);
            return (
              <div key={b.id} className="px-5 py-3.5 border-t border-line-2 flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-[38px] h-[38px] rounded-full bg-surface-2 text-ink-2 text-[13px] font-bold flex items-center justify-center shrink-0">{getInitials(b.name)}</div>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-semibold truncate">{b.name}</span>
                    <span className="text-xs text-ink-3">{b.atendimentos} atendimentos · {hm(b.minOcupados)} ocupado</span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className={cn("font-display text-2xl font-bold", b.taxa >= 70 ? "text-ink" : b.taxa >= 40 ? "text-warning" : "text-danger")}>{b.taxa}%</span>
                    <span className={cn("text-xs", b.taxa < 60 ? "font-semibold text-warning" : "text-ink-3")}>{hm(free)} livres</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-surface-2"><div className={cn("h-full rounded-full", barCls(b.taxa))} style={{ width: `${b.taxa}%` }} /></div>
              </div>
            );
          })}
        </section>
      </div>

      {ret && (
        <section aria-labelledby="ret-t" className="bg-surface border border-line rounded-2xl grid lg:grid-cols-[300px_minmax(0,1fr)] overflow-hidden">
          <div className="px-[22px] py-5 flex flex-col gap-2.5 border-b lg:border-b-0 lg:border-r border-line-2">
            <h2 id="ret-t" className="text-[15px] font-semibold">Clientes que voltam</h2>
            <span className="text-[13px] text-ink-3">Quem veio em {monthName(d.today, -1)} e já voltou em {monthName(d.today)}</span>
            <span className="font-display text-[44px] font-bold tracking-[-0.03em] leading-none">{ret.totalLastMonth ? `${ret.taxaGeralRetorno}%` : "—"}</span>
            <span className="text-sm text-ink-2">{ret.totalRetornaram} de {ret.totalLastMonth} clientes voltaram</span>
            {ret.totalLastMonth > 0 && (
              <span className={cn("self-start h-6 px-2.5 rounded-full text-xs font-semibold flex items-center",
                ret.taxaGeralRetorno >= 60 ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning")}>
                {ret.taxaGeralRetorno >= 60 ? "Bom retorno" : "Retorno moderado"} · 60% já é bom
              </span>
            )}
            <Link href="/painel/clientes" className="mt-1 text-[13px] font-semibold text-ink-2 underline underline-offset-2 w-fit">Ver clientes</Link>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {ret.porBarbeiro.map((r, i) => (
              <div key={r.id} className={cn("px-[18px] py-5 flex flex-col gap-3 border-line-2", i > 0 && "border-t sm:border-t-0 sm:border-l")}>
                <div className="flex items-center gap-2.5">
                  <div className="w-[34px] h-[34px] rounded-full bg-surface-2 text-ink-2 text-xs font-bold flex items-center justify-center shrink-0">{getInitials(r.name)}</div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold truncate">{r.name}</span>
                    <span className="text-xs text-ink-3">{r.totalClientesUnicos} clientes atendidos</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-[10px] bg-ground flex flex-col gap-0.5">
                    <span className="text-xs text-ink-3">Voltaram</span>
                    <span className={cn("text-xl font-bold", r.taxaRetorno == null ? "text-ink-4" : r.taxaRetorno >= 60 ? "text-positive" : r.taxaRetorno >= 35 ? "text-warning" : "text-danger")}>{r.taxaRetorno == null ? "—" : `${r.taxaRetorno}%`}</span>
                    <span className="text-xs text-ink-4">{r.clientesRetornaram} de {r.clientesMesPassado}</span>
                  </div>
                  <div className="p-2.5 rounded-[10px] bg-ground flex flex-col gap-0.5">
                    <span className="text-xs text-ink-3">Volta a cada</span>
                    <span className="text-xl font-bold">{r.mediaFrequencia == null ? "—" : `${r.mediaFrequencia} dias`}</span>
                    <span className="text-xs text-ink-4">em média</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
