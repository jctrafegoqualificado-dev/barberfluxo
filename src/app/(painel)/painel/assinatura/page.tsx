"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Check, Copy, Lock, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn, getInitials } from "@/lib/utils";
import Button from "@/components/ui/Button";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MercadoPago: any;
  }
}

type PaidPlan = "PRO" | "ELITE";
type Cycle = "monthly" | "annual";
interface PlanInfo { key: PaidPlan; label: string; tagline: string; hasAI: boolean; monthlyPrice: number; annualPriceMonthly: number | null }
interface Data {
  name: string;
  current: {
    plan: string; label: string | null; isPaid: boolean; status: string;
    reason: "active" | "grace" | "overdue" | "cancelled" | "none"; hasAccess: boolean;
    expiresAt: string | null; graceUntil: string | null;
  };
  plans: PlanInfo[];
  payments: { id: string; amount: number; method: string; status: string; paidAt: string | null; createdAt: string }[];
  barbers: { id: string; name: string }[];
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const longDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(".", "");
const METHOD: Record<string, string> = { PIX: "Pix", CREDIT_CARD: "cartão de crédito", DEBIT_CARD: "cartão de débito", BOLETO: "boleto", ACCOUNT_MONEY: "saldo Mercado Pago", CASH: "dinheiro" };
const PAY_STATUS: Record<string, [string, string]> = {
  PAID: ["Paga", "bg-positive-soft text-positive"], PENDING: ["Pendente", "bg-warning-soft text-warning"],
  FAILED: ["Recusada", "bg-danger-soft text-danger"], REFUNDED: ["Estornada", "bg-surface-2 text-ink-2"],
};
const ITEMS: Record<PaidPlan, [string, boolean][]> = {
  PRO: [["Agenda e agendamento online", true], ["Comissões, vales e recibos", true], ["Caixa e resultado do mês", true], ["Planos de assinatura para clientes", true], ["Atendente de IA e lembretes no WhatsApp", false]],
  ELITE: [["Tudo do plano Gestão", true], ["Atendente de IA no WhatsApp, 24 horas", true], ["Agendamento pela conversa", true], ["Lembretes e confirmação pelo WhatsApp", true], ["Passa a conversa para você quando precisa", true]],
};

const price = (p: PlanInfo, c: Cycle) => (c === "annual" && p.annualPriceMonthly != null ? p.annualPriceMonthly : p.monthlyPrice);
const charge = (p: PlanInfo, c: Cycle) => (c === "annual" && p.annualPriceMonthly != null ? Math.round(p.annualPriceMonthly * 12 * 100) / 100 : p.monthlyPrice);

export default function MinhaAssinaturaPage() {
  const { token, user } = useAuthStore();
  const params = useSearchParams();
  const planParam = (params.get("plano") ?? "").toUpperCase();
  const isNew = params.get("novo") === "true";
  const autoRef = useRef(false);

  const [d, setD] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [mpLoaded, setMpLoaded] = useState(false);
  const [checkout, setCheckout] = useState<{ plan: PaidPlan; cycle: Cycle } | null>(null);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<null | "approved" | "pending" | "rejected">(null);
  const [pix, setPix] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/barbershop/minha-assinatura", { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json().catch(() => null);
      if (r.ok && data) setD(data); else setLoadError(true);
    } catch {
      setLoadError(true);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  async function startCheckout(plan: PaidPlan, c: Cycle) {
    const info = d?.plans.find((p) => p.key === plan);
    if (!info) return;
    if (!window.MercadoPago || !process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
      toast.error("O pagamento está indisponível agora. Fale com o suporte para assinar.");
      return;
    }
    setCheckout({ plan, cycle: c });
    setResult(null);
    setPix(null);
    setOpening(true);
    const box = document.getElementById("paymentBrick_container");
    if (box) { box.innerHTML = ""; box.classList.remove("hidden"); }
    const amount = charge(info, c);
    const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
    await mp.bricks().create("payment", "paymentBrick_container", {
      initialization: { amount, payer: { email: user?.email } },
      customization: { paymentMethods: { ticket: "all", bankTransfer: "all", creditCard: "all", debitCard: "all", mercadoPago: "all" } },
      callbacks: {
        onReady: () => {
          setOpening(false);
          document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSubmit: async ({ formData }: any) => {
          try {
            const r = await fetch("/api/payments/process-saas", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ...formData, planType: plan, billingCycle: c }),
            });
            const out = await r.json();
            if (out.error) {
              setResult("rejected");
              toast.error(`O Mercado Pago recusou: ${out.error}`);
            } else if (out.status === "approved") {
              setResult("approved");
              load();
            } else if (out.status === "pending" || out.status === "in_process") {
              setResult("pending");
              if (out.qr_code) {
                setPix({ qr_code: out.qr_code, qr_code_base64: out.qr_code_base64 });
                document.getElementById("paymentBrick_container")?.classList.add("hidden");
              }
            } else setResult("rejected");
          } catch {
            setResult("rejected");
          }
        },
        onError: () => setOpening(false),
      },
    });
  }

  // Veio do cadastro com um plano escolhido (/cadastro?plano=X): abre o pagamento sozinho
  useEffect(() => {
    if (mpLoaded && d && isNew && (planParam === "PRO" || planParam === "ELITE") && !autoRef.current) {
      autoRef.current = true;
      startCheckout(planParam, cycle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpLoaded, d]);

  const head = (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-[26px] md:text-[32px] font-bold tracking-[-0.02em] leading-tight">Minha assinatura</h1>
      <span className="text-sm text-ink-3">O que {d?.name ?? "a barbearia"} paga pelo IA de Barbearia · sem fidelidade e sem multa</span>
    </header>
  );

  if (loadError) {
    return (
      <div className="flex flex-col gap-5">
        {head}
        <div role="alert" className="rounded-2xl bg-danger-soft text-danger px-5 py-4 text-sm">
          Não foi possível carregar sua assinatura. <button type="button" onClick={() => location.reload()} className="font-semibold underline">Tentar de novo</button>
        </div>
      </div>
    );
  }
  if (!d) {
    return <div className="flex flex-col gap-5">{head}<div className="h-72 rounded-2xl bg-surface border border-line animate-pulse" /></div>;
  }

  const cur = d.current;
  const curPlan = d.plans.find((p) => p.key === cur.plan) ?? null;
  const active = cur.reason === "active";
  // Depois da carência o cron rebaixa para BASIC, mas o status continua OVERDUE: ainda é "venceu", não "nunca assinou"
  const lapsed = cur.reason === "overdue" || cur.reason === "cancelled" || (cur.isPaid && cur.reason === "none");
  const neverPaid = !lapsed && !cur.isPaid;
  const lastPaid = d.payments.find((p) => p.status === "PAID");

  return (
    <div className="flex flex-col gap-5">
      <Script src="https://sdk.mercadopago.com/js/v2" onLoad={() => setMpLoaded(true)} />
      {head}

      {lapsed && cur.expiresAt && (
        <section role="alert" className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4 rounded-2xl bg-danger-soft border border-danger/20">
          <span className="w-11 h-11 shrink-0 rounded-xl bg-danger-strong text-white flex items-center justify-center"><Lock className="w-5 h-5" aria-hidden /></span>
          <div className="flex-1 flex flex-col gap-1 text-danger">
            <h2 className="text-[17px] font-bold">Acesso pausado: o plano venceu em {longDate(cur.expiresAt)}</h2>
            <span className="text-sm leading-normal">Agenda, caixa e atendente de IA ficam pausados até o pagamento. Seus clientes e dados continuam guardados. Pagou, liberou na hora.</span>
          </div>
          {curPlan && <Button onClick={() => startCheckout(curPlan.key, cycle)} loading={opening} className="h-[46px] shrink-0">Renovar {brl(charge(curPlan, cycle))}</Button>}
        </section>
      )}
      {cur.reason === "grace" && cur.expiresAt && cur.graceUntil && (
        <section role="alert" className="px-5 py-4 rounded-2xl bg-warning-soft text-warning text-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="flex-1"><strong>O plano venceu em {longDate(cur.expiresAt)}.</strong> Renove até {longDate(cur.graceUntil)} para não pausar o acesso.</span>
          {curPlan && <Button onClick={() => startCheckout(curPlan.key, cycle)} loading={opening} className="shrink-0">Renovar agora</Button>}
        </section>
      )}
      {neverPaid && (
        <section className="px-5 py-4 rounded-2xl bg-warning-soft text-warning text-sm">
          <strong>Escolha um plano para começar a usar.</strong> O acesso libera assim que o pagamento é aprovado.
        </section>
      )}

      {cur.isPaid && curPlan && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-labelledby="plano-t" className="rounded-2xl bg-[#1B1916] text-white px-[22px] py-5 flex flex-col gap-3.5">
            <div className="flex justify-between items-start gap-2.5">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold tracking-[0.06em] uppercase text-[#C9C2B6]">Seu plano</span>
                <h2 id="plano-t" className="font-display text-[22px] font-bold">{curPlan.label}</h2>
              </div>
              <span className={cn("h-[26px] px-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap",
                active ? "bg-[#23372B] text-[#BFE3CC]" : "bg-[#4A1F1A] text-[#F6C7C1]")}>
                <span className={cn("w-[7px] h-[7px] rounded-full", active ? "bg-[#4CC38A]" : "bg-[#F0776B]")} />
                {active ? "Em dia" : cur.reason === "grace" ? "Vencido · em carência" : "Pagamento atrasado"}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="font-display text-[40px] font-bold tracking-[-0.02em] leading-none">{brl(curPlan.monthlyPrice)}</span>
              <span className="text-sm text-[#C9C2B6]">por mês no plano mensal</span>
            </div>
            {lastPaid && (
              <span className="text-[13px] text-[#C9C2B6]">Último pagamento: {brl(lastPaid.amount)} em {shortDate(lastPaid.paidAt ?? lastPaid.createdAt)}</span>
            )}
            {cur.expiresAt && (
              <div className="mt-auto flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-night-3 text-sm">
                <CalendarDays className={cn("w-[17px] h-[17px] shrink-0", active ? "text-[#C9C2B6]" : "text-[#F0776B]")} aria-hidden />
                <span>{active ? `Pago até ${longDate(cur.expiresAt)}` : `Venceu em ${longDate(cur.expiresAt)}`}</span>
              </div>
            )}
          </section>

          <section aria-labelledby="barb-t" className="bg-surface border border-line rounded-2xl px-5 py-[18px] flex flex-col gap-3">
            <div className="flex justify-between items-baseline">
              <h2 id="barb-t" className="text-[15px] font-semibold">Barbeiros na conta</h2>
              <span className="text-[13px] text-ink-3">{d.barbers.length}</span>
            </div>
            <div className="flex flex-col">
              {d.barbers.slice(0, 5).map((b, i) => (
                <div key={b.id} className={cn("flex items-center gap-2.5 min-h-[42px]", i > 0 && "border-t border-line-2")}>
                  <span className="w-[30px] h-[30px] rounded-full bg-surface-2 text-ink-2 text-[11px] font-bold flex items-center justify-center shrink-0">{getInitials(b.name)}</span>
                  <span className="flex-1 text-sm font-semibold truncate">{b.name}</span>
                </div>
              ))}
              {d.barbers.length > 5 && <span className="text-[13px] text-ink-3 pt-1">e mais {d.barbers.length - 5}</span>}
              {d.barbers.length === 0 && <span className="text-[13px] text-ink-3">Nenhum profissional cadastrado.</span>}
            </div>
            <span className="mt-auto text-[13px] leading-snug text-ink-2">O plano cobre a equipe toda: não há valor extra por barbeiro.</span>
            <Link href="/painel/barbeiros" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2 w-fit">Ver profissionais</Link>
          </section>

          <section aria-labelledby="pag-t" className="bg-surface border border-line rounded-2xl px-5 py-[18px] flex flex-col gap-3">
            <h2 id="pag-t" className="text-[15px] font-semibold">Como você paga</h2>
            <div className="flex flex-col text-[13px] text-ink-2">
              <div className="flex justify-between gap-3 min-h-[34px] items-center border-b border-line-2"><span>Renovação</span><span className="font-semibold text-ink text-right">você paga a cada período</span></div>
              <div className="flex justify-between gap-3 min-h-[34px] items-center border-b border-line-2"><span>Formas</span><span className="font-semibold text-ink text-right">Pix, cartão ou boleto</span></div>
              <div className="flex justify-between gap-3 min-h-[34px] items-center"><span>Aviso</span><span className="font-semibold text-ink text-right">no WhatsApp, 3 dias antes</span></div>
            </div>
            <span className="text-[13px] leading-snug text-ink-3">Não guardamos cartão e não há cobrança automática. Renovar antes do vencimento soma ao tempo que ainda falta.</span>
            <Button onClick={() => startCheckout(curPlan.key, cycle)} loading={opening && checkout?.plan === curPlan.key} variant="outline" className="mt-auto">
              Renovar agora
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-ink-3"><ShieldCheck className="w-3.5 h-3.5" aria-hidden />Pagamento processado pelo Mercado Pago</span>
          </section>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_372px] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <section aria-labelledby="troca-t" className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex flex-wrap justify-between items-center gap-4 px-5 md:px-[22px] py-[18px] border-b border-line-2">
              <div className="flex flex-col gap-0.5">
                <h2 id="troca-t" className="text-[17px] font-semibold">{cur.isPaid ? "Mudar de plano" : "Escolha seu plano"}</h2>
                <span className="text-[13px] text-ink-3">Sem multa e sem taxa. Vale assim que o pagamento é aprovado.</span>
              </div>
              <div role="group" aria-label="Forma de cobrança" className="flex p-1 gap-0.5 rounded-[10px] bg-track">
                {([["monthly", "Mensal"], ["annual", "Anual"]] as [Cycle, string][]).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={cycle === k} onClick={() => setCycle(k)}
                    className={cn("h-9 px-3.5 rounded-[7px] text-[13px] font-semibold flex items-center gap-1.5", cycle === k ? "bg-surface text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2")}>
                    {l}{k === "annual" && <span className="h-5 px-1.5 rounded-full bg-positive-soft text-positive text-[11px] font-bold flex items-center">-10%</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2 px-5 md:px-[22px] py-[18px]">
              {d.plans.map((p) => {
                const isCurrent = cur.isPaid && p.key === cur.plan;
                const chosen = checkout?.plan === p.key;
                const total = charge(p, cycle);
                const downgrade = cur.isPaid && cur.plan === "ELITE" && p.key === "PRO";
                return (
                  <div key={p.key} className={cn("flex flex-col gap-3 p-[18px] rounded-[14px] border",
                    chosen ? "border-primary ring-1 ring-primary" : isCurrent ? "border-ink ring-1 ring-ink" : "border-line")}>
                    <div className="flex justify-between items-center gap-2 min-h-[26px]">
                      <span className="text-base font-bold">{p.label}</span>
                      {isCurrent && <span className="h-6 px-2.5 rounded-full bg-ink text-white text-xs font-semibold flex items-center">Seu plano</span>}
                    </div>
                    <span className="text-[13px] leading-snug text-ink-3 min-h-[38px]">{p.tagline}</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-baseline gap-1.5"><span className="font-display text-[30px] font-bold leading-tight">{brl(price(p, cycle))}</span><span className="text-[13px] text-ink-3">/mês</span></span>
                      <span className="text-xs text-ink-2">
                        {cycle === "annual" && p.annualPriceMonthly != null ? `cobrado uma vez por ano: ${brl(total)}` : "cobrado a cada mês"}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2 pt-3 border-t border-line-2">
                      {ITEMS[p.key].map(([t, ok]) => (
                        <li key={t} className={cn("flex items-center gap-2 text-[13px]", ok ? "text-ink" : "text-ink-4")}>
                          {ok ? <Check className="w-[15px] h-[15px] shrink-0 text-positive" strokeWidth={2.6} aria-hidden /> : <X className="w-[15px] h-[15px] shrink-0" aria-hidden />}
                          {t}
                        </li>
                      ))}
                    </ul>
                    {downgrade && <span className="text-xs font-semibold text-danger">O atendente de IA e os lembretes param assim que o pagamento for aprovado.</span>}
                    <Button onClick={() => startCheckout(p.key, cycle)} loading={opening && chosen} variant={isCurrent ? "outline" : "primary"} className="mt-1 h-11">
                      {isCurrent ? `Renovar · ${brl(total)}` : cur.isPaid ? `Mudar para ${p.label}` : `Assinar · ${brl(total)}`}
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Pagamento (Mercado Pago) */}
          <section id="checkout" aria-label="Pagamento" className={cn("bg-surface border border-line rounded-2xl overflow-hidden scroll-mt-6", !checkout && "hidden")}>
            {checkout && (() => {
              const p = d.plans.find((x) => x.key === checkout.plan)!;
              return (
                <div className="flex flex-wrap justify-between items-center gap-3 px-5 md:px-[22px] py-4 border-b border-line-2 bg-ground/60">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold tracking-[0.06em] uppercase text-ink-3">Pagamento</span>
                    <span className="text-[15px] font-semibold">{p.label} · {checkout.cycle === "annual" ? "anual" : "mensal"}</span>
                  </div>
                  <span className="font-display text-2xl font-bold">{brl(charge(p, checkout.cycle))}</span>
                </div>
              );
            })()}
            <div className="px-5 md:px-[22px] py-5">
              {result === "approved" ? (
                <div className="flex flex-col items-center text-center gap-3 py-6">
                  <span className="w-14 h-14 rounded-full bg-positive-soft text-positive flex items-center justify-center"><Check className="w-7 h-7" aria-hidden /></span>
                  <h3 className="text-lg font-semibold">Pagamento aprovado</h3>
                  <p className="text-sm text-ink-2">Seu plano já está valendo.</p>
                  <Button onClick={() => location.assign("/painel")}>Ir para o painel</Button>
                </div>
              ) : (
                <>
                  {result === "rejected" && <p role="alert" className="mb-4 px-3.5 py-3 rounded-xl bg-danger-soft text-danger text-sm">O pagamento não foi aprovado. Confira os dados ou tente outra forma.</p>}
                  {pix && (
                    <div className="flex flex-col items-center gap-4 mb-2">
                      <p className="text-sm text-ink-2 text-center">Pague com o Pix abaixo. A assinatura libera sozinha assim que o pagamento cair.</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`data:image/jpeg;base64,${pix.qr_code_base64}`} alt="QR Code do Pix" className="w-56 h-56 rounded-xl border border-line" />
                      <div className="w-full flex gap-2">
                        <input readOnly value={pix.qr_code} aria-label="Pix copia e cola" className="flex-1 min-w-0 h-11 rounded-[10px] border border-control bg-surface-2 px-3 text-xs font-mono text-ink-2" />
                        <Button variant="outline" onClick={() => { navigator.clipboard.writeText(pix.qr_code); toast.success("Código copiado"); }}>
                          <Copy className="w-4 h-4 mr-1.5" aria-hidden />Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                  <div id="paymentBrick_container" className="min-h-[200px]" />
                </>
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section aria-labelledby="fat-t" className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="flex justify-between items-baseline px-5 pt-[18px] pb-2.5">
              <h2 id="fat-t" className="text-[15px] font-semibold">Cobranças</h2>
              <span className="text-xs text-ink-3">últimas {Math.min(d.payments.length, 12) || ""}</span>
            </div>
            {d.payments.length === 0 && <p className="px-5 pb-5 text-[13px] text-ink-3">Nenhuma cobrança ainda.</p>}
            {d.payments.map((p) => {
              const [label, cls] = PAY_STATUS[p.status] ?? [p.status, "bg-surface-2 text-ink-2"];
              return (
                <div key={p.id} className="flex items-center gap-2.5 min-h-[60px] px-5 border-t border-line-2">
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{shortDate(p.paidAt ?? p.createdAt)}</span>
                    <span className="text-xs text-ink-3 truncate">{METHOD[p.method] ? `Pago com ${METHOD[p.method]}` : p.method}</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold">{brl(p.amount)}</span>
                    <span className={cn("h-5 px-2 rounded-full text-[11px] font-semibold flex items-center", cls)}>{label}</span>
                  </div>
                </div>
              );
            })}
          </section>

          {cur.isPaid && (
            <section aria-labelledby="canc-t" className="bg-surface border border-line rounded-2xl px-5 py-4 flex flex-col gap-1.5">
              <h2 id="canc-t" className="text-[15px] font-semibold">Quer parar de usar?</h2>
              <span className="text-[13px] leading-normal text-ink-2">
                Não precisa cancelar nada: não há cobrança automática nem multa.
                {cur.expiresAt && active ? ` Se não renovar, o acesso continua até ${longDate(cur.expiresAt)}` : " Se não renovar, o acesso pausa"} e seus dados ficam guardados, caso queira voltar.
              </span>
            </section>
          )}
        </div>
      </div>

      <style jsx global>{`
        #paymentBrick_container .mp-brick-button { border-radius: 12px !important; font-weight: 600 !important; }
      `}</style>
    </div>
  );
}
