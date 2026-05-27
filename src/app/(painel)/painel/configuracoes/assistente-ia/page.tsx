"use client";
import { useEffect, useState } from "react";
import {
  Bot, Save, Loader2, CheckCircle, Sparkles,
  MessageSquare, Info, AlertTriangle, User,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import Button from "@/components/ui/Button";

const PERSONALITY_PLACEHOLDER = `Descreva como seu assistente deve se comunicar com os clientes.

Exemplos:
• "Somos uma barbearia descontraída de bairro. Chame o cliente de 'parceiro'. Seja direto e simpático."
• "Barbearia executiva, trato formal. Use 'senhor/senhora'. Seja objetivo e profissional."
• "Ambiente jovem, linguagem casual. Use emojis com moderação. Sempre ofereça alternativas de horário."`;

const GREETING_PLACEHOLDER = `Descreva o tom da primeira mensagem do dia.

Exemplos:
• "Cumprimente com entusiasmo e pergunte em que pode ajudar."
• "Apresente-se pelo nome e diga que está à disposição para agendar."`;

export default function AssistenteIAPage() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [assistantName, setAssistantName] = useState("");
  const [personality, setPersonality] = useState("");
  const [greetingDirective, setGreetingDirective] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/barbershop/ai-config", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setAssistantName(data.aiAssistantName ?? "");
          setPersonality(data.aiPersonality ?? "");
          setGreetingDirective(data.aiGreetingDirective ?? "");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/barbershop/ai-config", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          aiAssistantName: assistantName || null,
          aiPersonality: personality || null,
          aiGreetingDirective: greetingDirective || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // Preview do system prompt que vai para o LLM
  const previewName = assistantName || "Assistente";
  const previewPersonality = personality || "(nenhuma personalidade configurada — o assistente usará um comportamento neutro)";
  const previewGreeting = greetingDirective || "(nenhuma diretriz — o assistente cumprimentará de forma padrão)";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          Assistente IA
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Configure como o assistente de WhatsApp se comunica com os seus clientes.
        </p>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-800 space-y-1">
          <p className="font-bold">Como funciona</p>
          <p>
            Quando um cliente manda mensagem no WhatsApp da sua barbearia, o assistente IA
            lê estas configurações e responde com a personalidade que você definiu aqui —
            incluindo agendamentos, serviços e horários disponíveis em tempo real.
          </p>
        </div>
      </div>

      {/* Nome do assistente */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <User className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">Nome do Assistente</h3>
            <p className="text-xs text-zinc-500">Como o assistente se apresenta para o cliente.</p>
          </div>
        </div>

        <div>
          <input
            type="text"
            value={assistantName}
            onChange={(e) => setAssistantName(e.target.value.slice(0, 50))}
            placeholder="Ex: Barba Bot, Assistente da Barbearia X, Júlio..."
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          />
          <div className="flex justify-between mt-1.5">
            <p className="text-xs text-zinc-400">Deixe em branco para usar o nome da barbearia.</p>
            <span className={`text-xs ${assistantName.length >= 45 ? "text-amber-500" : "text-zinc-400"}`}>
              {assistantName.length}/50
            </span>
          </div>
        </div>
      </div>

      {/* Personalidade */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">Personalidade e Tom de Voz</h3>
            <p className="text-xs text-zinc-500">
              Este texto vai direto para o assistente como instrução de comportamento. Seja específico.
            </p>
          </div>
        </div>

        <textarea
          value={personality}
          onChange={(e) => setPersonality(e.target.value.slice(0, 500))}
          placeholder={PERSONALITY_PLACEHOLDER}
          rows={6}
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
        />
        <div className="flex justify-between">
          <p className="text-xs text-zinc-400">Máximo 500 caracteres.</p>
          <span className={`text-xs ${personality.length >= 480 ? "text-amber-500" : "text-zinc-400"}`}>
            {personality.length}/500
          </span>
        </div>
      </div>

      {/* Diretriz de saudação */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">Diretriz de Saudação</h3>
            <p className="text-xs text-zinc-500">
              Como o assistente deve se comportar na primeira mensagem do cliente no dia.
              <strong className="text-zinc-600"> Isso é um estilo, não uma mensagem literal.</strong>
            </p>
          </div>
        </div>

        <textarea
          value={greetingDirective}
          onChange={(e) => setGreetingDirective(e.target.value.slice(0, 200))}
          placeholder={GREETING_PLACEHOLDER}
          rows={3}
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
        />
        <div className="flex justify-between">
          <p className="text-xs text-zinc-400">Máximo 200 caracteres.</p>
          <span className={`text-xs ${greetingDirective.length >= 190 ? "text-amber-500" : "text-zinc-400"}`}>
            {greetingDirective.length}/200
          </span>
        </div>
      </div>

      {/* Preview do system prompt */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
            <Bot className="w-5 h-5 text-zinc-500" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900">Pré-visualização</h3>
            <p className="text-xs text-zinc-500">
              Aproximação de como o assistente receberá as instruções.
            </p>
          </div>
        </div>

        <div className="bg-zinc-950 rounded-xl p-4 font-mono text-xs text-zinc-300 space-y-2 leading-relaxed">
          <p><span className="text-zinc-500">// system prompt</span></p>
          <p>
            <span className="text-violet-400">Você é </span>
            <span className="text-green-400">{previewName}</span>
            <span className="text-violet-400">, assistente da barbearia.</span>
          </p>
          {personality && (
            <p>
              <span className="text-blue-400">Personalidade: </span>
              <span className="text-zinc-300">{personality}</span>
            </p>
          )}
          {!personality && (
            <p className="text-zinc-600 italic">{previewPersonality}</p>
          )}
          <p>
            <span className="text-amber-400">Saudação: </span>
            <span className="text-zinc-300 italic">{greetingDirective || previewGreeting}</span>
          </p>
          <p>
            <span className="text-zinc-500">// + horários de funcionamento + serviços + slots injetados pelo N8N</span>
          </p>
        </div>
      </div>

      {/* Aviso se campos vazios */}
      {(!personality) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800">
            <p className="font-bold mb-1">Assistente sem personalidade configurada</p>
            <p>
              O assistente vai funcionar, mas responderá de forma neutra e genérica.
              Preencha a Personalidade para que ele fale com a identidade da sua barbearia.
            </p>
          </div>
        </div>
      )}

      {/* Salvar */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} loading={saving} className="px-8">
          {saved ? <CheckCircle className="w-4 h-4 mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
          {saved ? "Salvo com Sucesso!" : "Salvar Configurações"}
        </Button>
        {saved && (
          <span className="text-sm text-green-600 font-medium animate-pulse">
            ✓ Alterações aplicadas
          </span>
        )}
      </div>
    </div>
  );
}
