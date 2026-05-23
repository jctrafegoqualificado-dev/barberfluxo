"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Brain,
  ShieldCheck,
  MessageSquare,
  TrendingUp,
  Rocket,
  Star,
  X,
  Bot,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Script from "next/script";

declare global {
  interface Window {
    MercadoPago: any;
  }
}

type BillingCycle = "monthly" | "annual";

const PLAN_CONFIG = {
  PRO: {
    monthlyPrice: 154.9,
    annualPrice: 139.9, // preço mensal equivalente no plano anual
    label: "Gestão",
    tagline: "Gestão profissional completa",
    dbValue: "PRO" as const,
    annualSavings: 180, // (154.90 - 139.90) * 12
  },
  ELITE: {
    monthlyPrice: 197.9,
    annualPrice: 179.9,
    label: "Gestão + Assistente",
    tagline: "Inteligência Artificial a seu favor",
    dbValue: "ELITE" as const,
    annualSavings: 216, // (197.90 - 179.90) * 12
  },
} as const;

type PaidPlan = keyof typeof PLAN_CONFIG;

export default function AssinaturaSaaSPage() {
  const { token, user } = useAuthStore();
  const searchParams = useSearchParams();
  const trialExpired = searchParams.get("trial") === "expired";

  const [loading, setLoading] = useState(false);
  const [mpLoaded, setMpLoaded] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<null | "approved" | "pending" | "rejected">(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PaidPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);

  useEffect(() => {
    fetch("/api/barbershop/financeiro", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setCurrentPlan(data.saasPlan || "BASIC"));
  }, [token]);

  const normalizedPlan = currentPlan === "PREMIUM" ? "ELITE" : currentPlan;
  const isPaidUser = normalizedPlan === "PRO" || normalizedPlan === "ELITE";

  const getPrice = (plan: PaidPlan, cycle: BillingCycle) =>
    cycle === "annual" ? PLAN_CONFIG[plan].annualPrice * 12 : PLAN_CONFIG[plan].monthlyPrice;

  const handleUpgrade = async (plan: PaidPlan) => {
    if (!window.MercadoPago) return;

    if (!process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
      alert("Checkout em manutenção. Entre em contato pelo WhatsApp para assinar ou aguarde alguns instantes.");
      return;
    }

    setSelectedPlan(plan);
    setLoading(true);

    const container = document.getElementById("paymentBrick_container");
    if (container) container.innerHTML = "";

    const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
    const bricksBuilder = mp.bricks();
    const config = PLAN_CONFIG[plan];
    const price = getPrice(plan, billingCycle);

    const settings = {
      initialization: {
        amount: price,
        payer: { email: user?.email },
      },
      customization: {
        paymentMethods: {
          ticket: "all",
          bankTransfer: "all",
          creditCard: "all",
          debitCard: "all",
          mercadoPago: "all",
        },
      },
      callbacks: {
        onReady: () => {
          setLoading(false);
          const section = document.getElementById("checkout_section");
          if (section) section.classList.remove("hidden");
          section?.scrollIntoView({ behavior: "smooth" });
        },
        onSubmit: async ({ formData }: any) => {
          return new Promise((resolve, reject) => {
            fetch("/api/payments/process-saas", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                ...formData,
                planType: config.dbValue,
                billingCycle,
              }),
            })
              .then((response) => response.json())
              .then((result) => {
                if (result.error) {
                  console.error("Erro MP API:", result.error, result.details);
                  setPaymentStatus("rejected");
                  alert("Ops! O Mercado Pago recusou: " + result.error);
                  resolve(null);
                  return;
                }

                if (result.status === "approved") {
                  setPaymentStatus("approved");
                  setCurrentPlan(config.dbValue);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else if (result.status === "pending" || result.status === "in_process") {
                  setPaymentStatus("pending");
                  if (result.qr_code) {
                    setPixData({ qr_code: result.qr_code, qr_code_base64: result.qr_code_base64 });
                    document.getElementById("paymentBrick_container")?.classList.add("hidden");
                  }
                } else {
                  setPaymentStatus("rejected");
                }
                resolve(null);
              })
              .catch((error) => {
                console.error("Erro no pagamento:", error);
                reject();
              });
          });
        },
        onError: (error: any) => {
          console.error("Erro no Brick:", error);
          setLoading(false);
        },
      },
    };

    await bricksBuilder.create("payment", "paymentBrick_container", settings);
  };

  /* =====================================================
     TELA PÓS-ASSINATURA (Usuário já é Gestão ou Gestão + Assistente)
  ====================================================== */
  if (isPaidUser) {
    const isElite = normalizedPlan === "ELITE";
    const planLabel = isElite ? "Gestão + Assistente" : "Gestão";

    return (
      <div className="max-w-4xl mx-auto py-12 px-6 text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
          isElite ? "bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20" : "bg-primary/10"
        }`}>
          {isElite ? (
            <Brain className="w-10 h-10 text-violet-500" />
          ) : (
            <Rocket className="w-10 h-10 text-primary" />
          )}
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">
          Plano {planLabel} ativo! {isElite ? "🧠" : "🚀"}
        </h1>
        <p className="text-zinc-500 mb-8 text-lg">
          {isElite
            ? "Seu estabelecimento tem acesso total com Inteligência Artificial integrada."
            : "Seu estabelecimento tem acesso a todas as ferramentas profissionais."}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {(isElite
            ? [
                { icon: Brain, title: "IA Integrada", desc: "Previsões de demanda, insights automáticos e sugestões inteligentes." },
                { icon: MessageSquare, title: "WhatsApp Ilimitado", desc: "Envie lembretes e campanhas de marketing sem limites." },
                { icon: ShieldCheck, title: "Suporte VIP", desc: "Atendimento prioritário pela nossa equipe." },
              ]
            : [
                { icon: MessageSquare, title: "WhatsApp Ilimitado", desc: "Envie lembretes e marketing sem limites." },
                { icon: TrendingUp, title: "Dashboard Avançado", desc: "Métricas profundas de lucro e ocupação." },
                { icon: ShieldCheck, title: "Suporte Prioritário", desc: "Atendimento pela nossa equipe." },
              ]
          ).map((item, i) => (
            <Card key={i} className="p-6">
              <item.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-bold text-zinc-900 mb-1">{item.title}</h3>
              <p className="text-sm text-zinc-500">{item.desc}</p>
            </Card>
          ))}
        </div>

        {normalizedPlan === "PRO" && (
          <div className="mt-12 bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-2xl border border-violet-200 p-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-violet-600" />
              <h3 className="font-bold text-violet-900">Quer desbloquear o poder da IA?</h3>
            </div>
            <p className="text-sm text-violet-700 mb-4">
              Faça upgrade para <strong>Gestão + Assistente</strong> e tenha previsões de demanda, insights automáticos e muito mais.
            </p>
            <Button
              variant="primary"
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => handleUpgrade("ELITE")}
              loading={loading}
            >
              <Brain className="w-4 h-4 mr-2" /> Upgrade para Gestão + Assistente — R$ 197,90/mês
            </Button>
          </div>
        )}
      </div>
    );
  }

  /* =====================================================
     TELA DE ESCOLHA DE PLANO (Usuário BASIC / Trial)
  ====================================================== */
  return (
    <div className="max-w-6xl mx-auto py-8 px-6 pb-24">
      <Script src="https://sdk.mercadopago.com/js/v2" onLoad={() => setMpLoaded(true)} />

      {/* Banner de trial expirado */}
      {trialExpired && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Seu período de teste encerrou</p>
            <p className="text-sm text-red-600">Escolha um plano abaixo para continuar usando o BarberApp.</p>
          </div>
        </div>
      )}

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-zinc-900">Turbine seu Estabelecimento</h1>
        <p className="text-zinc-500 mt-2">Escolha o plano ideal para o seu crescimento</p>
      </div>

      {/* Toggle Mensal / Anual */}
      <div className="flex items-center justify-center gap-4 mb-10">
        <button
          onClick={() => setBillingCycle("monthly")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
            billingCycle === "monthly"
              ? "bg-zinc-900 text-white shadow"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          }`}
        >
          Mensal
        </button>
        <button
          onClick={() => setBillingCycle("annual")}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
            billingCycle === "annual"
              ? "bg-zinc-900 text-white shadow"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          }`}
        >
          Anual
          <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            -10%
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-start">
        {/* ─── PLANO BASIC ─── */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-7 flex flex-col opacity-70">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-zinc-900">Basic</h3>
            <p className="text-sm text-zinc-500">O essencial para começar</p>
          </div>
          <div className="mb-6">
            <span className="text-zinc-400 font-medium text-lg">Grátis</span>
          </div>
          <ul className="space-y-3.5 flex-1 mb-8">
            <Feature item="Agendamento Online" />
            <Feature item="Gestão de Profissionais" />
            <Feature item="Controle de Comissões" />
            <Feature disabled item="WhatsApp Automático" />
            <Feature disabled item="Dashboard de Lucro" />
            <Feature disabled item="Automações de Retenção" />
            <Feature disabled item="Inteligência Artificial" />
          </ul>
          <Button variant="secondary" className="w-full" disabled>
            Seu plano atual
          </Button>
        </div>

        {/* ─── PLANO GESTÃO (PRO) ─── */}
        <div className="bg-white rounded-2xl border-2 border-primary/60 p-7 flex flex-col relative shadow-lg hover:shadow-xl transition-shadow">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-zinc-900">Gestão</h3>
              <Rocket className="w-4 h-4 text-primary" />
            </div>
            <p className="text-sm text-zinc-500">Gestão profissional completa</p>
          </div>
          <div className="mb-1">
            <span className="text-3xl font-black text-primary">
              R$ {billingCycle === "annual"
                ? PLAN_CONFIG.PRO.annualPrice.toFixed(2).replace(".", ",")
                : PLAN_CONFIG.PRO.monthlyPrice.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-sm text-zinc-400 ml-1">/mês</span>
          </div>
          {billingCycle === "annual" && (
            <p className="text-xs text-green-600 font-semibold mb-5">
              Cobrado anualmente — economize R$ {PLAN_CONFIG.PRO.annualSavings}/ano
            </p>
          )}
          {billingCycle === "monthly" && <div className="mb-6" />}
          <ul className="space-y-3.5 flex-1 mb-8">
            <Feature item="Automações de Retenção" />
            <Feature item="Dashboard de Lucratividade" />
            <Feature item="QR Code no Balcão" />
            <Feature item="Suporte Prioritário" />
            <Feature disabled item="Inteligência Artificial" />
          </ul>
          <Button
            variant="primary"
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
            onClick={() => handleUpgrade("PRO")}
            loading={loading && selectedPlan === "PRO"}
          >
            {loading && selectedPlan === "PRO" ? "Carregando Checkout..." : "Assinar Gestão"}
          </Button>
        </div>

        {/* ─── PLANO GESTÃO + ASSISTENTE (ELITE) ─── */}
        <div className="rounded-2xl p-7 flex flex-col relative shadow-2xl bg-zinc-900 border-2 border-violet-500/50">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-violet-500/30">
              <Star className="w-3 h-3" /> Recomendado
            </div>
          </div>
          <div className="mb-6 mt-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">Gestão + Assistente</h3>
              <Brain className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-sm text-zinc-400">Inteligência Artificial a seu favor</p>
          </div>
          <div className="mb-1">
            <span className="text-3xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              R$ {billingCycle === "annual"
                ? PLAN_CONFIG.ELITE.annualPrice.toFixed(2).replace(".", ",")
                : PLAN_CONFIG.ELITE.monthlyPrice.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-sm text-zinc-500 ml-1">/mês</span>
          </div>
          {billingCycle === "annual" && (
            <p className="text-xs text-green-400 font-semibold mb-5">
              Cobrado anualmente — economize R$ {PLAN_CONFIG.ELITE.annualSavings}/ano
            </p>
          )}
          {billingCycle === "monthly" && <div className="mb-6" />}
          <ul className="space-y-3.5 flex-1 mb-8">
            <Feature item="Tudo do Plano Gestão" light highlight />
            <Feature item="IA de Previsão de Demanda" light ai />
            <Feature item="Insights Automáticos de Lucro" light ai />
            <Feature item="Sugestões Inteligentes de Horário" light ai />
            <Feature item="Relatórios Avançados com IA" light ai />
            <Feature item="Suporte VIP Exclusivo" light />
          </ul>
          <button
            onClick={() => handleUpgrade("ELITE")}
            disabled={loading && selectedPlan === "ELITE"}
            className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50 transition-all active:scale-[0.98] disabled:opacity-60"
          >
            {loading && selectedPlan === "ELITE" ? "Carregando Checkout..." : "🧠 Assinar Gestão + Assistente"}
          </button>
        </div>
      </div>

      {/* ─── SEÇÃO DE CHECKOUT ─── */}
      <div className="max-w-2xl mx-auto mt-12 transition-all duration-500">
        <div id="checkout_section" className="hidden">
          <Card className="p-0 overflow-hidden border-2 border-primary/20 shadow-2xl">
            <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <span className="font-bold text-zinc-800">Checkout Seguro</span>
              </div>
              <img
                src="/mercadopago.png"
                alt="Mercado Pago"
                className="h-8 object-contain"
                onError={(e) => {
                  e.currentTarget.src = "https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo-1.png";
                }}
              />
            </div>

            <div className="p-6">
              {selectedPlan && (
                <div className={`mb-6 flex items-center justify-between p-4 rounded-xl border ${
                  selectedPlan === "ELITE" ? "bg-violet-50 border-violet-200" : "bg-primary/10 border-primary/20"
                }`}>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wider ${
                      selectedPlan === "ELITE" ? "text-violet-700" : "text-amber-700"
                    }`}>
                      Você escolheu:
                    </p>
                    <p className="text-lg font-bold text-zinc-900">
                      {PLAN_CONFIG[selectedPlan].label}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {billingCycle === "annual" ? "Plano anual" : "Plano mensal"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-black ${
                      selectedPlan === "ELITE" ? "text-violet-600" : "text-primary/90"
                    }`}>
                      R$ {getPrice(selectedPlan, billingCycle).toFixed(2).replace(".", ",")}
                    </p>
                    <p className={`text-[10px] ${
                      selectedPlan === "ELITE" ? "text-violet-500" : "text-primary"
                    }`}>
                      {billingCycle === "annual" ? "cobrança anual única" : "cobrança mensal"}
                    </p>
                  </div>
                </div>
              )}

              <div id="paymentBrick_container" className="min-h-[400px]"></div>

              {paymentStatus === "pending" && pixData && (
                <div className="mt-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white p-4 rounded-2xl border-2 border-primary shadow-lg mb-6">
                    <img
                      src={`data:image/jpeg;base64,${pixData.qr_code_base64}`}
                      alt="QR Code Pix"
                      className="w-64 h-64"
                    />
                  </div>
                  <div className="w-full space-y-4">
                    <div className="text-center">
                      <p className="font-bold text-zinc-800">Escaneie o QR Code acima</p>
                      <p className="text-sm text-zinc-500">Ou copie o código abaixo para pagar</p>
                    </div>
                    <div className="relative">
                      <input
                        readOnly
                        value={pixData.qr_code}
                        className="w-full bg-zinc-100 border border-zinc-200 rounded-xl py-3 px-4 text-xs font-mono text-zinc-600 pr-24"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pixData.qr_code);
                          alert("Código copiado!");
                        }}
                        className="absolute right-2 top-1.5 bg-primary text-white text-[10px] font-bold px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                      >
                        COPIAR
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex items-center gap-4 opacity-50 grayscale">
                  <img src="https://logodownload.org/wp-content/uploads/2014/07/visa-logo-1.png" alt="Visa" className="h-4" />
                  <img src="https://logodownload.org/wp-content/uploads/2014/07/mastercard-logo-7.png" alt="Master" className="h-6" />
                  <img src="https://logodownload.org/wp-content/uploads/2015/03/pix-logo-1-1.png" alt="Pix" className="h-4" />
                </div>
                <p className="text-[10px] text-zinc-400 text-center">
                  Sua transação é criptografada e processada pelo Mercado Pago.
                  <br />
                  Cancele sua assinatura a qualquer momento no painel de configurações.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ─── MODAL DE SUCESSO ─── */}
      {paymentStatus === "approved" && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="max-w-sm w-full bg-white rounded-3xl border border-green-100 p-8 shadow-2xl text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Sucesso! 🎉</h2>
            <p className="text-zinc-500 mb-8">
              Plano <strong>{selectedPlan ? PLAN_CONFIG[selectedPlan].label : ""}</strong> ativado.
              Explore todas as novas ferramentas agora mesmo.
            </p>
            <Button
              variant="primary"
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => window.location.reload()}
            >
              Começar a usar
            </Button>
          </div>
        </div>
      )}

      <style jsx global>{`
        #paymentBrick_container button.svelte-1v8m5xv,
        #paymentBrick_container .mp-brick-button {
          background-color: #f59e0b !important;
          border-radius: 12px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
        }
        #paymentBrick_container .mp-brick-button:hover {
          background-color: #d97706 !important;
        }
      `}</style>
    </div>
  );
}

function Feature({
  item,
  disabled,
  light,
  highlight,
  ai,
}: {
  item: string;
  disabled?: boolean;
  light?: boolean;
  highlight?: boolean;
  ai?: boolean;
}) {
  return (
    <li className={`flex items-center gap-3 text-sm ${
      disabled
        ? light ? "text-zinc-600 line-through opacity-40" : "text-zinc-300 line-through"
        : light ? "text-zinc-300" : "text-zinc-600"
    } ${highlight ? "font-semibold" : ""}`}>
      {disabled ? (
        <X className={`w-4 h-4 shrink-0 ${light ? "text-zinc-600" : "text-zinc-200"}`} />
      ) : ai ? (
        <Bot className="w-4 h-4 shrink-0 text-violet-400" />
      ) : (
        <Check className={`w-4 h-4 shrink-0 ${light ? "text-violet-400" : "text-primary"}`} />
      )}
      {item}
    </li>
  );
}
