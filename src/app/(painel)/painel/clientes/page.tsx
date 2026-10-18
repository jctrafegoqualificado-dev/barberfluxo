"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageCircle, Plus, Search, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, formatCurrency, getInitials } from "@/lib/utils";
import { Chip } from "@/components/ui/Chip";
import ClientFicha from "@/components/clientes/ClientFicha";
import { ChamarDeVoltaModal, ImportarModal, NovoClienteModal } from "@/components/clientes/ClienteModals";
import {
  type ClienteRow, type Segment, type ShopInfo, LAPSED, comebackMessage, currentMonthSP, firstName, frequencyLabel,
  inSegment, lastVisitLabel, monthName, rowTag, waLink,
} from "@/components/clientes/types";

const PAGE_SIZE = 20;
const money = (v: number) => formatCurrency(v).replace(",00", "");
const count = (n: number) => n.toLocaleString("pt-BR");

type Sort = "recent" | "spent" | "visits" | "name";
const SORTS: { key: Sort; label: string }[] = [
  { key: "recent", label: "Última visita" },
  { key: "spent", label: "Mais gastou" },
  { key: "visits", label: "Mais visitas" },
  { key: "name", label: "Nome" },
];

const SEGMENT_NOUN: Record<Segment, string> = {
  todos: "clientes", frequentes: "frequentes", sumidos: "sumidos", assinantes: "assinantes",
  aniversario: "aniversariantes", bloqueados: "bloqueados",
};

/** Painel ao lado da lista só a partir de 1280px; abaixo disso a ficha abre em página própria. */
const WIDE = "(min-width: 1280px)";

function birthdayMessage(name: string, shopName?: string) {
  return `Parabéns, ${firstName(name)}! 🎉 A equipe${shopName ? ` da ${shopName}` : ""} te deseja um feliz aniversário. Passa aqui pra comemorar com um corte!`;
}

export default function ClientesPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const isOwner = user?.role === "OWNER";
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<Segment>("todos");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<"novo" | "importar" | "chamar" | null>(null);
  const month = currentMonthSP();

  const load = useCallback(async () => {
    const r = await fetch("/api/barbershop/clientes", { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    setClientes(d.clientes || []);
    setShop(d.shop ?? null);
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const segments = useMemo(() => {
    const of = (s: Segment) => clientes.filter((c) => inSegment(c, s, month));
    const subs = of("assinantes");
    const mrr = subs.reduce((s, c) => s + (c.planPrice ?? 0), 0);
    return [
      { key: "todos" as const, label: "Todos", n: clientes.length, hint: "" },
      { key: "frequentes" as const, label: "Frequentes", n: of("frequentes").length, hint: "vêm todo mês" },
      { key: "sumidos" as const, label: "Sumidos", n: of("sumidos").length, hint: "passaram do prazo" },
      { key: "assinantes" as const, label: "Assinantes", n: subs.length, hint: mrr ? `${money(mrr)}/mês` : "" },
      { key: "aniversario" as const, label: "Aniversário", n: of("aniversario").length, hint: `em ${monthName(month)}` },
      { key: "bloqueados" as const, label: "Bloqueados", n: of("bloqueados").length, hint: "" },
    ];
  }, [clientes, month]);

  const lapsed = useMemo(() => clientes.filter((c) => inSegment(c, "sumidos", month)), [clientes, month]);
  const lapsedValue = lapsed.reduce((s, c) => s + c.monthlyValue, 0);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    const list = clientes.filter((c) =>
      inSegment(c, segment, month) &&
      (!q || c.name.toLowerCase().includes(q) || (digits.length >= 3 && (c.phone ?? "").includes(digits))));
    const by: Record<Sort, (a: ClienteRow, b: ClienteRow) => number> = {
      recent: (a, b) => (a.daysSinceLastVisit ?? Infinity) - (b.daysSinceLastVisit ?? Infinity),
      spent: (a, b) => b.totalSpent - a.totalSpent,
      visits: (a, b) => b.totalVisits - a.totalVisits,
      name: (a, b) => a.name.localeCompare(b.name, "pt-BR"),
    };
    return list.sort(by[sort]);
  }, [clientes, segment, search, sort, month]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // No computador já abre a ficha do primeiro da lista
  useEffect(() => {
    if (loading || !window.matchMedia(WIDE).matches) return;
    if (!selectedId || !rows.some((r) => r.id === selectedId)) setSelectedId(rows[0]?.id ?? null);
  }, [loading, rows, selectedId]);

  function open(c: ClienteRow) {
    if (window.matchMedia(WIDE).matches) setSelectedId(c.id);
    else router.push(`/painel/clientes/${c.id}`);
  }

  function pickSegment(s: Segment) { setSegment(s); setPage(1); }

  const rowMessage = (c: ClienteRow) =>
    segment === "aniversario" ? birthdayMessage(c.name, shop?.name)
      : c.lapsed ? comebackMessage({ name: c.name, shopName: shop?.name, barberName: c.preferredBarber, slug: shop?.slug })
      : undefined;

  const cameThisMonth = clientes.filter((c) => c.thisMonthVisits > 0).length;
  const showBanner = lapsed.length > 0 && (segment === "todos" || segment === "sumidos");

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {/* Cabeçalho */}
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Clientes</h1>
          {!loading && (
            <span className="text-sm text-ink-3">
              {count(clientes.length)} {clientes.length === 1 ? "cadastrado" : "cadastrados"} · {count(cameThisMonth)} {cameThisMonth === 1 ? "veio" : "vieram"} este mês
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {isOwner && (
            <button type="button" onClick={() => setModal("importar")}
              className="hidden md:inline-flex h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-sm font-semibold items-center gap-2 hover:bg-surface-3">
              <Upload className="w-4 h-4" aria-hidden /> Importar planilha
            </button>
          )}
          <button type="button" onClick={() => setModal("novo")}
            className="h-[42px] px-4 rounded-[10px] bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-primary/90">
            <Plus className="w-[17px] h-[17px]" aria-hidden /> Novo cliente
          </button>
        </div>
      </header>

      {/* Grupos — cartões no computador, chips no celular */}
      <div role="group" aria-label="Grupos de clientes" className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-2.5">
        {segments.map((g) => {
          const on = segment === g.key;
          return (
            <button key={g.key} type="button" aria-pressed={on} onClick={() => pickSegment(g.key)}
              className={cn("h-[84px] px-3.5 py-3 rounded-xl border text-left flex flex-col justify-between transition-colors",
                on ? "bg-ink border-ink text-white" : "bg-surface border-line text-ink hover:border-control")}>
              <span className="text-[13px] font-semibold opacity-85">{g.label}</span>
              <span className="flex items-baseline gap-1.5 min-w-0">
                <span className="font-display text-2xl font-bold">{loading ? "–" : count(g.n)}</span>
                {g.hint && <span className="text-xs opacity-75 truncate">{g.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div role="group" aria-label="Grupos de clientes" className="md:hidden -mx-4 px-4 flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {segments.filter((g) => g.key !== "bloqueados" || g.n > 0).map((g) => (
          <Chip key={g.key} active={segment === g.key} onClick={() => pickSegment(g.key)} count={g.key === "todos" || loading ? undefined : g.n}>
            {g.label}
          </Chip>
        ))}
      </div>

      {/* Sumidos: quanto deixam na mesa + chamar de volta */}
      {showBanner && !loading && (
        <div className={cn("rounded-[14px] border p-4 flex flex-col md:flex-row md:items-center gap-3", LAPSED.bg, LAPSED.border)}>
          <div className="flex-1 min-w-0">
            <p className={cn("text-[15px] font-semibold", LAPSED.text)}>
              {count(lapsed.length)} {lapsed.length === 1 ? "cliente passou" : "clientes passaram"} do tempo que costuma{lapsed.length === 1 ? "" : "m"} voltar
            </p>
            {lapsedValue > 0 && (
              <p className={cn("text-[13px] mt-0.5", LAPSED.text)}>
                {lapsed.length === 1 ? "Gastava" : "Juntos gastavam"} cerca de {money(Math.round(lapsedValue / 10) * 10)} por mês.
                {shop?.retentionEnabled ? " A mensagem automática de retorno está ligada." : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {segment !== "sumidos" && (
              <button type="button" onClick={() => pickSegment("sumidos")}
                className="h-10 px-3.5 rounded-[9px] border border-[#F3D3BD] bg-surface/70 text-[13px] font-semibold text-ink">
                Ver quem
              </button>
            )}
            <button type="button" onClick={() => setModal("chamar")}
              className="h-10 px-4 rounded-[9px] bg-ink text-white text-[13px] font-semibold inline-flex items-center gap-2 hover:bg-ink/90">
              <MessageCircle className="w-4 h-4" aria-hidden /> Chamar todos de volta
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-5 items-start">
        {/* Lista */}
        <section aria-label="Lista de clientes" className="flex-1 min-w-0 bg-surface border border-line rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-2.5 p-3 md:px-4 md:py-3.5 border-b border-line-2">
            <label className="flex-1 flex items-center gap-2.5 h-[42px] px-3 rounded-[10px] border border-control bg-[#FBFAF7]">
              <Search className="w-[17px] h-[17px] text-ink-3 shrink-0" aria-hidden />
              <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                aria-label="Buscar cliente" placeholder="Buscar por nome ou telefone"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm placeholder:text-ink-4" />
            </label>
            <label className="flex items-center gap-2 h-[42px] px-3 rounded-[10px] border border-control text-[13px] text-ink-2">
              <span className="hidden sm:inline">Ordenar</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar por"
                className="bg-transparent outline-none text-[13px] font-semibold text-ink max-w-[110px] sm:max-w-none">
                {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="divide-y divide-line-3" aria-busy>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 h-[58px] animate-pulse">
                  <div className="w-[34px] h-[34px] rounded-full bg-surface-2" />
                  <div className="h-3.5 w-40 rounded bg-surface-2" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="py-14 px-6 text-center flex flex-col items-center gap-2">
              <Users className="w-9 h-9 text-ink-4" aria-hidden />
              <p className="font-semibold">
                {search ? "Ninguém com esse nome ou telefone" : clientes.length === 0 ? "Nenhum cliente ainda" : `Nenhum cliente em “${segments.find((g) => g.key === segment)?.label}”`}
              </p>
              <p className="text-[13px] text-ink-3 max-w-sm">
                {clientes.length === 0
                  ? "Quem agendar pelo link ou pelo WhatsApp aparece aqui. Você também pode cadastrar ou importar uma planilha."
                  : segment === "sumidos" ? "Todo mundo está voltando no ritmo de sempre." : "Tente outro grupo ou outra busca."}
              </p>
            </div>
          ) : (
            <>
              {/* Tabela (tablet e computador) */}
              <div className="hidden md:block" role="table" aria-label="Clientes">
                <div role="row" className="grid grid-cols-[minmax(0,2.2fr)_1.1fr_1fr_0.6fr_0.9fr_44px] gap-3 items-center px-4 py-2.5 text-xs font-semibold text-ink-3 border-b border-line-2">
                  <span role="columnheader">Cliente</span><span role="columnheader">Última visita</span><span role="columnheader">Costuma vir</span>
                  <span role="columnheader" className="text-right">Visitas</span><span role="columnheader" className="text-right">Gastou</span><span />
                </div>
                {visible.map((c) => {
                  const tag = rowTag(c);
                  const sel = c.id === selectedId;
                  const msg = rowMessage(c);
                  return (
                    <div key={c.id} role="row" tabIndex={0} onClick={() => open(c)}
                      onKeyDown={(e) => { if (e.key === "Enter") open(c); }}
                      aria-current={sel || undefined}
                      className={cn("grid grid-cols-[minmax(0,2.2fr)_1.1fr_1fr_0.6fr_0.9fr_44px] gap-3 items-center min-h-[58px] px-4 border-b border-line-3 last:border-0 cursor-pointer outline-none focus-visible:bg-surface-3",
                        sel ? "xl:bg-primary/[0.07]" : "hover:bg-surface-3/60")}>
                      <div role="cell" className="flex items-center gap-2.5 min-w-0">
                        <div className={cn("w-[34px] h-[34px] rounded-full text-xs font-bold flex items-center justify-center shrink-0",
                          sel ? "xl:bg-primary xl:text-white bg-surface-2 text-ink-2" : "bg-surface-2 text-ink-2")}>
                          {getInitials(c.name)}
                        </div>
                        <div className="min-w-0 flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5 text-sm font-semibold min-w-0">
                            <span className="truncate">{c.name}</span>
                            {tag && <span className={cn("h-5 px-[7px] rounded-[10px] text-[11px] font-semibold inline-flex items-center shrink-0", tag.cls)}>{tag.label}</span>}
                          </span>
                          <span className="text-xs text-ink-3 truncate">
                            {c.preferredBarber ? `prefere ${c.preferredBarber}` : c.activePlan ?? (c.totalVisits === 0 ? "ainda não veio" : "")}
                          </span>
                        </div>
                      </div>
                      <span role="cell" className={cn("text-[13px]", c.lapsed ? cn("font-semibold", LAPSED.late) : "text-ink")}>
                        {lastVisitLabel(c.daysSinceLastVisit)}
                        {c.hasUpcoming && <span className="block text-[11px] font-normal text-positive">horário marcado</span>}
                      </span>
                      <span role="cell" className="text-[13px] text-ink-2">{frequencyLabel(c)}</span>
                      <span role="cell" className="text-[13px] text-right">{c.totalVisits}</span>
                      <span role="cell" className="text-[13px] font-semibold text-right">{money(c.totalSpent)}</span>
                      <span role="cell">
                        {c.phone && (
                          <a href={waLink(c.phone, msg)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                            aria-label={`Mandar mensagem para ${c.name} pelo WhatsApp`}
                            className="w-9 h-9 rounded-[9px] border border-control bg-surface flex items-center justify-center hover:bg-surface-3">
                            <MessageCircle className="w-[15px] h-[15px]" aria-hidden />
                          </a>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Lista (celular) */}
              <ul className="md:hidden divide-y divide-line-3">
                {visible.map((c) => {
                  const tag = rowTag(c);
                  const sub = [c.preferredBarber, c.noShowCount >= 2 ? `${c.noShowCount} faltas` : c.avgFrequency ? `a cada ${c.avgFrequency} dias` : null]
                    .filter(Boolean).join(" · ");
                  return (
                    <li key={c.id}>
                      <Link href={`/painel/clientes/${c.id}`} className="flex items-center gap-3 px-4 min-h-[64px] py-2.5 active:bg-surface-3">
                        <div className="w-10 h-10 rounded-full bg-surface-2 text-ink-2 text-[13px] font-bold flex items-center justify-center shrink-0">
                          {getInitials(c.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="flex items-center gap-1.5 text-[15px] font-semibold min-w-0">
                            <span className="truncate">{c.name}</span>
                            {tag && segment === "todos" && <span className={cn("h-5 px-1.5 rounded-[10px] text-[11px] font-semibold inline-flex items-center shrink-0", tag.cls)}>{tag.label}</span>}
                          </p>
                          <p className="text-[13px] text-ink-3 truncate">{sub || c.activePlan || "—"}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn("text-[13px]", c.lapsed ? cn("font-semibold", LAPSED.late) : "text-ink-2")}>{lastVisitLabel(c.daysSinceLastVisit)}</p>
                          <p className="text-xs text-ink-3">{money(c.totalSpent)} no total</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Paginação */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line-2 text-[13px] text-ink-2">
                <span>
                  Mostrando {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} de {count(rows.length)} {SEGMENT_NOUN[segment]}
                </span>
                {pages > 1 && (
                  <div className="flex gap-1.5">
                    <button type="button" aria-label="Página anterior" disabled={current === 1} onClick={() => setPage(current - 1)}
                      className="w-9 h-9 rounded-[9px] border border-control bg-surface flex items-center justify-center disabled:text-ink-4 disabled:border-line-2">
                      <ChevronLeft className="w-4 h-4" aria-hidden />
                    </button>
                    <button type="button" aria-label="Próxima página" disabled={current === pages} onClick={() => setPage(current + 1)}
                      className="w-9 h-9 rounded-[9px] border border-control bg-surface flex items-center justify-center disabled:text-ink-4 disabled:border-line-2">
                      <ChevronRight className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Ficha ao lado (computador largo) */}
        {selectedId && (
          <aside aria-label="Ficha do cliente"
            className="hidden xl:flex w-[372px] shrink-0 sticky top-6 max-h-[calc(100vh-3rem)] bg-surface border border-line rounded-2xl overflow-hidden flex-col">
            <ClientFicha key={selectedId} id={selectedId} variant="panel" onChanged={load}
              onDeleted={() => { setSelectedId(null); load(); toast.success("Cliente excluído"); }} />
          </aside>
        )}
      </div>

      {modal === "novo" && (
        <NovoClienteModal onClose={() => setModal(null)}
          onCreated={(id, linked) => {
            setModal(null);
            setSegment("todos"); setSearch("");
            toast.success(linked ? "Esse cliente já tinha cadastro — agora ele está na sua lista." : "Cliente cadastrado");
            load().then(() => open({ id } as ClienteRow));
          }} />
      )}
      {modal === "importar" && <ImportarModal onClose={() => setModal(null)} onDone={load} />}
      {modal === "chamar" && <ChamarDeVoltaModal clientes={lapsed} shop={shop} onClose={() => setModal(null)} />}
    </div>
  );
}
