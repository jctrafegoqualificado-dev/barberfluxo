"use client";
import { useState, useEffect } from "react";
import { Check, Crown, ShieldCheck, MessageSquare, TrendingUp } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Script from "next/script";

declare global {
  interface Window {
    MercadoPago: any;
  }
}

const PREMIUM_PRICE = 199.90;

export default function AssinaturaSaaSPage() {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [mpLoaded, setMpLoaded] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<null | "approved" | "pending" | "rejected">(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null);

  useEffect(() => {
    fetch("/api/barbershop/financeiro", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setCurrentPlan(data.saasPlan || "BASIC"));
  }, [token]);

  const handleUpgrade = async () => {
    if (!window.MercadoPago) return;
    setLoading(true);

    const container = document.getElementById("paymentBrick_container");
    if (container) container.innerHTML = "";

    const mp = new window.MercadoPago(process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY);
    const bricksBuilder = mp.bricks();

    const settings = {
      initialization: {
        amount: PREMIUM_PRICE,
        payer: {
          email: user?.email,
        },
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
                planType: "PREMIUM",
              }),
            })
              .then((response) => response.json())
              .then((result) => {
                if (result.error) {
                  console.error("Erro MP API:", result.error, result.details);
                  setPaymentStatus("rejected");
                  alert("Ops! O Mercado Pago recusou a geração do PIX: " + result.error);
                  resolve(null);
                  return;
                }
                
                if (result.status === "approved") {
                  setPaymentStatus("approved");
                  setCurrentPlan("PREMIUM");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                } else if (result.status === "pending" || result.status === "in_process") {
                  setPaymentStatus("pending");
                  if (result.qr_code) {
                    setPixData({ qr_code: result.qr_code, qr_code_base64: result.qr_code_base64 });
                    // Esconde o Brick para focar no QR Code
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

  if (currentPlan === "PREMIUM") {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6 text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <Crown className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-900 mb-2">Você é PREMIUM!</h1>
        <p className="text-zinc-500 mb-8 text-lg">Seu estabelecimento tem acesso total a todas as ferramentas do BarberFluxo.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            { icon: MessageSquare, title: "WhatsApp Ilimitado", desc: "Envie lembretes e marketing sem limites." },
            { icon: TrendingUp, title: "Dashboard Avançado", desc: "Métricas profundas de lucro e ocupação." },
            { icon: ShieldCheck, title: "Suporte VIP", desc: "Atendimento prioritário pela nossa equipe." },
          ].map((item, i) => (
            <Card key={i} className="p-6">
              <item.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-bold text-zinc-900 mb-1">{item.title}</h3>
              <p className="text-sm text-zinc-500">{item.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-6 pb-24">
      <Script 
        src="https://sdk.mercadopago.com/js/v2" 
        onLoad={() => setMpLoaded(true)}
      />

      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-zinc-900">Turbine seu Estabelecimento</h1>
        <p className="text-zinc-500 mt-2">Escolha o plano ideal para o seu crescimento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Plano BASIC */}
        <div className="bg-white rounded-2xl border border-zinc-200 p-8 flex flex-col opacity-80">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Plano BASIC</h3>
              <p className="text-sm text-zinc-500">O essencial para começar</p>
            </div>
            <span className="text-zinc-400 font-medium">Grátis</span>
          </div>
          
          <ul className="space-y-4 flex-1 mb-8">
            <Feature item="Agendamento Online" />
            <Feature item="Gestão de Profissionais" />
            <Feature item="Controle de Comissões" />
            <Feature disabled item="WhatsApp Automático" />
            <Feature disabled item="Dashboard de Lucro" />
          </ul>

          <Button variant="secondary" className="w-full" disabled>Seu plano atual</Button>
        </div>

        {/* Plano PREMIUM */}
        <div className="bg-zinc-900 rounded-2xl border-2 border-primary p-8 flex flex-col relative shadow-xl">
          <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
            Recomendado
          </div>
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Plano PREMIUM <Crown className="w-4 h-4 text-primary" />
              </h3>
              <p className="text-sm text-zinc-400">Poder total para escalar</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-primary">R$ 199,90</span>
              <p className="text-[10px] text-zinc-500">/mês</p>
            </div>
          </div>
          
          <ul className="space-y-4 flex-1 mb-8">
            <Feature item="Tudo do Plano Basic" light />
            <Feature item="WhatsApp Ilimitado (Envio)" light />
            <Feature item="Automações de Retenção" light />
            <Feature item="Dashboard de Lucratividade" light />
            <Feature item="QR Code no Balcão" light />
          </ul>

          <Button 
            variant="primary" 
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold"
            onClick={handleUpgrade}
            loading={loading}
          >
            {loading ? "Carregando Checkout..." : "Assinar Agora"}
          </Button>
        </div>
      </div>

      {/* Seção de Checkout - Design de Confiança */}
      <div className="max-w-2xl mx-auto mt-12 transition-all duration-500">
        <div id="checkout_section" className="hidden">
          <Card className="p-0 overflow-hidden border-2 border-primary/20 shadow-2xl">
            <div className="bg-zinc-50 px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <span className="font-bold text-zinc-800">Checkout Seguro</span>
              </div>
              <div className="flex items-center gap-1">
                <img 
                  src="/mercadopago.png" 
                  alt="Mercado Pago" 
                  className="h-8 object-contain"
                  onError={(e) => {
                    // Fallback caso a imagem ainda não tenha sido salva na public
                    e.currentTarget.src = "https://logodownload.org/wp-content/uploads/2019/06/mercado-pago-logo-1.png";
                  }}
                />
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between bg-primary/10 p-4 rounded-xl border border-primary/20">
                <div>
                  <p className="text-xs text-amber-700 font-bold uppercase tracking-wider">Você escolheu:</p>
                  <p className="text-lg font-bold text-zinc-900">Plano PREMIUM</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary/90">R$ 199,90</p>
                  <p className="text-[10px] text-primary">cobrança mensal</p>
                </div>
              </div>

              <div id="paymentBrick_container" className="min-h-[400px]"></div>

              {/* Exibição do PIX */}
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
                  Sua transação é criptografada e processada pelo Mercado Pago.<br/>
                  Cancele sua assinatura a qualquer momento no painel de configurações.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {paymentStatus === "approved" && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="max-w-sm w-full bg-white rounded-3xl border border-green-100 p-8 shadow-2xl text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Sucesso!</h2>
            <p className="text-zinc-500 mb-8">Seu plano **PREMIUM** foi ativado. Explore todas as novas ferramentas agora mesmo.</p>
            <Button variant="primary" className="w-full bg-green-600 hover:bg-green-700" onClick={() => window.location.reload()}>
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

function Feature({ item, disabled, light }: { item: string; disabled?: boolean; light?: boolean }) {
  return (
    <li className={`flex items-center gap-3 text-sm ${disabled ? "text-zinc-300 line-through" : light ? "text-zinc-300" : "text-zinc-600"}`}>
      <Check className={`w-4 h-4 shrink-0 ${disabled ? "text-zinc-200" : "text-primary"}`} />
      {item}
    </li>
  );
}
