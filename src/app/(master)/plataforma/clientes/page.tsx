"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import Link from "next/link";
import { Store, ShieldAlert, ShieldCheck } from "lucide-react";

export default function PlataformaClientes() {
  const { token } = useAuthStore();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    loadShops();
  }, [token]);

  async function loadShops() {
    setLoading(true);
    try {
      const res = await fetch("/api/plataforma/tenants", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Falha ao carregar assinantes");
      const data = await res.json();
      setShops(data.shops || []);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Erro ao carregar assinantes");
    } finally {
      setLoading(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: boolean) {
    setErrorMsg("");
    setActionLoading(`status-${id}`);
    try {
      const res = await fetch(`/api/plataforma/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !currentStatus })
      });
      if (!res.ok) throw new Error("Não foi possível alterar o status");
      await loadShops();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Erro ao alterar status");
    } finally {
      setActionLoading(null);
    }
  }

  async function changePlan(id: string, newPlan: string) {
    if (!confirm(`Deseja alterar o plano desta barbearia para ${newPlan}? Isso reativa a assinatura (saasStatus = ACTIVE).`)) return;

    setErrorMsg("");
    setActionLoading(`plan-${id}`);
    try {
      const res = await fetch(`/api/plataforma/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ saasPlan: newPlan })
      });
      if (!res.ok) throw new Error("Não foi possível alterar o plano");
      await loadShops();
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Erro ao alterar plano");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Gestão de Assinantes</h1>
        <p className="text-zinc-400 mt-1">Gerencie as assinaturas das barbearias que utilizam o IaDeBarbearia.</p>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
          <ShieldAlert className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-sm font-semibold text-zinc-400 bg-zinc-950/50">
              <th className="p-4">Barbearia</th>
              <th className="p-4">Assinante Desde</th>
              <th className="p-4">Plano</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-sm">
            {shops.map((shop) => (
              <tr key={shop.id} className="hover:bg-zinc-800/30 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white">{shop.name}</p>
                      <p className="text-xs text-zinc-500">{shop.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-zinc-400">
                  {new Date(shop.createdAt).toLocaleDateString('pt-BR')}
                </td>

                <td className="p-4">
                  <select
                    value={shop.saasPlan === "PREMIUM" ? "ELITE" : shop.saasPlan}
                    onChange={(e) => changePlan(shop.id, e.target.value)}
                    disabled={actionLoading === `plan-${shop.id}`}
                    aria-label={`Plano de ${shop.name}`}
                    className={`px-3 py-1 text-xs font-bold rounded-xl transition-colors appearance-none cursor-pointer outline-none border-0 ${
                      shop.saasPlan === "ELITE" || shop.saasPlan === "PREMIUM"
                        ? "bg-violet-500/20 text-violet-400 focus:ring-2 focus:ring-violet-500/50"
                        : shop.saasPlan === "PRO"
                        ? "bg-amber-500/20 text-amber-400 focus:ring-2 focus:ring-amber-500/50"
                        : "bg-zinc-800 text-zinc-300 focus:ring-2 focus:ring-zinc-600"
                    }`}
                  >
                    <option value="BASIC">BASIC</option>
                    <option value="PRO">PRO</option>
                    <option value="ELITE">ELITE</option>
                  </select>
                </td>
                <td className="p-4">
                  <button 
                    onClick={() => toggleStatus(shop.id, shop.active)}
                    disabled={actionLoading === `status-${shop.id}`}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                      shop.active 
                        ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" 
                        : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                    }`}
                  >
                    {shop.active ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                    {shop.active ? "Ativo" : "Bloqueado"}
                  </button>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/plataforma/clientes/${shop.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      Gerenciar Assinatura 💳
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {shops.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-zinc-500">Nenhuma barbearia cadastrada na plataforma ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
