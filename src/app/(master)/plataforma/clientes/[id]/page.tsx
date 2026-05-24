"use client";
import { useEffect, useState, use } from "react";
import { useAuthStore } from "@/store/auth";
import { ArrowLeft, User, Phone, Mail, BadgeDollarSign, Plus, Crown, Calendar, CreditCard, Copy, CheckCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export default function ClienteDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");

  // Estado para link de assinatura MP
  const [mpCheckoutUrl, setMpCheckoutUrl] = useState<string | null>(null);
  const [showMpModal, setShowMpModal] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [token, id]);

  async function loadData() {
    try {
      const res = await fetch(`/api/plataforma/tenants/${id}/details`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterPayment(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading("payment");
    try {
      const res = await fetch(`/api/plataforma/tenants/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(paymentAmount), method: paymentMethod })
      });
      if (res.ok) {
        setShowPaymentModal(false);
        setPaymentAmount("");
        await loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleChangePlan(newPlan: string) {
    if (!confirm(`Deseja alterar o plano para ${newPlan}?`)) return;
    setActionLoading("plan");
    try {
      await fetch(`/api/plataforma/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ saasPlan: newPlan })
      });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGenerateMpLink() {
    setActionLoading("mp-link");
    try {
      const res = await fetch("/api/platform/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ barbershopId: id }),
      });
      const json = await res.json();
      if (res.ok && json.checkoutUrl) {
        setMpCheckoutUrl(json.checkoutUrl);
        setShowMpModal(true);
      } else {
        alert(`Erro: ${json.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao gerar link de pagamento.");
    } finally {
      setActionLoading(null);
    }
  }

  function handleCopyLink() {
    if (!mpCheckoutUrl) return;
    navigator.clipboard.writeText(mpCheckoutUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleToggleStatus() {
    const action = data.shop.active ? "BLOQUEAR" : "REATIVAR";
    if (!confirm(`Deseja ${action} esta barbearia? ${data.shop.active ? "Ela perderá acesso ao sistema." : "Ela voltará a ter acesso ao sistema."}`)) return;
    setActionLoading("status");
    try {
      await fetch(`/api/plataforma/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !data.shop.active })
      });
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return <div className="text-white p-8">Assinante não encontrado.</div>;

  const { shop } = data;

  // Calculate total paid
  const totalPaid = (shop.saasPayments || []).reduce((acc: number, p: any) => p.status === "PAID" ? acc + p.amount : acc, 0);
  const paidCount = (shop.saasPayments || []).filter((p: any) => p.status === "PAID").length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/plataforma/clientes" className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            {shop.name}
            {shop.active ? 
              <span className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-full font-bold uppercase">Ativo</span> : 
              <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded-full font-bold uppercase">Bloqueado</span>
            }
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Assinante desde {new Date(shop.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateMpLink}
            disabled={actionLoading === "mp-link"}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            {actionLoading === "mp-link" ? "Gerando..." : "Gerar Link MP"}
          </button>
          <button
            onClick={handleToggleStatus}
            disabled={actionLoading === "status"}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              shop.active
                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
            }`}
          >
            {shop.active ? "Cancelar Assinatura" : "Reativar Assinatura"}
          </button>
        </div>
      </div>

      {/* Info + Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Titular Info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Informações do Titular</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-zinc-300 text-sm">
              <User className="w-4 h-4 text-zinc-500" /> {shop.owner?.name || "—"}
            </div>
            <div className="flex items-center gap-3 text-zinc-300 text-sm">
              <Mail className="w-4 h-4 text-zinc-500" /> {shop.owner?.email || "—"}
            </div>
            <div className="flex items-center gap-3 text-zinc-300 text-sm">
              <Phone className="w-4 h-4 text-zinc-500" /> {shop.owner?.phone || "Não informado"}
            </div>
            <div className="flex items-center gap-3 text-zinc-300 text-sm">
              <Calendar className="w-4 h-4 text-zinc-500" /> Criado em {new Date(shop.createdAt).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </div>

        {/* Plano Atual */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Plano Atual</h3>
          <div className="flex items-center gap-3">
            <Crown className={`w-10 h-10 ${["PREMIUM","ELITE"].includes(shop.saasPlan) ? "text-indigo-400" : "text-zinc-500"}`} />
            <div>
              <p className="text-2xl font-black text-white">{shop.saasPlan}</p>
              <p className="text-xs text-zinc-500">
                {shop.saasPlan === "BASIC" ? "R$ 97/mês" : shop.saasPlan === "PRO" ? "R$ 147/mês" : "R$ 197/mês"}
              </p>
            </div>
          </div>
          {/* Status SaaS */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold w-fit ${
            shop.saasStatus === "ACTIVE"    ? "bg-emerald-500/10 text-emerald-400" :
            shop.saasStatus === "TRIAL"     ? "bg-amber-500/10 text-amber-400" :
            shop.saasStatus === "PAUSED"    ? "bg-blue-500/10 text-blue-400" :
            shop.saasStatus === "CANCELLED" ? "bg-zinc-700 text-zinc-400" :
            "bg-red-500/10 text-red-400"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {shop.saasStatus ?? "TRIAL"}
          </div>
          <div className="pt-4 border-t border-zinc-800">
            <label className="block text-xs font-medium text-zinc-500 mb-2">Alterar Plano</label>
            <select
              value={shop.saasPlan}
              onChange={(e) => handleChangePlan(e.target.value)}
              disabled={actionLoading === "plan"}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
            >
              <option value="BASIC">BASIC — R$ 97/mês</option>
              <option value="PREMIUM">PREMIUM — R$ 197/mês</option>
            </select>
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Resumo Financeiro</h3>
          <div>
            <p className="text-sm text-zinc-500">Total já recebido</p>
            <p className="text-3xl font-black text-emerald-400">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="pt-4 border-t border-zinc-800 flex justify-between">
            <div>
              <p className="text-sm text-zinc-500">Pagamentos realizados</p>
              <p className="text-xl font-bold text-white">{paidCount}</p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Ticket Médio</p>
              <p className="text-xl font-bold text-white">{paidCount > 0 ? formatCurrency(totalPaid / paidCount) : "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Pagamentos SaaS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BadgeDollarSign className="w-5 h-5 text-emerald-500" />
              Histórico de Pagamentos (Mensalidades)
            </h2>
            <p className="text-sm text-zinc-500">Pagamentos de assinatura feitos por esta barbearia.</p>
          </div>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 bg-zinc-100 hover:bg-white text-zinc-900 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Registrar Pagamento Manual
          </button>
        </div>

        <div className="overflow-hidden border border-zinc-800 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 text-sm font-semibold text-zinc-400 border-b border-zinc-800">
                <th className="p-4">Data</th>
                <th className="p-4">Valor</th>
                <th className="p-4">Método</th>
                <th className="p-4">Origem</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-sm">
              {(shop.saasPayments || []).map((p: any) => (
                <tr key={p.id} className="hover:bg-zinc-800/30">
                  <td className="p-4 text-zinc-300">
                    {new Date(p.createdAt).toLocaleDateString('pt-BR')} às {new Date(p.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-4 font-bold text-white">{formatCurrency(p.amount)}</td>
                  <td className="p-4 text-zinc-400">{p.method}</td>
                  <td className="p-4 text-zinc-400">
                    {p.externalId 
                      ? <span className="text-indigo-400 text-xs font-bold bg-indigo-400/10 px-2 py-0.5 rounded-full">Mercado Pago</span>
                      : <span className="text-zinc-400 text-xs font-bold bg-zinc-800 px-2 py-0.5 rounded-full">Manual</span>
                    }
                  </td>
                  <td className="p-4">
                    {p.status === "PAID" ? 
                      <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full text-xs font-bold">PAGO</span> :
                      p.status === "PENDING" ?
                      <span className="text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full text-xs font-bold">PENDENTE</span> :
                      <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded-full text-xs font-bold">{p.status}</span>
                    }
                  </td>
                </tr>
              ))}
              {(!shop.saasPayments || shop.saasPayments.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">Nenhum pagamento registrado ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — Link de Assinatura Mercado Pago */}
      {showMpModal && mpCheckoutUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Link de Assinatura Gerado!</h2>
                <p className="text-sm text-zinc-400">Envie este link para o dono da barbearia autorizar o débito automático.</p>
              </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-2 font-medium">URL do Checkout Mercado Pago:</p>
              <p className="text-xs text-indigo-300 break-all leading-relaxed">{mpCheckoutUrl}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopyLink}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors text-sm"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado!" : "Copiar Link"}
              </button>
              <a
                href={mpCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir
              </a>
              <button
                onClick={() => setShowMpModal(false)}
                className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl font-medium transition-colors text-sm"
              >
                Fechar
              </button>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              💡 O cliente autoriza uma vez e o Mercado Pago cobra automaticamente todo mês.
            </p>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Registrar Pagamento Manual</h2>
            <p className="text-sm text-zinc-400 mb-6">Use quando o assinante pagou via PIX direto na sua conta ou outro meio fora do Mercado Pago.</p>
            <form onSubmit={handleRegisterPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Valor Recebido (R$)</label>
                <input 
                  type="number" step="0.01" required
                  value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="Ex: 197.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Forma de Pagamento</label>
                <select 
                  value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                >
                  <option value="PIX">PIX</option>
                  <option value="CREDIT_CARD">Cartão de Crédito</option>
                  <option value="CASH">Dinheiro / Transferência</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={actionLoading === "payment"} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50">
                  {actionLoading === "payment" ? "Salvando..." : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
