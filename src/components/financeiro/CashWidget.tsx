"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { DollarSign, X, Check, ArrowDownCircle, ArrowUpCircle, AlertCircle, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function CashWidget() {
  const { token, user } = useAuthStore();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [openDrawer, setOpenDrawer] = useState(false);

  // Forms
  const [openingBalance, setOpeningBalance] = useState("");
  const [entryType, setEntryType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [entryCategory, setEntryCategory] = useState<"SANGRIA" | "SUPRIMENTO">("SANGRIA");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryDesc, setEntryDesc] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const [saving, setSaving] = useState(false);

  async function loadSession() {
    try {
      setLoading(true);
      const res = await fetch("/api/barbershop/cashflow", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setSession(data.session || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.role === "OWNER" && token) {
      loadSession();
    }
  }, [user, token]);

  if (user?.role !== "OWNER") return null;

  async function handleOpenCash(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/barbershop/cashflow", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ openingBalance: openingBalance.replace(",", ".") })
    });
    setOpeningBalance("");
    await loadSession();
    setSaving(false);
  }

  async function handleEntry(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/barbershop/cashflow/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        sessionId: session.id,
        type: entryType,
        category: entryCategory,
        description: entryDesc,
        amount: entryAmount.replace(",", ".")
      })
    });
    setEntryAmount("");
    setEntryDesc("");
    await loadSession();
    setSaving(false);
  }

  async function handleCloseCash(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Tem certeza que deseja fechar o caixa agora?")) return;
    
    setSaving(true);
    await fetch("/api/barbershop/cashflow", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        sessionId: session.id,
        closingBalance: closingBalance.replace(",", "."),
        notes: closingNotes
      })
    });
    setClosingBalance("");
    setClosingNotes("");
    setOpenDrawer(false);
    await loadSession();
    setSaving(false);
  }

  const isOpen = !!session;
  
  // Calcula o total do caixa esperado
  const totalIncomes = session?.entries?.filter((e: any) => e.type === "INCOME").reduce((acc: number, e: any) => acc + e.amount, 0) || 0;
  const totalExpenses = session?.entries?.filter((e: any) => e.type === "EXPENSE").reduce((acc: number, e: any) => acc + e.amount, 0) || 0;
  const expectedBalance = totalIncomes - totalExpenses; // O openingBalance já entra como INCOME/SUPRIMENTO na API!

  return (
    <>
      {/* Botão no Sidebar */}
      <div className="px-3 pb-2 pt-1 border-b border-zinc-800">
        <button 
          onClick={() => setOpenDrawer(true)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
            isOpen 
              ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20" 
              : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          }`}
        >
          <DollarSign className="w-4 h-4 shrink-0" />
          <div className="flex-1 text-left">
            <span className="block">{isOpen ? "Caixa Aberto" : "Caixa Fechado"}</span>
            {isOpen && <span className="block text-[10px] opacity-70">Saldo: R$ {expectedBalance.toFixed(2).replace(".", ",")}</span>}
          </div>
        </button>
      </div>

      {/* Slide-over Modal */}
      {openDrawer && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpenDrawer(false)} />
          
          <div className="relative w-full max-w-md bg-white text-zinc-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 bg-zinc-50">
              <div>
                <h2 className="font-black text-zinc-900 text-lg">Fluxo de Caixa Diário</h2>
                <p className="text-xs text-zinc-500 font-medium">
                  {isOpen ? `Aberto desde ${format(new Date(session.openedAt), "HH:mm")}` : "Nenhum caixa aberto"}
                </p>
              </div>
              <button onClick={() => setOpenDrawer(false)} className="p-2 rounded-xl hover:bg-zinc-200 text-zinc-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
              ) : !isOpen ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-amber-800 text-sm flex gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>Você precisa abrir o caixa do dia informando o troco inicial antes de lançar sangrias ou suprimentos.</p>
                  </div>
                  
                  <form onSubmit={handleOpenCash} className="space-y-4 pt-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 mb-1">Saldo Inicial (Troco) em R$</label>
                      <input 
                        type="text" required value={openingBalance} onChange={e => setOpeningBalance(e.target.value)}
                        placeholder="0,00" inputMode="decimal"
                        className="w-full p-3 rounded-xl border border-zinc-200 text-lg font-bold focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      />
                    </div>
                    <button type="submit" disabled={saving} className="w-full flex justify-center py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity">
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Abrir Caixa Agora"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Resumo do Caixa */}
                  <div className="bg-zinc-900 text-white p-5 rounded-2xl">
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">Saldo Esperado (Gaveta)</p>
                    <p className="text-3xl font-black mb-4">R$ {expectedBalance.toFixed(2).replace(".", ",")}</p>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-zinc-800 pt-3">
                      <div><span className="text-zinc-500">Entradas:</span> <span className="text-green-400 font-bold ml-1">R$ {totalIncomes.toFixed(2).replace(".", ",")}</span></div>
                      <div><span className="text-zinc-500">Saídas:</span> <span className="text-red-400 font-bold ml-1">R$ {totalExpenses.toFixed(2).replace(".", ",")}</span></div>
                    </div>
                  </div>

                  {/* Lançamento Rápido */}
                  <div className="bg-white border border-zinc-200 p-4 rounded-2xl shadow-sm">
                    <p className="text-sm font-bold text-zinc-800 mb-3">Novo Lançamento</p>
                    <form onSubmit={handleEntry} className="space-y-3">
                      <div className="flex rounded-xl p-1 bg-zinc-100">
                        <button type="button" onClick={() => { setEntryType("EXPENSE"); setEntryCategory("SANGRIA"); }}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${entryType === "EXPENSE" ? "bg-white text-red-600 shadow-sm" : "text-zinc-500"}`}>
                          <ArrowDownCircle className="w-3.5 h-3.5" /> Sangria (Saída)
                        </button>
                        <button type="button" onClick={() => { setEntryType("INCOME"); setEntryCategory("SUPRIMENTO"); }}
                          className={`flex-1 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${entryType === "INCOME" ? "bg-white text-green-600 shadow-sm" : "text-zinc-500"}`}>
                          <ArrowUpCircle className="w-3.5 h-3.5" /> Suprimento (Entrada)
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <input required type="text" placeholder="R$ 0,00" value={entryAmount} onChange={e => setEntryAmount(e.target.value)}
                          className="col-span-1 p-2 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary font-bold" />
                        <input required type="text" placeholder="Motivo (ex: Água)" value={entryDesc} onChange={e => setEntryDesc(e.target.value)}
                          className="col-span-2 p-2 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary" />
                      </div>
                      <button type="submit" disabled={saving} className={`w-full py-2.5 rounded-lg text-white font-bold text-sm flex justify-center ${entryType === "EXPENSE" ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"}`}>
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Registrar"}
                      </button>
                    </form>
                  </div>

                  {/* Histórico do Dia */}
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Movimentações do Dia</p>
                    <div className="space-y-2">
                      {session.entries?.map((entry: any) => (
                        <div key={entry.id} className="flex justify-between items-center p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${entry.type === "INCOME" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"}`}>
                              {entry.type === "INCOME" ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-zinc-800">{entry.description}</p>
                              <p className="text-[10px] text-zinc-400">{format(new Date(entry.createdAt), "HH:mm")} • {entry.category}</p>
                            </div>
                          </div>
                          <span className={`text-sm font-bold ${entry.type === "INCOME" ? "text-green-600" : "text-red-500"}`}>
                            {entry.type === "INCOME" ? "+" : "-"} R$ {entry.amount.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      ))}
                      {(!session.entries || session.entries.length === 0) && (
                        <p className="text-xs text-zinc-400 text-center py-4">Nenhuma movimentação ainda.</p>
                      )}
                    </div>
                  </div>

                </div>
              )}
            </div>
            
            {isOpen && (
              <div className="p-5 border-t border-zinc-100 bg-white">
                <form onSubmit={handleCloseCash} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 mb-1">Saldo Final em Caixa (Contagem R$)</label>
                    <input 
                      type="text" required value={closingBalance} onChange={e => setClosingBalance(e.target.value)}
                      placeholder="0,00" inputMode="decimal"
                      className="w-full p-2.5 rounded-lg border border-zinc-200 text-base font-bold focus:ring-1 focus:ring-zinc-900 outline-none"
                    />
                  </div>
                  <button type="submit" disabled={saving} className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-black transition-colors flex justify-center">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Fechar Caixa do Dia"}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
