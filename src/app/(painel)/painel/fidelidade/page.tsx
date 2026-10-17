"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, MessageCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Field, Segmented, SidePanel, useWide } from "@/components/catalogo/SidePanel";

interface Config { loyaltyThreshold: number; loyaltyDiscountPercent: number; pointsPerReview: number }
interface Client { clientId: string; name: string; phone: string | null; balance: number; reviews: number; lastReviewAt: string | null }
interface Recent { id: string; at: string; points: number; description: string | null; name: string; clientId: string }
interface Reviews {
  count: number; avg: number | null; nps: number | null; promoters: number; passives: number; detractors: number; pointsGiven: number;
  byBarber: { id: string; name: string; count: number; avg: number }[];
  comments: { id: string; rating: number; comment: string | null; at: string; client: string; phone: string | null; barber: string | null }[];
}
interface Data {
  config: Config; clients: Client[]; recent: Recent[]; reviews: Reviews;
  stats: { eligible: number; near: number; withPoints: number; pointsTotal: number; redeemedMonth: number; redeemedMonthPoints: number };
}
interface Detail {
  balance: number;
  next: { date: string; startTime: string; barber: { nickname: string | null; user: { name: string } } | null; services: { service: { name: string } }[] } | null;
}
type Tab = "podem" | "quase" | "todos";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const spKey = (iso: string) => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const today = () => spKey(new Date().toISOString());
const month = () => MONTHS_LONG[Number(today().slice(5, 7)) - 1];
function shortDate(iso: string) {
  const k = spKey(iso);
  if (k === today()) return "hoje";
  const [, m, d] = k.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]}`;
}
const num = (v: number, digits = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const wa = (phone: string | null, text: string) => {
  const p = phone?.replace(/\D/g, "");
  return p ? `https://wa.me/${p.startsWith("55") ? p : "55" + p}?text=${encodeURIComponent(text)}` : null;
};

export default function FidelidadePage() {
  const { token } = useAuthStore();
  const wide = useWide();
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("podem");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(20);
  const [selected, setSelected] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/barbershop/fidelidade", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    if (d.error) { toast.error(d.error); return; }
    setData(d);
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const cfg = data?.config ?? { loyaltyThreshold: 50, loyaltyDiscountPercent: 10, pointsPerReview: 10 };
  const t = cfg.loyaltyThreshold;
  const reviewsPerRedeem = Math.ceil(t / cfg.pointsPerReview);
  const clients = useMemo(() => data?.clients ?? [], [data]);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    return clients
      .filter((c) => (tab === "podem" ? c.balance >= t : tab === "quase" ? c.balance < t && c.balance >= t - cfg.pointsPerReview : true))
      .filter((c) => !s || c.name.toLowerCase().includes(s) || (digits.length >= 3 && (c.phone ?? "").includes(digits)));
  }, [clients, tab, search, t, cfg.pointsPerReview]);
  // Depois de um resgate que zera o saldo o cliente sai da lista; o cartão continua (para desfazer)
  const sel = selected ? clients.find((c) => c.clientId === selected.clientId) ?? selected : null;

  useEffect(() => {
    if (wide && data && selected === null) {
      const first = data.clients.find((c) => c.balance >= t);
      if (first) setSelected(first);
    }
  }, [wide, data, selected, t]);

  const s = data?.stats;
  const rv = data?.reviews;
  const rank = new Map(clients.map((c, i) => [c.clientId, i + 1]));

  const recentList = (
    <section aria-labelledby="recentes-t" className="bg-surface border border-line rounded-2xl overflow-hidden">
      <div className="px-5 pt-4 pb-2.5 flex flex-col gap-0.5">
        <h2 id="recentes-t" className="text-[15px] font-semibold">Resgates recentes</h2>
        <span className="text-[13px] text-ink-3">{s ? `${s.redeemedMonth} em ${month()} · ${s.redeemedMonthPoints} pts usados` : " "}</span>
      </div>
      {!data ? <div className="h-24 animate-pulse bg-surface-3/50" /> : data.recent.length === 0 ? (
        <p className="px-5 pb-4 text-[13px] text-ink-3">Nenhum resgate ainda.</p>
      ) : data.recent.map((r) => {
        const k = spKey(r.at);
        return (
          <div key={r.id} className="flex items-center gap-3 min-h-[52px] px-5 border-t border-line-3">
            <div className="w-[42px] h-[38px] rounded-lg bg-ground flex flex-col items-center justify-center shrink-0">
              <span className="text-sm font-bold leading-none">{k.slice(8, 10)}</span>
              <span className="text-[10px] font-semibold text-ink-3 uppercase">{MONTHS[Number(k.slice(5, 7)) - 1]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{r.name}</p>
              <p className="text-xs text-ink-3 truncate">{r.description ?? "Resgate"}</p>
            </div>
            <span className="text-sm font-bold shrink-0">−{r.points} pts</span>
          </div>
        );
      })}
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Fidelidade</h1>
        <span className="text-sm text-ink-3">Cliente ganha pontos avaliando o atendimento e troca por desconto</span>
      </header>

      <div className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
        {editing && data ? (
          <RulesEditor config={cfg} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
        ) : (
          <section aria-labelledby="regras-t" className="bg-surface border border-line rounded-2xl px-5 py-4 flex flex-col gap-3">
            <div className="flex justify-between items-center gap-3">
              <h2 id="regras-t" className="text-[15px] font-semibold">Regras do programa</h2>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={!data}>Editar regras</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[[`+${cfg.pointsPerReview} pts`, "por avaliação enviada", ""], [`${t} pts`, "para 1 resgate", ""], [`${cfg.loyaltyDiscountPercent}%`, "de desconto", "text-primary"]].map(([v, l, c]) => (
                <div key={l} className="px-3 py-2.5 rounded-[10px] bg-ground flex flex-col gap-0.5 min-w-0">
                  <span className={cn("font-display text-xl md:text-2xl font-bold truncate", c)}>{v}</span>
                  <span className="text-xs text-ink-2">{l}</span>
                </div>
              ))}
            </div>
            <span className="text-xs text-ink-3">O link de avaliação vai no WhatsApp depois do atendimento. {reviewsPerRedeem} avaliaç{reviewsPerRedeem === 1 ? "ão" : "ões"} = 1 desconto.</span>
          </section>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            ["Podem resgatar agora", s?.eligible, `já têm ${t} pts ou mais`, true],
            ["Falta 1 avaliação", s?.near, `estão com ${Math.max(0, t - cfg.pointsPerReview)} pts ou mais`, false],
            ["Clientes com pontos", s?.withPoints, `${(s?.pointsTotal ?? 0).toLocaleString("pt-BR")} pts guardados`, false],
            [`Resgates em ${month()}`, s?.redeemedMonth, `${s?.redeemedMonthPoints ?? 0} pts usados`, false],
          ].map(([l, v, sub, dark]) => (
            <div key={String(l)} className={cn("p-4 rounded-2xl flex flex-col justify-between gap-2 min-h-[118px]", dark ? "bg-ink text-white" : "bg-surface border border-line")}>
              <span className={cn("text-[13px]", dark ? "text-night-text" : "text-ink-3")}>{l}</span>
              <span className="font-display text-[34px] font-bold leading-none">{v ?? "—"}</span>
              <span className={cn("text-xs", dark ? "text-night-text" : "text-ink-3")}>{sub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-5 items-start">
        <section aria-labelledby="ranking-t" className="flex-1 min-w-0 bg-surface border border-line rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-2.5 flex-wrap px-4 py-3.5 border-b border-line-2">
            <h2 id="ranking-t" className="text-[15px] font-semibold">Ranking de pontos</h2>
            <Segmented value={tab} onChange={(v) => { setTab(v); setShown(20); }} label="Filtrar clientes"
              options={[["podem", `Podem resgatar · ${s?.eligible ?? 0}`], ["quase", `Falta 1 avaliação · ${s?.near ?? 0}`], ["todos", `Todos · ${s?.withPoints ?? 0}`]]} />
          </div>
          <div className="px-4 pt-3">
            <label className="flex items-center gap-2.5 h-[42px] px-3 rounded-[10px] border border-control bg-ground">
              <Search className="w-4 h-4 text-ink-3 shrink-0" aria-hidden />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou telefone" aria-label="Buscar cliente" className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
            </label>
          </div>
          <div className="hidden sm:grid grid-cols-[30px_minmax(0,1fr)_180px_116px] gap-3 px-4 pt-3.5 pb-2.5 text-xs font-semibold text-ink-3">
            <span>#</span><span>Cliente</span><span>Pontos</span><span />
          </div>
          {!data ? <div className="h-56 animate-pulse bg-surface-3/50 mt-3" aria-busy /> : filtered.length === 0 ? (
            <div className="px-6 py-10 flex flex-col items-center gap-2 text-center">
              <Award className="w-9 h-9 text-ink-4" aria-hidden />
              <p className="font-semibold">{search ? "Ninguém encontrado" : tab === "podem" ? "Ninguém pode resgatar ainda" : tab === "quase" ? "Ninguém a 1 avaliação do desconto" : "Nenhum cliente com pontos"}</p>
              <p className="text-[13px] text-ink-3">Os pontos entram quando o cliente avalia o atendimento pelo link do WhatsApp.</p>
            </div>
          ) : (
            <div className="mt-1 sm:mt-0">
              {filtered.slice(0, shown).map((c) => {
                const r = rank.get(c.clientId) ?? 0;
                const can = c.balance >= t;
                const on = selected?.clientId === c.clientId;
                const near = !can && c.balance >= t - cfg.pointsPerReview;
                const remind = near ? wa(c.phone, `Oi, ${c.name.split(" ")[0]}! Você está com ${c.balance} pontos no nosso programa de fidelidade. Falta só 1 avaliação para ganhar ${cfg.loyaltyDiscountPercent}% de desconto. É só avaliar o próximo atendimento pelo link que chega no WhatsApp. 😉`) : null;
                return (
                  <div key={c.clientId} onClick={() => can && setSelected(c)}
                    className={cn("grid grid-cols-[30px_minmax(0,1fr)_auto] sm:grid-cols-[30px_minmax(0,1fr)_180px_116px] gap-3 items-center min-h-[62px] px-4 py-2 border-t border-line-3",
                      can && "cursor-pointer", on ? "bg-primary/[0.07]" : can && "hover:bg-surface-3/50")}>
                    <span className={cn("w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center", r === 1 ? "bg-primary text-white" : r <= 3 ? "bg-ink text-white" : "bg-surface-3 text-ink-2")}>{r}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-ink-3 truncate">{c.reviews} avaliaç{c.reviews === 1 ? "ão" : "ões"}{c.lastReviewAt ? ` · última ${shortDate(c.lastReviewAt)}` : ""}</p>
                    </div>
                    <div className="hidden sm:flex flex-col gap-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[15px] font-bold">{c.balance} pts</span>
                        <span className={cn("text-xs", can ? "text-positive font-semibold" : "text-ink-3")}>{can ? "pode resgatar" : `faltam ${t - c.balance} pts`}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-track"><div className={cn("h-full rounded-full", can ? "bg-positive" : "bg-bar")} style={{ width: `${Math.min(100, (c.balance / t) * 100)}%` }} /></div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="sm:hidden text-sm font-bold">{c.balance} pts</span>
                      {can ? (
                        <button type="button" onClick={(e) => { e.stopPropagation(); setSelected(c); }} aria-label={`Resgatar desconto para ${c.name}`}
                          className={cn("h-[34px] px-3 rounded-[9px] text-xs font-semibold", on ? "bg-primary text-white" : "border border-control bg-surface")}>Resgatar</button>
                      ) : remind ? (
                        <a href={remind} target="_blank" rel="noreferrer" aria-label={`Lembrar ${c.name} pelo WhatsApp que falta 1 avaliação`}
                          className="h-[34px] px-3 rounded-[9px] text-xs font-semibold border border-control bg-surface inline-flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" aria-hidden />Lembrar</a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {data && filtered.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-ink-2 bg-ground/60 border-t border-line-2">
              <span>Mostrando {Math.min(shown, filtered.length)} de {filtered.length}</span>
              {filtered.length > shown && <button type="button" onClick={() => setShown((n) => n + 20)} className="font-semibold underline underline-offset-2">Mostrar mais</button>}
            </div>
          )}
        </section>

        {wide && (
          <div className="w-[372px] shrink-0 flex flex-col gap-4">
            {sel && <div className="bg-surface border border-line rounded-2xl overflow-hidden"><RedeemCard key={sel.clientId} client={sel} config={cfg} onChanged={load} /></div>}
            {recentList}
          </div>
        )}
      </div>

      {!wide && recentList}
      {!wide && (
        <SidePanel open={!!sel} wide={false} onClose={() => setSelected(null)} label="Resgate">
          {sel && <RedeemCard key={sel.clientId} client={sel} config={cfg} onChanged={load} />}
        </SidePanel>
      )}

      <section aria-labelledby="aval-t" className="bg-surface border border-line rounded-2xl grid lg:grid-cols-[300px_minmax(0,0.8fr)_minmax(0,1.2fr)] divide-y lg:divide-y-0 lg:divide-x divide-line-2">
        <div className="px-5 py-5 flex flex-col gap-3">
          <h2 id="aval-t" className="text-[15px] font-semibold">O que os clientes acham</h2>
          {!rv || rv.count === 0 ? <p className="text-[13px] text-ink-3">Nenhuma avaliação em {month()} ainda.</p> : (
            <>
              <div className="flex items-baseline gap-3.5">
                <div className="flex flex-col"><span className="font-display text-[44px] font-bold tracking-[-0.03em] leading-none">{rv.nps}</span><span className="text-xs text-ink-3">NPS</span></div>
                <div className="flex flex-col"><span className="font-display text-[30px] font-bold leading-tight">{num(rv.avg ?? 0)}</span><span className="text-xs text-ink-3">nota média</span></div>
                <span className={cn("self-center h-6 px-2.5 rounded-full text-xs font-semibold inline-flex items-center",
                  (rv.nps ?? 0) >= 75 ? "bg-positive-soft text-positive" : (rv.nps ?? 0) >= 50 ? "bg-surface-2 text-ink-2" : "bg-danger-soft text-danger")}>
                  {(rv.nps ?? 0) >= 75 ? "Excelente" : (rv.nps ?? 0) >= 50 ? "Muito bom" : (rv.nps ?? 0) >= 0 ? "Precisa melhorar" : "Crítico"}
                </span>
              </div>
              <span className="text-[13px] text-ink-2">{rv.count} avaliaç{rv.count === 1 ? "ão" : "ões"} em {month()} · {rv.pointsGiven.toLocaleString("pt-BR")} pts dados</span>
              <div className="flex h-3 rounded-md overflow-hidden gap-0.5" aria-hidden>
                {rv.promoters > 0 && <div className="bg-positive" style={{ flex: rv.promoters }} />}
                {rv.passives > 0 && <div className="bg-night-text" style={{ flex: rv.passives }} />}
                {rv.detractors > 0 && <div className="bg-danger-strong" style={{ flex: rv.detractors }} />}
              </div>
              <div className="flex justify-between text-xs text-ink-2 gap-2">
                <span><strong className="text-positive">{rv.promoters}</strong> nota 9–10</span>
                <span><strong>{rv.passives}</strong> nota 7–8</span>
                <span><strong className="text-danger">{rv.detractors}</strong> até 6</span>
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-5 flex flex-col gap-2.5">
          <span className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Nota por profissional</span>
          {!rv?.byBarber.length ? <p className="text-[13px] text-ink-3">Sem avaliações no mês.</p> : rv.byBarber.map((b) => (
            <div key={b.id} className="flex items-center gap-2.5 min-h-10">
              <div className="w-8 h-8 rounded-full bg-surface-2 text-ink-2 text-xs font-bold flex items-center justify-center shrink-0">{getInitials(b.name)}</div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex justify-between text-[13px] gap-2"><span className="font-semibold truncate">{b.name}</span><span className="text-ink-3 shrink-0">{b.count} avaliaç{b.count === 1 ? "ão" : "ões"}</span></div>
                <div className="h-1.5 rounded-full bg-track"><div className="h-full rounded-full bg-ink" style={{ width: `${b.avg * 10}%` }} /></div>
              </div>
              <span className="w-9 text-right text-[15px] font-bold">{num(b.avg)}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-5 flex flex-col gap-1">
          <span className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3 pb-1.5">Últimos comentários</span>
          {!rv?.comments.length ? <p className="text-[13px] text-ink-3">Nenhum comentário ainda.</p> : rv.comments.map((c) => {
            const low = c.rating <= 6;
            const reply = low ? wa(c.phone, `Oi, ${c.client.split(" ")[0]}! Vi sua avaliação e queria entender melhor o que aconteceu. Pode me contar?`) : null;
            return (
              <div key={c.id} className="flex gap-3 py-2.5 border-t border-line-3 first-of-type:border-t-0">
                <span className={cn("w-[34px] h-[34px] rounded-[9px] text-[15px] font-bold flex items-center justify-center shrink-0",
                  c.rating >= 9 ? "bg-positive-soft text-positive" : c.rating >= 7 ? "bg-surface-2 text-ink" : "bg-danger-soft text-danger")}>{c.rating}</span>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-sm leading-snug">{c.comment}</span>
                  <span className="text-xs text-ink-3">{c.client}{c.barber ? ` · com ${c.barber}` : ""} · {shortDate(c.at)}</span>
                </div>
                {reply && <a href={reply} target="_blank" rel="noreferrer" aria-label={`Responder ${c.client} pelo WhatsApp`} className="self-center h-9 px-2.5 rounded-[9px] border border-control text-[13px] font-semibold inline-flex items-center">Responder</a>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function RulesEditor({ config, onClose, onSaved }: { config: Config; onClose: () => void; onSaved: () => void }) {
  const { token } = useAuthStore();
  const [threshold, setThreshold] = useState(String(config.loyaltyThreshold));
  const [discount, setDiscount] = useState(String(config.loyaltyDiscountPercent));
  const [saving, setSaving] = useState(false);
  const n = Number(threshold);
  const reviews = n > 0 ? Math.ceil(n / config.pointsPerReview) : 0;

  async function save() {
    setSaving(true);
    const r = await fetch("/api/barbershop/fidelidade", {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ loyaltyThreshold: n, loyaltyDiscountPercent: Number(discount.replace(",", ".")) }),
    });
    setSaving(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível salvar."); return; }
    toast.success("Regras salvas");
    onSaved();
  }

  return (
    <section aria-label="Editar regras" className="bg-surface border border-primary rounded-2xl px-5 py-4 flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold">Editar regras</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pontos para 1 resgate" suffix="pts" value={threshold} onChange={(e) => setThreshold(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
        <Field label="Desconto" suffix="%" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" />
      </div>
      <p className="text-xs text-ink-3">
        Cada avaliação vale +{config.pointsPerReview} pts{reviews > 0 ? `, então o cliente precisa de ${reviews} avaliaç${reviews === 1 ? "ão" : "ões"} para 1 desconto` : ""}. Quem já tem pontos continua com eles.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button size="sm" loading={saving} onClick={save}>Salvar regras</Button>
      </div>
    </section>
  );
}

function RedeemCard({ client, config, onChanged }: { client: Client; config: Config; onChanged: () => void }) {
  const { token } = useAuthStore();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [done, setDone] = useState<{ id: string; balance: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const h = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const t = config.loyaltyThreshold;

  useEffect(() => {
    fetch(`/api/barbershop/fidelidade?clientId=${client.clientId}`, { headers: h }).then((r) => r.json()).then((d) => { if (!d.error) setDetail(d); }).catch(() => {});
  }, [client.clientId, h]);

  const balance = done ? done.balance : detail?.balance ?? client.balance;
  const can = !done && balance >= t;

  async function redeem() {
    setBusy(true);
    const r = await fetch("/api/barbershop/fidelidade", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ clientId: client.clientId }) });
    setBusy(false);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d.error ?? "Não foi possível resgatar."); return; }
    setDone({ id: d.entry.id, balance: d.newBalance });
    onChanged();
  }
  async function undo() {
    if (!done) return;
    setBusy(true);
    const r = await fetch(`/api/barbershop/fidelidade?id=${done.id}`, { method: "DELETE", headers: h });
    setBusy(false);
    if (!r.ok) { toast.error("Não foi possível desfazer."); return; }
    toast.success("Resgate desfeito, pontos devolvidos");
    setDone(null);
    onChanged();
  }

  const next = detail?.next;
  const nextText = next
    ? `${shortDate(next.date)} às ${next.startTime}`
    : detail ? "Nenhum horário marcado" : "…";
  const nextSub = next ? [next.services.map((s) => s.service.name).join(" + "), next.barber ? `com ${next.barber.nickname || next.barber.user.name.split(" ")[0]}` : ""].filter(Boolean).join(" ") : detail ? "O desconto vale no próximo atendimento que ele fizer." : "";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-[18px] pb-3.5 pr-12 xl:pr-5">
        <div className="w-12 h-12 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0">{getInitials(client.name)}</div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-xl font-bold truncate">{client.name}</h2>
          <span className="text-[13px] text-ink-3">{client.phone ?? "sem telefone"}</span>
        </div>
      </div>

      {done && (
        <div role="status" className="mx-5 p-3 rounded-xl bg-positive-soft border border-positive/25 flex gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-positive shrink-0 mt-0.5" aria-hidden />
          <span className="text-[13px] text-positive leading-snug">Resgate confirmado! {client.name.split(" ")[0]} ganhou {config.loyaltyDiscountPercent}% de desconto. Aplique na comanda do próximo atendimento. Saldo restante: {done.balance} pts.</span>
        </div>
      )}

      <div className="mx-5 mt-3.5 p-3.5 rounded-xl bg-ground flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline"><span className="text-[13px] text-ink-2">Saldo</span><span className="font-display text-[26px] font-bold">{balance} pts</span></div>
        <div className="flex flex-col border-t border-line text-sm">
          <div className="flex justify-between min-h-[34px] items-center border-b border-line"><span className="text-ink-3">Desconto</span><span className="font-semibold">{config.loyaltyDiscountPercent}% no próximo atendimento</span></div>
          <div className="flex justify-between min-h-[34px] items-center border-b border-line"><span className="text-ink-3">Sai do saldo</span><span className="font-semibold">{t} pts</span></div>
          <div className="flex justify-between min-h-[34px] items-center"><span className="text-ink-3">Fica com</span><span className="font-semibold">{done ? `${done.balance} pts (já descontado)` : `${Math.max(0, balance - t)} pts`}</span></div>
        </div>
      </div>

      <div className="mx-5 mt-3 flex flex-col gap-1">
        <span className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Próximo horário</span>
        <span className="text-sm font-semibold">{nextText}</span>
        {nextSub && <span className="text-[13px] text-ink-2">{nextSub}</span>}
      </div>

      <div className="flex gap-2 px-5 pt-4 pb-[18px] mt-3.5 border-t border-line-2">
        {done ? (
          <Button variant="outline" className="flex-1" loading={busy} onClick={undo}>Desfazer</Button>
        ) : (
          <Button className="flex-1" loading={busy} disabled={!can} onClick={redeem}>{can ? "Confirmar resgate" : `Faltam ${t - balance} pts`}</Button>
        )}
      </div>
    </div>
  );
}
