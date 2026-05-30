"use client";
import { useEffect, useState, useCallback } from "react";
import { Award, Gift, RotateCcw, Loader2, CheckCircle2, AlertTriangle, Star, TrendingUp, Users } from "lucide-react";
import { useAuthStore } from "@/store/auth";

interface LoyaltyClient {
  clientId: string;
  name: string;
  phone: string | null;
  balance: number;
}

interface LoyaltyConfig {
  loyaltyThreshold: number;
  loyaltyDiscountPercent: number;
}

interface RedeemState {
  clientId: string;
  name: string;
  loading: boolean;
}

export default function FidelidadePage() {
  const { token } = useAuthStore();
  const [clients, setClients] = useState<LoyaltyClient[]>([]);
  const [config, setConfig] = useState<LoyaltyConfig>({ loyaltyThreshold: 50, loyaltyDiscountPercent: 10 });
  const [loading, setLoading] = useState(true);
  const [redeemTarget, setRedeemTarget] = useState<RedeemState | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/barbershop/fidelidade", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setClients(d.clients ?? []);
          if (d.config) setConfig(d.config);
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function handleRedeem() {
    if (!redeemTarget) return;
    setRedeemTarget((prev) => prev && { ...prev, loading: true });

    const res = await fetch("/api/barbershop/fidelidade", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientId: redeemTarget.clientId }),
    });
    const data = await res.json();
    setRedeemTarget(null);

    if (!res.ok) {
      setAlert({ type: "error", msg: data.error || "Erro ao resgatar pontos." });
    } else {
      setAlert({
        type: "success",
        msg: `Resgate confirmado! ${redeemTarget.name} ganhou ${data.discountPercent}% de desconto. Saldo restante: ${data.newBalance} pts.`,
      });
      load();
    }
    setTimeout(() => setAlert(null), 6000);
  }

  const eligible = clients.filter((c) => c.balance >= config.loyaltyThreshold);
  const totalPoints = clients.reduce((s, c) => s + c.balance, 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
          <Award className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-black text-zinc-900 dark:text-white">Programa de Fidelidade</h1>
          <p className="text-xs text-zinc-500">Gerencie pontos e resgates dos seus clientes</p>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
          alert.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300"
            : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
        }`}>
          {alert.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{alert.msg}</span>
        </div>
      )}

      {/* Config summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 text-center">
          <p className="text-2xl font-black text-amber-500">{config.loyaltyThreshold}</p>
          <p className="text-[11px] text-zinc-500 mt-1">pts para 1 desconto</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 text-center">
          <p className="text-2xl font-black text-emerald-500">{config.loyaltyDiscountPercent}%</p>
          <p className="text-[11px] text-zinc-500 mt-1">desconto por resgate</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 text-center">
          <p className="text-2xl font-black text-blue-500">{eligible.length}</p>
          <p className="text-[11px] text-zinc-500 mt-1">elegíveis para resgate</p>
        </div>
      </div>

      {/* Eligible banner */}
      {eligible.length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <Star className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
            {eligible.length} cliente{eligible.length > 1 ? "s" : ""} com pontos suficientes para resgatar desconto!
          </p>
        </div>
      )}

      {/* Client list */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-700 dark:text-zinc-300">
            <Users className="w-4 h-4" />
            Ranking de Pontos
          </div>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-zinc-400">
            <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Nenhum cliente com pontos ainda</p>
            <p className="text-xs mt-1">Os pontos são acumulados a cada avaliação enviada</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {clients.map((client, idx) => {
              const isEligible = client.balance >= config.loyaltyThreshold;
              const progress = Math.min(100, (client.balance / config.loyaltyThreshold) * 100);
              return (
                <div key={client.clientId} className="flex items-center gap-4 px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                  {/* Rank */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    idx === 0 ? "bg-amber-100 text-amber-600" :
                    idx === 1 ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300" :
                    idx === 2 ? "bg-orange-100 text-orange-600" :
                    "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                  }`}>
                    {idx + 1}
                  </div>

                  {/* Name + progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{client.name}</span>
                      <span className={`text-xs font-black ml-2 shrink-0 ${isEligible ? "text-amber-500" : "text-zinc-400"}`}>
                        {client.balance} pts
                      </span>
                    </div>
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${isEligible ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    {!isEligible && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        faltam {config.loyaltyThreshold - client.balance} pts para desconto
                      </p>
                    )}
                  </div>

                  {/* Redeem button */}
                  {isEligible && (
                    <button
                      onClick={() => setRedeemTarget({ clientId: client.clientId, name: client.name, loading: false })}
                      className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      Resgatar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {clients.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-xs text-zinc-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {clients.length} cliente{clients.length > 1 ? "s" : ""} com pontos
            </span>
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{totalPoints} pts circulando</span>
          </div>
        )}
      </div>

      {/* Redeem confirmation modal */}
      {redeemTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 mx-auto mb-4">
              <Gift className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-center text-zinc-900 dark:text-white mb-1">Confirmar Resgate</h2>
            <p className="text-sm text-center text-zinc-500 mb-5">
              Aplicar <span className="font-bold text-emerald-600">{config.loyaltyDiscountPercent}% de desconto</span> para{" "}
              <span className="font-bold text-zinc-700 dark:text-zinc-300">{redeemTarget.name}</span>?
              <br />
              <span className="text-xs mt-1 block">{config.loyaltyThreshold} pontos serão debitados do saldo.</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRedeemTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRedeem}
                disabled={redeemTarget.loading}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-sm font-black text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {redeemTarget.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
