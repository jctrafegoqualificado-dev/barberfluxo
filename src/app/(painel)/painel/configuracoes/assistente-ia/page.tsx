"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ConfigSection } from "@/components/config/ConfigNav";
import { fieldCls } from "@/components/catalogo/SidePanel";
import WhatsAppTabs from "@/components/whatsapp/WhatsAppTabs";
import PhonePreview, { type Bubble } from "@/components/whatsapp/PhonePreview";
import { HANDOFF_TRIGGERS, DEFAULT_HANDOFF_TRIGGERS } from "@/lib/whatsapp/handoffTriggers";

/** Pontos de partida do "Jeito de falar": preenchem a personalidade, que o dono ajusta. */
const TONES = {
  parceiro: {
    label: "Parceiro", hint: "Descontraído, de igual para igual",
    personality: "Fala como um amigo da barbearia: leve, direto e bem-humorado, sem exagerar na gíria. Chama o cliente pelo nome.",
    replies: ["Fala, Gustavo! Beleza? Tem sim: com o Diego às 15:45 ou 16:00. Qual fica melhor?", "Fechou! Degradê hoje às 16:00 com o Diego. Te mando um lembrete antes."],
  },
  profissional: {
    label: "Profissional", hint: "Educado e objetivo",
    personality: "Cordial e objetivo. Trata o cliente com educação, confirma os detalhes e evita gírias.",
    replies: ["Olá, Gustavo! Temos horários hoje com o Diego às 15:45 e às 16:00. Qual prefere?", "Agendamento confirmado: corte degradê hoje, às 16:00, com o Diego. Enviaremos um lembrete antes."],
  },
  premium: {
    label: "Premium", hint: "Caprichado e acolhedor",
    personality: "Atendimento de barbearia clássica: acolhedor, caprichado nas palavras, valoriza a experiência do cliente.",
    replies: ["Boa tarde, Gustavo! Será um prazer te receber. O Diego tem disponibilidade às 15:45 ou às 16:00. Qual horário te atende melhor?", "Perfeito, está reservado: degradê hoje às 16:00 com o Diego. Até logo, e qualquer coisa estou por aqui."],
  },
} as const;
type Tone = keyof typeof TONES;

interface Form {
  aiAssistantName: string; aiIdioma: string; aiPersonality: string; aiGreetingDirective: string;
  aiObservacoesAdicionais: string; aiHandoffTriggers: string[];
  aiMensagemBoasVindas: string; aiMensagemAusencia: string; aiMensagemConfirmacaoAgendamento: string; aiMensagemCancelamento: string;
}
type MsgKey = "aiMensagemBoasVindas" | "aiMensagemAusencia" | "aiMensagemConfirmacaoAgendamento" | "aiMensagemCancelamento";

const MESSAGES: [MsgKey, string, string, string][] = [
  ["aiMensagemBoasVindas", "Boas-vindas", "Primeira mensagem para quem chama", "Olá! Seja bem-vindo à barbearia. Posso te ajudar a marcar um horário ou tirar uma dúvida."],
  ["aiMensagemAusencia", "Fora do horário", "Quando a barbearia está fechada", "Estamos fechados agora, mas já posso deixar seu horário marcado."],
  ["aiMensagemConfirmacaoAgendamento", "Horário confirmado", "Depois de marcar", "Prontinho! Seu horário está confirmado. Te esperamos no dia combinado."],
  ["aiMensagemCancelamento", "Cancelamento", "Quando o cliente desmarca", "Seu horário foi cancelado. Quando quiser remarcar é só chamar aqui."],
];

const EMPTY: Form = {
  aiAssistantName: "", aiIdioma: "pt-BR", aiPersonality: "", aiGreetingDirective: "", aiObservacoesAdicionais: "",
  aiHandoffTriggers: [], aiMensagemBoasVindas: "", aiMensagemAusencia: "", aiMensagemConfirmacaoAgendamento: "", aiMensagemCancelamento: "",
};

function Counter({ n, max }: { n: number; max: number }) {
  return <span className={cn("text-xs text-right", n >= max * 0.95 ? "text-warning" : "text-ink-3")}>{n} de {max}</span>;
}

export default function AssistenteIAPage() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shopName, setShopName] = useState("");
  const [aiOn, setAiOn] = useState(true);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<MsgKey | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/barbershop/ai-config", { headers: { Authorization: `Bearer ${token}` } });
        const d = await res.json().catch(() => null);
        if (res.ok && d) {
          const f: Form = {
            aiAssistantName: d.aiAssistantName ?? "", aiIdioma: d.aiIdioma ?? "pt-BR",
            aiPersonality: d.aiPersonality ?? "", aiGreetingDirective: d.aiGreetingDirective ?? "",
            aiObservacoesAdicionais: d.aiObservacoesAdicionais ?? "",
            // Nunca configurado: começa com as situações mais comuns marcadas
            aiHandoffTriggers: d.aiHandoffTriggers?.length || d.aiPersonality ? d.aiHandoffTriggers ?? [] : DEFAULT_HANDOFF_TRIGGERS,
            aiMensagemBoasVindas: d.aiMensagemBoasVindas ?? "", aiMensagemAusencia: d.aiMensagemAusencia ?? "",
            aiMensagemConfirmacaoAgendamento: d.aiMensagemConfirmacaoAgendamento ?? "", aiMensagemCancelamento: d.aiMensagemCancelamento ?? "",
          };
          setForm(f);
          setSaved({ ...f, aiHandoffTriggers: d.aiHandoffTriggers ?? [] });
          setShopName(d.name ?? "");
          setAiOn(d.aiAtendimentoAtivo ?? true);
        } else {
          // Sem os dados, salvar apagaria tudo: não mostra o formulário
          setLoadError(d?.error ?? `Erro ${res.status}`);
        }
      } catch {
        setLoadError("Sem conexão com o servidor");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const tone = (Object.keys(TONES) as Tone[]).find((t) => TONES[t].personality === form.aiPersonality.trim()) ?? null;
  const displayName = form.aiAssistantName.trim() || shopName || "Sua barbearia";

  const preview = useMemo<Bubble[]>(() => {
    const replies = TONES[tone ?? "profissional"].replies;
    const b: Bubble[] = [{ from: "client", text: "boa tarde, tem horário hoje à tarde pra degradê?" }];
    if (form.aiMensagemBoasVindas.trim()) b.push({ from: "shop", text: form.aiMensagemBoasVindas.trim() });
    b.push({ from: "shop", text: replies[0] }, { from: "client", text: "16h" });
    b.push({ from: "shop", text: form.aiMensagemConfirmacaoAgendamento.trim() || replies[1] });
    return b;
  }, [tone, form.aiMensagemBoasVindas, form.aiMensagemConfirmacaoAgendamento]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/barbershop/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form), // aiAtendimentoAtivo fica de fora: liga/desliga na Visão geral
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Não foi possível salvar");
      setSaved(form);
      setEditing(null);
      toast.success("Atendente atualizado. Vale para as próximas conversas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <WhatsAppTabs current="ia" subtitle="Ensine o atendente a falar como a sua barbearia" />
        <div className="h-96 rounded-2xl bg-surface border border-line animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-5">
        <WhatsAppTabs current="ia" subtitle="Ensine o atendente a falar como a sua barbearia" />
        <div role="alert" className="rounded-2xl bg-danger-soft text-danger px-5 py-4 text-sm flex flex-col gap-2 items-start">
          <span><strong>Não foi possível carregar o atendente.</strong> Nada foi alterado. ({loadError})</span>
          <button type="button" onClick={() => window.location.reload()} className="font-semibold underline">Tentar de novo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <WhatsAppTabs current="ia" subtitle="Ensine o atendente a falar como a sua barbearia" />

      {!aiOn && (
        <div role="status" className="rounded-xl bg-warning-soft text-warning px-4 py-3 text-[13px]">
          O atendente está desligado: as mensagens não estão sendo respondidas. Ligue na{" "}
          <Link href="/painel/whatsapp" className="font-semibold underline">Visão geral</Link>.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <ConfigSection title="Quem responde">
            <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[13px] font-semibold text-ink-2">Nome do atendente</span>
                <input className={fieldCls} value={form.aiAssistantName} maxLength={50} placeholder={shopName ? `Atendimento ${shopName}` : "Ex.: Atendimento da barbearia"}
                  onChange={(e) => set("aiAssistantName", e.target.value)} />
                <span className="text-xs text-ink-3">Em branco, usa o nome da barbearia.</span>
              </label>
              <label className="flex flex-col gap-1.5 min-w-0">
                <span className="text-[13px] font-semibold text-ink-2">Idioma</span>
                <select className={fieldCls} value={form.aiIdioma} onChange={(e) => set("aiIdioma", e.target.value)}>
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="en-US">English (US)</option>
                  <option value="es-ES">Español</option>
                </select>
              </label>
            </div>
          </ConfigSection>

          <ConfigSection title="Jeito de falar" subtitle="Escolha um ponto de partida e ajuste do seu jeito.">
            <div role="radiogroup" aria-label="Tom de voz" className="grid gap-2.5 sm:grid-cols-3">
              {(Object.keys(TONES) as Tone[]).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={tone === t} onClick={() => set("aiPersonality", TONES[t].personality)}
                  className={cn("flex flex-col gap-1 px-3.5 py-3 rounded-xl text-left border",
                    tone === t ? "border-primary ring-1 ring-primary bg-primary/5" : "border-control bg-surface hover:bg-surface-2")}>
                  <span className="text-sm font-semibold">{TONES[t].label}</span>
                  <span className="text-xs text-ink-3">{TONES[t].hint}</span>
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Personalidade</span>
              <textarea rows={3} maxLength={500} value={form.aiPersonality} onChange={(e) => set("aiPersonality", e.target.value)}
                placeholder="Ex.: Somos uma barbearia de bairro. Trate o cliente pelo nome, seja direto e simpático."
                className={cn(fieldCls, "h-auto py-2.5 resize-none leading-relaxed")} />
              <Counter n={form.aiPersonality.length} max={500} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Como cumprimentar</span>
              <input className={fieldCls} maxLength={200} value={form.aiGreetingDirective} onChange={(e) => set("aiGreetingDirective", e.target.value)}
                placeholder="Ex.: Cumprimente pelo nome e pergunte em que pode ajudar" />
              <span className="text-xs text-ink-3">É um estilo para a primeira mensagem do dia, não um texto fixo.</span>
            </label>
          </ConfigSection>

          <ConfigSection title="Regras da casa" subtitle="O que a IA nunca deve fazer e quando deve chamar você">
            <label className="flex flex-col gap-1.5">
              <textarea rows={3} maxLength={1000} aria-label="Regras da casa" value={form.aiObservacoesAdicionais}
                onChange={(e) => set("aiObservacoesAdicionais", e.target.value)}
                placeholder="Ex.: Não agendar menores de 12 anos sem responsável. Sempre perguntar se o cliente tem barbeiro preferido."
                className={cn(fieldCls, "h-auto py-2.5 resize-none leading-relaxed")} />
              <Counter n={form.aiObservacoesAdicionais.length} max={1000} />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-ink-2">Passar a conversa para você quando o cliente</span>
              <div className="flex flex-wrap gap-2">
                {HANDOFF_TRIGGERS.map(([k, label]) => {
                  const on = form.aiHandoffTriggers.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on}
                      onClick={() => set("aiHandoffTriggers", on ? form.aiHandoffTriggers.filter((x) => x !== k) : [...form.aiHandoffTriggers, k])}
                      className={cn("h-9 px-3.5 rounded-full border text-[13px] font-semibold", on ? "bg-ink text-white border-ink" : "bg-surface border-control text-ink-2")}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs text-ink-3">
                A conversa aparece em &quot;Precisa de você&quot; na Visão geral e a IA para de responder esse cliente. Ela também chama você quando não souber responder.
              </span>
            </div>
          </ConfigSection>

          <section aria-labelledby="msg-t" className="bg-surface border border-line rounded-2xl overflow-hidden">
            <div className="px-5 md:px-6 pt-5 pb-3 flex flex-col gap-1">
              <h2 id="msg-t" className="text-[17px] font-semibold">Mensagens prontas</h2>
              <span className="text-[13px] text-ink-3">Textos fixos para momentos da conversa. Em branco, a IA escreve do jeito dela.</span>
            </div>
            {MESSAGES.map(([k, title, when, example]) => (
              <div key={k} className="px-5 md:px-6 py-3.5 border-t border-line-2 flex flex-col gap-2.5">
                <div className="flex items-center gap-3.5">
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="text-sm font-semibold">{title} <span className="font-normal text-ink-3">· {when}</span></span>
                    {editing !== k && (
                      <span className={cn("text-[13px] truncate", form[k] ? "text-ink-2" : "text-ink-4 italic")}>{form[k] || "A IA escreve na hora"}</span>
                    )}
                  </div>
                  <button type="button" aria-label={`${editing === k ? "Fechar" : "Editar"} mensagem de ${title}`}
                    onClick={() => setEditing(editing === k ? null : k)}
                    className="h-[34px] px-3 rounded-[9px] border border-control bg-surface text-xs font-semibold hover:bg-surface-2 shrink-0">
                    {editing === k ? "Pronto" : "Editar"}
                  </button>
                </div>
                {editing === k && (
                  <label className="flex flex-col gap-1.5">
                    <textarea rows={3} maxLength={500} autoFocus value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={`Ex.: ${example}`}
                      aria-label={`Mensagem de ${title}`} className={cn(fieldCls, "h-auto py-2.5 resize-none leading-relaxed")} />
                    <Counter n={form[k].length} max={500} />
                  </label>
                )}
              </div>
            ))}
          </section>
        </div>

        <aside aria-label="Prévia da conversa" className="flex flex-col gap-3 lg:sticky lg:top-6">
          <div className="flex justify-between items-baseline gap-3">
            <span className="text-[15px] font-semibold">Prévia</span>
            <span className="text-xs text-ink-3">{tone ? "exemplo com o tom escolhido" : "exemplo; o texto real segue a sua personalidade"}</span>
          </div>
          <PhonePreview name={displayName} bubbles={preview} />
          <Button onClick={save} loading={saving} disabled={!dirty} className="h-[46px]">
            {dirty ? "Salvar" : "Tudo salvo"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
