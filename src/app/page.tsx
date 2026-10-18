import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarDays, Layers, MessageCircle, Scissors, TrendingUp, Users, Wallet } from "lucide-react";
import { loadSaasPlans } from "@/lib/saasPlans.server";
import { getPlatformContact, waLink } from "@/lib/platformSettings";
import { Faq, MobileMenu, Planos, type LandingPlan } from "@/components/landing/LandingClient";

/**
 * Página de vendas (docs/design/Landing-desktop e Landing-celular).
 * Preços vêm de Planos e preços (/plataforma/planos); WhatsApp de contato de /plataforma/configuracoes.
 * Só promete o que o sistema faz hoje.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "IA de Barbearia — gestão da barbearia e atendente de IA no WhatsApp",
  description: "Agenda, comissões, caixa e clientes num lugar só, com um atendente de IA que responde e agenda no WhatsApp da sua barbearia.",
};

const NAV: [string, string][] = [["#recursos", "Recursos"], ["#ia", "Atendente de IA"], ["#planos", "Planos"], ["#duvidas", "Dúvidas"]];

const PAINS = [
  ["01", "Mensagem sem resposta vira cliente perdido", "Você está com a máquina na mão, o WhatsApp apita e o cliente agenda na concorrência.", "a IA responde na hora e já marca o horário."],
  ["02", "Cliente que não aparece", "Sem lembrete, o horário fica vazio e ninguém avisa.", "lembrete com confirmação SIM ou NÃO pelo WhatsApp."],
  ["03", "Comissão na calculadora", "Todo fim de mês é papelzinho, conferência e discussão com a equipe.", "comissões, vales e recibos calculados sozinhos."],
  ["04", "Cliente que some sem você notar", "Quem cortava todo mês e parou de vir? Sem dados, não dá para saber.", "lista de quem passou do prazo, pronta para chamar."],
];
const AI_POINTS = [
  ["Agenda de verdade", "Consulta os horários livres da equipe e bloqueia o horário na hora."],
  ["Lembretes e confirmações", "Avisa o cliente antes do horário para diminuir as faltas."],
  ["Apresenta seus planos", "Conta dos planos de assinatura da barbearia no meio da conversa."],
  ["Com o jeito da sua barbearia", "Fala no tom da casa e chama você quando precisa de uma pessoa."],
];
const CHAT: ["c" | "ia", string][] = [
  ["c", "boa noite, amanhã cedo tem vaga? queria fazer barba e sobrancelha"],
  ["ia", "Boa noite! Amanhã tem às 09:00 com o Marcos ou às 10:30 com o Anderson. Qual prefere?"],
  ["c", "9h com o marcos"],
  ["ia", "Marcado: barba + sobrancelha amanhã às 09:00 com o Marcos. Te mando um lembrete antes. Quer conhecer o plano mensal? Sai mais barato se você vem toda semana."],
  ["c", "manda aí"],
  ["ia", "O Clube Barba Feita inclui 4 barbas por mês. Quer que eu te mande o link para assinar?"],
];
const FEATURES = [
  [CalendarDays, "Agenda por barbeiro", "Grade do dia com todos os profissionais, encaixes, bloqueios e link de agendamento online."],
  [Wallet, "Comissões e vales", "Regras por profissional, vales descontados e recibo pronto no fechamento."],
  [TrendingUp, "Caixa e financeiro", "Abertura e fechamento de caixa, despesas e quanto sobrou no mês."],
  [Layers, "Clube de assinatura", "Planos mensais com cobrança automática para ter faturamento previsível."],
  [Users, "Histórico de clientes", "Quem mais gasta, de quanto em quanto tempo volta e quem sumiu."],
  [BarChart3, "Ocupação e metas", "Quanto das cadeiras virou atendimento e as metas da equipe, em tempo real."],
] as const;
const STEPS = [
  ["1", "Cadastre serviços e equipe", "Preços, duração e comissão de cada barbeiro. O suporte ajuda você."],
  ["2", "Conecte o WhatsApp", "Leia o QR Code e a IA passa a responder com o nome da sua barbearia."],
  ["3", "Receba os agendamentos", "Pelo WhatsApp e pelo link de agendamento, direto na agenda da equipe."],
];
const FAQ: [string, string][] = [
  ["A IA é um chatbot de menu?", "Não. Chatbots comuns seguem um roteiro e travam quando o cliente escreve diferente. O atendente de IA entende a conversa, responde dúvidas sobre os serviços e marca o horário como um atendente faria."],
  ["Preciso entender de tecnologia?", "Não. A configuração é guiada passo a passo e o suporte ajuda você a deixar tudo pronto no mesmo dia."],
  ["Como a IA sabe os horários livres?", "Ela usa a mesma agenda do sistema. Quando o cliente pede um horário, a IA consulta a disponibilidade da equipe, oferece as opções e bloqueia o horário escolhido."],
  ["E quando a IA não souber responder?", "Ela passa a conversa para você: o cliente aparece em \"Precisa de você\" no painel e a IA para de responder até você devolver a conversa para ela."],
  ["Tem fidelidade ou multa para cancelar?", "Não. Você paga mês a mês (ou o ano, com desconto). Se não renovar, o acesso pausa e seus dados ficam guardados."],
];

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="w-10 h-10 rounded-[10px] bg-primary text-white flex items-center justify-center"><Scissors className="w-5 h-5" aria-hidden /></span>
      <span className="font-display text-xl font-bold">IA de Barbearia</span>
    </span>
  );
}

export default async function LandingPage() {
  const [plans, contact] = await Promise.all([loadSaasPlans(), getPlatformContact()]);
  const wa = contact.whatsapp ? waLink(contact.whatsapp, "Olá! Quero saber mais sobre a IA de Barbearia.") : null;
  const landingPlans: LandingPlan[] = [
    {
      key: "PRO", name: plans.PRO.label, desc: "Para organizar a barbearia inteira: agenda, equipe, financeiro e clientes.",
      monthly: plans.PRO.monthlyPrice, annualMonthly: plans.PRO.annualPriceMonthly, popular: false, cta: `Assinar ${plans.PRO.label}`,
      items: ["Agendamentos ilimitados e link de agendamento", "Comissões, vales e recibos", "Caixa, despesas e resultado do mês", "Produtos e estoque", "Planos de assinatura para clientes", "Ocupação e metas da equipe"],
    },
    {
      key: "ELITE", name: plans.ELITE.label, desc: "Tudo do Gestão, mais a IA atendendo e agendando no seu WhatsApp.",
      monthly: plans.ELITE.monthlyPrice, annualMonthly: plans.ELITE.annualPriceMonthly, popular: true, cta: "Assinar com Atendente de IA",
      items: [`Tudo do plano ${plans.PRO.label}`, "Atendente de IA no seu WhatsApp, 24 horas", "Agendamento pela conversa", "Lembretes e confirmação SIM ou NÃO", "Apresenta os planos da barbearia na conversa"],
    },
  ];

  return (
    <div className="min-h-screen bg-ground text-ink">
      {/* NAV */}
      <nav aria-label="Principal" className="sticky top-0 z-40 bg-ground/90 backdrop-blur border-b border-line-2">
        <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 h-[72px] flex items-center justify-between gap-6">
          <Link href="/" aria-label="IA de Barbearia — início"><Logo /></Link>
          <div className="hidden md:flex items-center gap-7 text-[15px] font-semibold text-ink-2">
            {NAV.map(([h, l]) => <a key={h} href={h} className="hover:text-ink">{l}</a>)}
          </div>
          <div className="hidden md:flex items-center gap-2.5">
            <Link href="/login" className="h-11 px-4 rounded-xl text-[15px] font-semibold flex items-center hover:bg-surface-2">Entrar</Link>
            <a href="#planos" className="h-11 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold flex items-center">Começar agora</a>
          </div>
          <MobileMenu links={NAV} />
        </div>
      </nav>

      {/* HERO */}
      <header className="max-w-[1200px] mx-auto px-4 md:px-8 pt-12 md:pt-20 pb-16 md:pb-24 grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center">
        <div className="flex flex-col gap-6">
          <span className="self-start h-8 px-3 rounded-full bg-surface border border-line text-[13px] font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />Sistema de gestão + atendente de IA no WhatsApp
          </span>
          <h1 className="font-display text-[40px] md:text-[60px] font-bold leading-[1.04] tracking-[-0.03em]">Sua barbearia cheia, organizada e atendendo o WhatsApp 24 horas.</h1>
          <p className="text-lg md:text-xl leading-relaxed text-ink-2 max-w-[560px]">Agenda, comissões, caixa e clientes num lugar só. E um atendente de IA que responde, agenda e confirma horários enquanto você está na cadeira.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a href="#planos" className="h-14 px-7 rounded-xl bg-primary text-white text-base font-semibold flex items-center justify-center">Quero na minha barbearia</a>
            <a href="#ia" className="h-14 px-7 rounded-xl border border-control bg-surface text-base font-semibold flex items-center justify-center">Ver a IA funcionando</a>
          </div>
        </div>
        <div className="relative" aria-hidden>
          <div className="rounded-[22px] bg-surface border border-line p-5 shadow-[0_24px_48px_-24px_rgba(27,25,22,0.25)] flex flex-col gap-3 md:mr-16">
            <div className="flex justify-between text-[13px]"><span className="font-semibold">Previsão de hoje</span><span className="text-ink-3">Meta R$ 2.300</span></div>
            <span className="font-display text-[34px] font-bold leading-none">R$ 2.100</span>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-surface-2"><div className="bg-ink w-[50%]" /><div className="bg-primary w-[29%]" /><div className="bg-primary/35 w-[13%]" /></div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {[["Já faturado", "R$ 1.140"], ["Confirmados", "R$ 665"], ["Sem confirmação", "R$ 295"]].map(([a, b]) => (
                <div key={a} className="flex flex-col gap-0.5 p-2.5 rounded-[10px] bg-ground"><span className="text-ink-3">{a}</span><strong className="text-sm">{b}</strong></div>
              ))}
            </div>
          </div>
          <div className="md:absolute md:-bottom-14 md:right-0 mt-4 md:mt-0 md:w-[300px] rounded-[22px] bg-[#1B1916] p-2 shadow-[0_24px_48px_-20px_rgba(27,25,22,0.45)]">
            <div className="rounded-[16px] bg-[#EFE9DF] overflow-hidden">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white">
                <span className="w-8 h-8 rounded-full bg-primary" />
                <span className="flex flex-col"><span className="text-[13px] font-semibold">Barbearia Modelo</span><span className="text-[11px] text-positive">respondendo agora</span></span>
              </div>
              <div className="flex flex-col gap-1.5 p-3 text-[13px] leading-snug">
                <span className="self-end max-w-[85%] px-2.5 py-1.5 rounded-[10px_10px_3px_10px] bg-[#DCF7C5]">fala! tem horário hoje à tarde pra degradê?</span>
                <span className="self-start max-w-[85%] px-2.5 py-1.5 rounded-[10px_10px_10px_3px] bg-white">Tenho sim, Gustavo! Com o Diego às 15:45 ou 16:00. Qual fica melhor?</span>
                <span className="self-end px-2.5 py-1.5 rounded-[10px_10px_3px_10px] bg-[#DCF7C5]">16h</span>
                <span className="self-start max-w-[85%] px-2.5 py-1.5 rounded-[10px_10px_10px_3px] bg-white">Fechado! Degradê hoje às 16:00 com o Diego. Te mando um lembrete antes.</span>
                <span className="self-center mt-1 h-6 px-2.5 rounded-full bg-positive-soft text-positive text-[11px] font-semibold flex items-center">Horário lançado na agenda</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* PROBLEMAS */}
      <section aria-labelledby="dor-t" className="bg-surface border-y border-line">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
          <div className="flex flex-col gap-3 max-w-[640px]">
            <h2 id="dor-t" className="font-display text-[32px] md:text-[44px] font-bold leading-[1.08] tracking-[-0.02em]">Onde a barbearia perde dinheiro sem perceber</h2>
            <p className="text-lg text-ink-2">Não é falta de cliente. É mensagem sem resposta, cadeira vazia e conta feita na calculadora.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {PAINS.map(([n, t, txt, fix]) => (
              <div key={n} className="rounded-[18px] bg-ground border border-line p-6 flex flex-col gap-2.5">
                <span className="font-display text-sm font-bold text-primary">{n}</span>
                <span className="text-lg font-semibold">{t}</span>
                <span className="text-[15px] text-ink-2 leading-relaxed">{txt}</span>
                <span className="text-[15px] leading-relaxed pt-2.5 border-t border-line"><strong className="font-semibold">Com a IA de Barbearia:</strong> {fix}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ATENDENTE DE IA */}
      <section id="ia" aria-labelledby="ia-t" className="scroll-mt-20 bg-[#1B1916] text-white">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24 grid gap-12 lg:grid-cols-2 items-center">
          <div className="flex flex-col gap-5">
            <span className="text-xs font-semibold tracking-[0.08em] uppercase text-primary">Atendente de IA no WhatsApp</span>
            <h2 id="ia-t" className="font-display text-[32px] md:text-[44px] font-bold leading-[1.08] tracking-[-0.02em]">Não é robô de menu. É um atendente que conversa.</h2>
            <p className="text-lg leading-relaxed text-[#C9C2B6]">Nada de &quot;digite 1 para agendar&quot;. A IA entende o jeito que seu cliente escreve, consulta a agenda de verdade e fecha o horário, de madrugada, domingo ou feriado.</p>
            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              {AI_POINTS.map(([t, txt]) => (
                <div key={t} className="flex flex-col gap-1 pl-4 border-l-2 border-primary">
                  <span className="font-semibold">{t}</span>
                  <span className="text-sm text-[#C9C2B6] leading-relaxed">{txt}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[22px] bg-night-2 border border-night-line p-5 flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-xs text-[#A8A196] pb-2">
              <span>Exemplo de conversa · domingo, 23:40</span>
              <span className="flex items-center gap-1.5 text-[#4CC38A] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-[#4CC38A]" />IA ativa</span>
            </div>
            {CHAT.map(([who, text], i) => (
              <span key={i} className={who === "c" ? "self-end max-w-[82%] px-3.5 py-2.5 rounded-[14px_14px_3px_14px] bg-[#3A352F] text-[15px] leading-snug" : "self-start max-w-[82%] px-3.5 py-2.5 rounded-[14px_14px_14px_3px] bg-ground text-ink text-[15px] leading-snug"}>{text}</span>
            ))}
          </div>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" aria-labelledby="rec-t" className="scroll-mt-20 max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col gap-10">
        <div className="flex flex-col gap-3 max-w-[640px]">
          <h2 id="rec-t" className="font-display text-[32px] md:text-[44px] font-bold leading-[1.08] tracking-[-0.02em]">Tudo da barbearia num lugar só</h2>
          <p className="text-lg text-ink-2">Feito por quem vive a rotina de barbearia. Você configura no mesmo dia, com ajuda do suporte.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([Icon, t, txt]) => (
            <div key={t} className="rounded-[18px] bg-surface border border-line p-6 flex flex-col gap-3">
              <span className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-5 h-5" aria-hidden /></span>
              <span className="text-lg font-semibold">{t}</span>
              <span className="text-[15px] text-ink-2 leading-relaxed">{txt}</span>
            </div>
          ))}
        </div>
      </section>

      {/* COMO COMEÇA */}
      <section aria-labelledby="como-t" className="bg-surface border-y border-line">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col gap-10">
          <h2 id="como-t" className="font-display text-[32px] md:text-[44px] font-bold leading-[1.08] tracking-[-0.02em]">Em um dia sua barbearia já está rodando</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map(([n, t, txt]) => (
              <div key={n} className="flex gap-4">
                <span className="w-11 h-11 rounded-full bg-ink text-white font-display text-lg font-bold flex items-center justify-center shrink-0">{n}</span>
                <div className="flex flex-col gap-1"><span className="text-lg font-semibold">{t}</span><span className="text-[15px] text-ink-2 leading-relaxed">{txt}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" aria-labelledby="planos-t" className="scroll-mt-20 max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 id="planos-t" className="font-display text-[32px] md:text-[44px] font-bold leading-[1.08] tracking-[-0.02em]">Planos</h2>
          <p className="text-lg text-ink-2">Sem taxa de adesão, sem contrato de fidelidade.</p>
        </div>
        <Planos plans={landingPlans} />
      </section>

      {/* DEPOIMENTO */}
      <section aria-labelledby="dep-t" className="bg-surface border-y border-line">
        <div className="max-w-[860px] mx-auto px-4 md:px-8 py-16 md:py-20 flex flex-col items-center gap-8 text-center">
          <h2 id="dep-t" className="font-display text-[28px] md:text-[36px] font-bold tracking-[-0.02em]">Quem já usa na barbearia</h2>
          <figure className="flex flex-col items-center gap-6">
            <blockquote className="font-display text-xl md:text-[26px] font-semibold leading-snug">
              “Antes eu perdia mensagens todo dia porque estava ocupado cortando cabelo. No primeiro mês com o Agente de IA, meu movimento aumentou 40%. A IA responde de imediato, agenda e ainda vendeu 12 planos mensais sozinha.”
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-full bg-ink text-white font-bold flex items-center justify-center">JC</span>
              <span className="flex flex-col text-left"><strong className="font-semibold">João Costa</strong><span className="text-sm text-ink-3">LordofBarba</span></span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* DÚVIDAS */}
      <section id="duvidas" aria-labelledby="faq-t" className="scroll-mt-20 max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24 grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-3">
          <h2 id="faq-t" className="font-display text-[32px] md:text-[44px] font-bold leading-[1.08] tracking-[-0.02em]">Dúvidas</h2>
          {wa ? (
            <p className="text-lg text-ink-2">Não achou sua pergunta? <a href={wa} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline underline-offset-4">Fale com a gente no WhatsApp</a>.</p>
          ) : (
            <p className="text-lg text-ink-2">As perguntas que mais recebemos de donos de barbearia.</p>
          )}
        </div>
        <Faq items={FAQ} />
      </section>

      {/* CTA FINAL */}
      <section aria-labelledby="cta-t" className="px-4 md:px-8 pb-16 md:pb-24">
        <div className="max-w-[1200px] mx-auto rounded-[28px] bg-primary text-white px-6 md:px-14 py-12 md:py-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex flex-col gap-3 max-w-[620px]">
            <h2 id="cta-t" className="font-display text-[30px] md:text-[42px] font-bold leading-[1.08] tracking-[-0.02em]">Coloque sua barbearia no automático ainda esta semana.</h2>
            <p className="text-lg text-white/85">Sem taxa de adesão · sem fidelidade · suporte de verdade</p>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <a href="#planos" className="h-14 px-8 rounded-xl bg-white text-ink text-base font-semibold flex items-center justify-center">Quero começar</a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="h-14 px-8 rounded-xl border border-white/50 text-white text-base font-semibold flex items-center justify-center gap-2">
                <MessageCircle className="w-5 h-5" aria-hidden />Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row justify-between gap-4 text-sm text-ink-3">
          <span>© {new Date().getFullYear()} IA de Barbearia</span>
          <span className="flex flex-wrap gap-5">
            <Link href="/privacidade" className="hover:text-ink">Privacidade</Link>
            <Link href="/login" className="hover:text-ink">Entrar</Link>
            {contact.email && <a href={`mailto:${contact.email}`} className="hover:text-ink">{contact.email}</a>}
            {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-ink">WhatsApp</a>}
          </span>
        </div>
      </footer>
    </div>
  );
}
