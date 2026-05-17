"use client";
import { useEffect, useState } from "react";
import {
  Bell, BellOff, Clock, MessageSquare, Save, Loader2,
  CheckCircle, HelpCircle, Sparkles, AlertTriangle
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import Button from "@/components/ui/Button";

const TIMING_OPTIONS = [
  { value: 30,   label: "30 minutos antes" },
  { value: 60,   label: "1 hora antes" },
  { value: 120,  label: "2 horas antes" },
  { value: 240,  label: "4 horas antes" },
  { value: 720,  label: "12 horas antes" },
  { value: 1440, label: "24 horas antes" },
  { value: 2880, label: "48 horas antes" },
];

const DEFAULT_MESSAGE = "Olá {{nome}}! 😊\n\nLembramos que você tem um horário de *{{servico}}* marcado para *{{data}}* às *{{hora}}*.\n\nPodemos confirmar sua presença?";

const VARIABLES = [
  { tag: "{{nome}}", desc: "Nome do cliente" },
  { tag: "{{servico}}", desc: "Nome do serviço agendado" },
  { tag: "{{data}}", desc: "Data do agendamento" },
  { tag: "{{hora}}", desc: "Horário de início" },
  { tag: "{{profissional}}", desc: "Nome do profissional" },
  { tag: "{{empresa}}", desc: "Nome do estabelecimento" },
];

export default function LembretesPage() {
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/barbershop/reminders", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setEnabled(data.reminderEnabled ?? false);
          setMinutes(data.reminderMinutes ?? 60);
          setMessage(data.reminderMessage || "");
        }
      } catch {
        // silently fail on load
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
      const res = await fetch("/api/barbershop/reminders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reminderEnabled: enabled,
          reminderMinutes: minutes,
          reminderMessage: message || null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  // Preview da mensagem com variáveis substituídas
  const previewMsg = (message || DEFAULT_MESSAGE)
    .replace("{{nome}}", "Maria")
    .replace("{{servico}}", "Progressiva")
    .replace("{{data}}", "17/05/2026")
    .replace("{{hora}}", "14:30")
    .replace("{{profissional}}", "Ana")
    .replace("{{empresa}}", "Espaço Beleza");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-primary" />
          Lembretes Automáticos
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Configure o envio automático de lembretes via WhatsApp para reduzir faltas e cancelamentos.
        </p>
      </div>

      {/* Toggle Principal */}
      <div className={`rounded-2xl border-2 p-6 transition-all ${enabled ? "border-green-200 bg-green-50/50" : "border-zinc-200 bg-zinc-50/50"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${enabled ? "bg-green-100" : "bg-zinc-200"}`}>
              {enabled ? <Bell className="w-6 h-6 text-green-600" /> : <BellOff className="w-6 h-6 text-zinc-400" />}
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-lg">
                {enabled ? "Lembretes Ativados" : "Lembretes Desativados"}
              </h2>
              <p className="text-sm text-zinc-500">
                {enabled
                  ? "O sistema está enviando lembretes automáticos para seus clientes."
                  : "Ative para começar a lembrar seus clientes automaticamente via WhatsApp."}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-14 h-8 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${enabled ? "bg-green-500 focus:ring-green-400" : "bg-zinc-300 focus:ring-zinc-400"}`}
          >
            <span className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${enabled ? "translate-x-6" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {enabled && (
        <>
          {/* Timing */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900">Tempo de Antecedência</h3>
                <p className="text-xs text-zinc-500">Quanto tempo antes do horário o cliente receberá o lembrete.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIMING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMinutes(opt.value)}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all border-2 ${
                    minutes === opt.value
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-zinc-150 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mensagem Personalizada */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900">Mensagem Personalizada</h3>
                <p className="text-xs text-zinc-500">Customize a mensagem que o cliente receberá. Use as variáveis abaixo.</p>
              </div>
            </div>

            {/* Variáveis disponíveis */}
            <div className="flex flex-wrap gap-2">
              {VARIABLES.map((v) => (
                <button
                  key={v.tag}
                  onClick={() => setMessage((prev) => prev + v.tag)}
                  className="group relative text-xs font-mono px-2.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer border border-zinc-200"
                >
                  {v.tag}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-36 bg-zinc-900 text-white text-[10px] p-1.5 rounded-lg text-center leading-tight shadow-xl z-50">
                    {v.desc}
                  </span>
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={DEFAULT_MESSAGE}
              rows={5}
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />

            <p className="text-[11px] text-zinc-400 flex items-center gap-1">
              <HelpCircle className="w-3 h-3" />
              Deixe em branco para usar a mensagem padrão do sistema.
            </p>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-zinc-900">Pré-visualização</h3>
                <p className="text-xs text-zinc-500">Assim será a mensagem recebida pelo cliente no WhatsApp.</p>
              </div>
            </div>

            <div className="bg-[#e5ddd5] rounded-2xl p-4">
              <div className="bg-white rounded-xl p-4 max-w-sm shadow-sm">
                <p className="text-sm text-zinc-800 whitespace-pre-line leading-relaxed">{previewMsg}</p>
                <p className="text-[10px] text-zinc-400 text-right mt-2">14:30 ✓✓</p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-bold">Importante:</p>
              <p>O sistema envia os lembretes automaticamente com base no tempo configurado acima. Para funcionar, o WhatsApp do estabelecimento precisa estar conectado no painel.</p>
            </div>
          </div>
        </>
      )}

      {/* Botão Salvar */}
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
