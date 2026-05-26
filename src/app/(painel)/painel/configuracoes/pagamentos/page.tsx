"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2, Eye, EyeOff, ExternalLink, Unlink,
  Loader2, AlertCircle, CreditCard, Repeat, Shield, Wifi, ChevronDown,
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type MpConfig = {
  connected: boolean;
  config?: {
    id: string;
    mpUserId: string;
    active: boolean;
    updatedAt: string;
  };
};

const FEATURES = [
  {
    icon: CreditCard,
    label: "Links de pagamento",
    desc: "Cobranças avulsas via Pix ou cartão",
  },
  {
    icon: Repeat,
    label: "Débito automático",
    desc: "Assinaturas com cobrança recorrente",
  },
  {
    icon: Shield,
    label: "Pagamento seguro",
    desc: "Criptografia e proteção antifraude MP",
  },
];

const OTHER_GATEWAYS = [
  { name: "PagBank",  initials: "PB", color: "#f5a623" },
  { name: "Stripe",   initials: "ST", color: "#635bff" },
  { name: "PagHiper", initials: "PH", color: "#e63946" },
];

export default function PagamentosPage() {
  const { token } = useAuthStore();
  const searchParams = useSearchParams();

  const [mpConfig, setMpConfig]             = useState<MpConfig | null>(null);
  const [mpToken, setMpToken]               = useState("");
  const [showMpToken, setShowMpToken]       = useState(false);
  const [savingMp, setSavingMp]             = useState(false);
  const [mpStatus, setMpStatus]             = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [disconnectingMp, setDisconnectingMp] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [showManual, setShowManual]         = useState(false);

  // ── Lê resultado do OAuth redirect (?mp_oauth=success|error) ─────────────
  useEffect(() => {
    const result = searchParams.get("mp_oauth");
    const reason = searchParams.get("reason");
    if (result === "success") {
      setMpStatus({ type: "success", msg: "Mercado Pago conectado com sucesso via OAuth! 🎉" });
    } else if (result === "error") {
      const messages: Record<string, string> = {
        unauthorized:          "Sessão expirada. Faça login novamente.",
        invalid_state:         "Link de autorização expirado. Tente novamente.",
        token_exchange_failed: "Falha ao obter credenciais do Mercado Pago. Tente novamente.",
        missing_params:        "Resposta inválida do Mercado Pago.",
        db_error:              "Erro ao salvar conexão. Tente novamente.",
        not_configured:        "OAuth não configurado na plataforma. Contate o suporte.",
        access_denied:         "Autorização negada. Você cancelou a conexão.",
      };
      setMpStatus({
        type: "error",
        msg: messages[reason ?? ""] ?? `Erro ao conectar com Mercado Pago (${reason ?? "desconhecido"}).`,
      });
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/barbershop/payment-config", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setMpConfig(d))
      .catch(() => setMpConfig({ connected: false }));
  }, [token]);

  // ── Conexão via OAuth (redirect para MP) ─────────────────────────────────
  function connectMpOAuth() {
    // Redireciona para o initiate — o cookie de sessão é enviado automaticamente
    window.location.href = "/api/payments/mp-oauth/initiate";
  }

  // ── Conexão manual (copia/cola token) ────────────────────────────────────
  async function connectMpManual() {
    if (!mpToken.trim()) return;
    setSavingMp(true);
    setMpStatus(null);
    try {
      const res = await fetch("/api/barbershop/payment-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gateway: "mercadopago", accessToken: mpToken.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro ao conectar");
      setMpConfig({ connected: true, config: d.config });
      setMpToken("");
      setMpStatus({ type: "success", msg: d.message ?? "Mercado Pago conectado com sucesso!" });
    } catch (e) {
      setMpStatus({ type: "error", msg: e instanceof Error ? e.message : "Erro ao conectar" });
    } finally {
      setSavingMp(false);
    }
  }

  async function disconnectMp() {
    setDisconnectingMp(true);
    try {
      const res = await fetch("/api/barbershop/payment-config", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      setMpConfig({ connected: false });
      setConfirmDisconnect(false);
      if (d.warning) setMpStatus({ type: "error", msg: d.warning });
      else setMpStatus({ type: "success", msg: "Mercado Pago desconectado com sucesso." });
    } catch {
      setMpStatus({ type: "error", msg: "Erro ao desconectar. Tente novamente." });
    } finally {
      setDisconnectingMp(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Formas de Pagamento</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Conecte um gateway para aceitar Pix, cartão e ativar cobranças recorrentes nas assinaturas.
          O dinheiro vai direto para a sua conta — a plataforma não cobra nenhuma %.
        </p>
      </div>

      {/* ── Mercado Pago Card ── */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">

        {/* Card header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#009ee3] flex items-center justify-center shrink-0">
              <span className="text-white font-extrabold text-sm tracking-tight select-none">MP</span>
            </div>
            <div>
              <p className="font-semibold text-zinc-900 leading-tight">Mercado Pago</p>
              <p className="text-xs text-zinc-400 mt-0.5">Pix · Cartão · Débito automático</p>
            </div>
          </div>

          {/* Status badge */}
          {mpConfig === null ? (
            <div className="w-4 h-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
          ) : mpConfig.connected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Conectado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
              <Wifi className="w-3.5 h-3.5" />
              Desconectado
            </span>
          )}
        </div>

        {/* Card body */}
        <div className="px-5 py-5">

          {/* ── Loading ── */}
          {mpConfig === null && (
            <div className="flex items-center gap-3 py-4 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Verificando conexão...</span>
            </div>
          )}

          {/* ── Connected ── */}
          {mpConfig?.connected && (
            <div className="space-y-4">

              {/* Features grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FEATURES.map(({ icon: Icon, label, desc }) => (
                  <div
                    key={label}
                    className="flex gap-2.5 p-3 rounded-xl bg-green-50/70 border border-green-100"
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-800">{label}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 leading-tight">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Account info row */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                <div className="w-8 h-8 rounded-full bg-[#009ee3]/10 flex items-center justify-center shrink-0">
                  <span className="text-[#009ee3] text-xs font-extrabold">MP</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-400">Conta conectada</p>
                  <p className="text-sm font-semibold text-zinc-800 truncate font-mono">
                    ID: {mpConfig.config?.mpUserId}
                  </p>
                </div>
                {mpConfig.config?.updatedAt && (
                  <p className="text-xs text-zinc-400 shrink-0">
                    {new Date(mpConfig.config.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>

              {/* Status feedback */}
              {mpStatus && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
                    mpStatus.type === "success"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{mpStatus.msg}</span>
                </div>
              )}

              {/* Disconnect flow */}
              {!confirmDisconnect ? (
                <button
                  onClick={() => { setConfirmDisconnect(true); setMpStatus(null); }}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-red-500 transition-colors"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Desconectar Mercado Pago
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Confirmar desconexão?</p>
                      <p className="text-xs text-red-600 mt-1 leading-relaxed">
                        Assinaturas com débito automático ativo podem ser afetadas. O Mercado Pago
                        deixará de processar cobranças automáticas.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDisconnect(false)}
                      className="flex-1 py-2 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-600 hover:bg-zinc-50 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      disabled={disconnectingMp}
                      onClick={disconnectMp}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-60 transition-colors"
                    >
                      {disconnectingMp
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Unlink className="w-3.5 h-3.5" /> Sim, desconectar</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Disconnected ── */}
          {mpConfig !== null && !mpConfig.connected && (
            <div className="space-y-5">

              {/* Status feedback (OAuth redirect result) */}
              {mpStatus && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
                    mpStatus.type === "success"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-700 border-red-200"
                  }`}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{mpStatus.msg}</span>
                </div>
              )}

              {/* Amber alert */}
              {!mpStatus && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Sua conta ainda não está conectada</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      Conecte sua conta do Mercado Pago para começar a receber via Pix e cartão,
                      e para ativar o débito automático nas assinaturas.
                    </p>
                  </div>
                </div>
              )}

              {/* Features preview — disabled state */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-zinc-50 border border-zinc-100 text-xs text-zinc-400"
                  >
                    <Icon className="w-3.5 h-3.5 text-zinc-300" />
                    {label}
                  </div>
                ))}
              </div>

              {/* ── Botão OAuth (fluxo principal) ── */}
              <button
                onClick={connectMpOAuth}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-[#009ee3] text-white font-semibold text-sm hover:bg-[#0088cc] active:scale-[.99] transition-all shadow-sm"
              >
                <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-extrabold leading-none">MP</span>
                </div>
                Conectar com Mercado Pago
              </button>

              <p className="text-center text-xs text-zinc-400 -mt-2">
                Você será redirecionado para o Mercado Pago para autorizar a conexão
              </p>

              {/* ── Conexão manual (avançado / tokens de teste) ── */}
              <div>
                <button
                  onClick={() => setShowManual((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showManual ? "rotate-180" : ""}`} />
                  Tenho um Access Token (avançado)
                </button>

                {showManual && (
                  <div className="mt-3 space-y-3 p-4 rounded-xl border border-zinc-200 bg-zinc-50">
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Use esta opção para tokens de <span className="font-semibold text-zinc-700">teste</span> (sandbox)
                      ou se preferir inserir o token manualmente.
                    </p>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-zinc-700">
                        Access Token
                      </label>
                      <div className="relative">
                        <input
                          type={showMpToken ? "text" : "password"}
                          value={mpToken}
                          onChange={(e) => { setMpToken(e.target.value); setMpStatus(null); }}
                          onKeyDown={(e) => e.key === "Enter" && connectMpManual()}
                          placeholder="APP_USR-... ou TEST-..."
                          autoComplete="off"
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-[#009ee3]/40 focus:border-[#009ee3] font-mono bg-white transition"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMpToken((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                          {showMpToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <a
                        href="https://www.mercadopago.com.br/developers/panel/app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#009ee3] hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir portal de desenvolvedores
                      </a>
                    </div>

                    <button
                      onClick={connectMpManual}
                      disabled={savingMp || !mpToken.trim()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-zinc-700 text-white font-medium text-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {savingMp ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Validando token...</>
                      ) : (
                        "Conectar com token"
                      )}
                    </button>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>

      {/* ── Outros gateways ── */}
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
          Outros gateways · Em breve
        </p>
        <div className="grid grid-cols-3 gap-3">
          {OTHER_GATEWAYS.map(({ name, initials, color }) => (
            <div
              key={name}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 opacity-50 select-none"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <p className="text-xs font-medium text-zinc-500">{name}</p>
              <span className="text-[10px] text-zinc-400 bg-zinc-200 px-2 py-0.5 rounded-full">Em breve</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
