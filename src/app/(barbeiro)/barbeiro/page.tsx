"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Calendar, CheckCircle, XCircle, UserX, Clock, DollarSign, TrendingUp, Phone, ChevronLeft, ChevronRight, Scissors, Plus, Minus, Package, X, AlertTriangle, Lock, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

interface Appointment {
  id: string; startTime: string; endTime: string; status: string; price: number;
  client: { name: string; phone: string | null };
  service: { id: string; name: string; duration: number } | null;
  services: { service: { id: string; name: string; price: number; duration: number } }[];
  subscription: { id: string; status: string; plan: { name: string; extraDiscount: number; planServices: { serviceId: string }[] } } | null;
}

interface Block { id: string; startTime: string; endTime: string; reason: string | null }

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hora", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2 horas", value: 120 },
  { label: "3 horas", value: 180 },
  { label: "Dia todo", value: 480 },
];

const PX_PER_MIN = 1.5;
const CAL_START = 7;
const CAL_END = 22;
const PX_PER_HOUR = PX_PER_MIN * 60;

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function timeToTop(t: string) {
  return (timeToMin(t) - CAL_START * 60) * PX_PER_MIN;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function VenderProdutoModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [products, setProducts] = useState<{ id: string; name: string; price: number; stock: number }[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    fetch("/api/barbershop/products", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setProducts((d.products || []).filter((p: any) => p.active !== false)))
      .finally(() => setLoadingProducts(false));
  }, [token]);

  function changeQty(id: string, delta: number) {
    setQtys(q => {
      const cur = q[id] ?? 0;
      const next = Math.max(0, cur + delta);
      if (next === 0) { const { [id]: _removed, ...rest } = q; return rest; }
      return { ...q, [id]: next };
    });
  }

  const total = Object.entries(qtys).reduce(
    (sum, [id, q]) => sum + (products.find(p => p.id === id)?.price ?? 0) * q, 0
  );
  const hasItems = Object.values(qtys).some(q => q > 0);

  async function handleSell() {
    if (!hasItems) return;
    setSaving(true);
    await Promise.all(
      Object.entries(qtys)
        .filter(([, q]) => q > 0)
        .map(([pid, qty]) =>
          fetch(`/api/barbershop/products/${pid}/sell`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ quantity: qty, paymentMethod }),
          })
        )
    );
    setSaving(false);
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            <h2 className="font-bold text-zinc-900">Vender Produto</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {done ? (
            <div className="text-center py-6">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="font-bold text-zinc-900 text-lg">Venda registrada!</p>
              <p className="text-sm text-zinc-500 mt-1">Total: {formatCurrency(total)}</p>
              <button onClick={onClose} className="mt-5 w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors">
                Fechar
              </button>
            </div>
          ) : (
            <>
              {loadingProducts ? (
                <p className="text-xs text-zinc-400 py-4 text-center">Carregando produtos...</p>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-zinc-400">
                  <Package className="w-8 h-8" />
                  <p className="text-sm">Sem produtos no estoque.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map(p => {
                    const qty = qtys[p.id] ?? 0;
                    return (
                      <div key={p.id} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors ${qty > 0 ? "border-primary/30 bg-primary/5" : "border-zinc-100"}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{p.name}</p>
                          <p className="text-xs text-zinc-400">
                            {formatCurrency(p.price)}{p.stock > 0 ? ` · ${p.stock} em estoque` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => changeQty(p.id, -1)} disabled={qty === 0}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50 transition-colors">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold text-zinc-800">{qty}</span>
                          <button onClick={() => changeQty(p.id, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {hasItems && (
                <>
                  <div className="pt-3 border-t border-zinc-100">
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Forma de pagamento</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "CASH", label: "Dinheiro" },
                        { id: "PIX", label: "Pix" },
                        { id: "CREDIT_CARD", label: "Cartão Crédito" },
                        { id: "DEBIT_CARD", label: "Cartão Débito" },
                      ].map((pm) => (
                        <button key={pm.id} onClick={() => setPaymentMethod(pm.id)}
                          className={`p-2.5 rounded-xl border text-sm font-semibold transition-colors ${paymentMethod === pm.id ? "bg-primary border-primary text-white" : "bg-white border-zinc-200 text-zinc-700 hover:border-primary/40"}`}>
                          {pm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <span className="text-sm font-bold text-zinc-900">Total:</span>
                    <span className="text-xl font-black text-primary/90">{formatCurrency(total)}</span>
                  </div>

                  <button onClick={handleSell} disabled={saving}
                    className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
                    {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Package className="w-4 h-4" /> Confirmar Venda</>}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BloquearAgendaModal({ token, date, onClose, onBlocked }: { token: string; date: string; onClose: () => void; onBlocked: () => void }) {
  const brTimeNow = new Intl.DateTimeFormat("en", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
  const [brH, brM] = brTimeNow.split(":").map(Number);
  const currentTime = `${String(brH).padStart(2, "0")}:${String(Math.ceil(brM / 15) * 15 % 60).padStart(2, "0")}`;
  const [startTime, setStartTime] = useState(currentTime);
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const endTime = addMinutes(startTime, duration);

  async function handleBlock() {
    setSaving(true);
    await fetch("/api/barber/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, startTime, endTime, reason }),
    });
    setSaving(false);
    onBlocked();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-500" />
            <h2 className="font-bold text-zinc-900">Bloquear Agenda</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-2">Duração do bloqueio</label>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((d) => (
                <button key={d.value} onClick={() => setDuration(d.value)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${duration === d.value ? "bg-red-500 border-red-500 text-white" : "bg-white border-zinc-200 text-zinc-700 hover:border-red-300"}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Início</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>

          <div className="bg-red-50 rounded-xl border border-red-100 px-4 py-3 text-sm text-red-700">
            Agenda bloqueada das <strong>{startTime}</strong> às <strong>{endTime}</strong>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Motivo (opcional)</label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Almoço, Reunião..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-400" />
          </div>

          <button onClick={handleBlock} disabled={saving}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Lock className="w-4 h-4" /> Bloquear Agora</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const DIAS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function getTodayBR() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const todayBR = getTodayBR();
  const tomorrowDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowBR = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
  if (dateStr === todayBR) return "Hoje";
  if (dateStr === tomorrowBR) return "Amanhã";
  return `${DIAS_PT[d.getDay()]}, ${d.getDate()} ${MESES_PT[d.getMonth()]}`;
}

/* ─── Modal de agendamento do barbeiro (admin-grade) ─── */
function BarberAgendamentoModal({
  barberId, date, onConfirm, onClose, initialStartTime,
}: {
  barberId: string;
  date: string;
  onConfirm: (data: { clientName: string; clientPhone: string; barberId: string; serviceIds: string[]; date: string; startTime: string; beneficiaryName?: string; price?: number }) => Promise<boolean>;
  onClose: () => void;
  initialStartTime?: string;
}) {
  const { token } = useAuthStore();
  const [services, setServices] = useState<{ id: string; name: string; price: number; duration: number }[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(date);
  const [startTime, setStartTime] = useState(initialStartTime ?? "09:00");
  const [saving, setSaving] = useState(false);
  const [activeSub, setActiveSub] = useState<{ id: string; beneficiaries: any[]; plan: any; nextBillingDate?: string; _overdue?: boolean } | null>(null);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [clientSuggestions, setClientSuggestions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (clientName.length < 2) { setClientSuggestions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/barbershop/clients?q=${encodeURIComponent(clientName)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setClientSuggestions(d.clients || []));
    }, 200);
    return () => clearTimeout(t);
  }, [clientName, token]);

  function handleSelectBeneficiary(b: any) {
    if (b.uses >= b.maxUses) return;
    setBeneficiaryName(b.name);
    if (activeSub?.plan?.planServices) {
      const planServiceIds = activeSub.plan.planServices.map((ps: any) => ps.serviceId);
      setSelectedServiceIds(prev => {
        const newIds = [...prev];
        planServiceIds.forEach((id: string) => { if (!newIds.includes(id)) newIds.push(id); });
        return newIds;
      });
    }
  }

  useEffect(() => {
    const phone = clientPhone.replace(/\D/g, "");
    if (phone.length >= 10) {
      fetch(`/api/barbershop/subscriptions?phone=${phone}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          const sub = (d.subscriptions || []).find((s: any) => s.status === "ACTIVE");
          if (sub) {
            const isOverdue = new Date(sub.nextBillingDate) < new Date();
            if (isOverdue) {
              setActiveSub({ ...sub, _overdue: true });
              setBeneficiaryName("");
            } else if (Array.isArray(sub.beneficiaries) && sub.beneficiaries.length > 0) {
              setActiveSub(sub);
              setBeneficiaryName(sub.beneficiaries[0]?.name || "");
            } else {
              setActiveSub(null);
              setBeneficiaryName("");
            }
            if (sub.client?.name && !clientName) setClientName(sub.client.name);
          } else {
            setActiveSub(null);
            setBeneficiaryName("");
          }
        });
    } else {
      setActiveSub(null);
      setBeneficiaryName("");
    }
  }, [clientPhone, token]);

  useEffect(() => {
    fetch("/api/barbershop/services", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setServices((d.services || []).filter((s: any) => s.active)));
  }, [token]);

  function toggleService(id: string) {
    setSelectedServiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const totalPrice = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + s.price, 0);
  const totalDuration = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + s.duration, 0);

  let discount = 0;
  if (activeSub && beneficiaryName && !activeSub._overdue && activeSub.plan?.planServices?.length > 0) {
    const planSvcIds = activeSub.plan.planServices.map((ps: any) => ps.serviceId);
    discount = services
      .filter(s => selectedServiceIds.includes(s.id) && planSvcIds.includes(s.id))
      .reduce((sum, s) => sum + s.price, 0);
  }
  const finalPrice = Math.max(0, totalPrice - discount);

  const endTimeDisplay = (() => {
    const [h, m] = startTime.split(":").map(Number);
    const endTotal = h * 60 + m + totalDuration;
    return `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Novo agendamento</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4 text-zinc-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">Nome do Cliente</label>
            <div className="relative">
              <input
                value={clientName}
                onChange={(e) => { setClientName(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Ex: João Silva"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {clientSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onMouseDown={() => {
                        setClientName(c.name);
                        setClientPhone(c.phone ?? "");
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-50 flex items-center justify-between gap-2 border-b border-zinc-100 last:border-0"
                    >
                      <span className="font-medium text-zinc-900">{c.name}</span>
                      {c.phone && <span className="text-xs text-zinc-400 shrink-0">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-1">WhatsApp (com DDD)</label>
            <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Ex: 11999999999"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {activeSub?._overdue ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider">⚠️ Assinatura Vencida</p>
              <p className="text-xs text-red-600 mt-1">Pagamento pendente. O plano não pode ser utilizado até a regularização.</p>
            </div>
          ) : activeSub && (
            <div className="bg-primary/10 border border-amber-200 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wider">Assinatura Familiar Ativa</label>
              <div className="flex flex-wrap gap-2">
                {activeSub.beneficiaries.map((b: any, i: number) => (
                  <button key={i} type="button" onClick={() => handleSelectBeneficiary(b)} disabled={b.uses >= b.maxUses}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${
                      beneficiaryName === b.name
                        ? "bg-primary text-white border-primary/90 shadow-sm"
                        : b.uses >= b.maxUses
                          ? "bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed"
                          : "bg-white text-amber-700 border-amber-200 hover:bg-primary/20"
                    }`}>
                    {b.name}
                    <span className="block text-[10px] opacity-80">
                      {b.uses >= b.maxUses ? "Cota esgotada" : `${b.uses}/${b.maxUses} usos`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {services.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-900 mb-1.5">Serviços <span className="text-zinc-500 font-normal">(selecione um ou mais)</span></label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                {services.map((s) => {
                  const checked = selectedServiceIds.includes(s.id);
                  return (
                    <label key={s.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                        checked ? "bg-primary/10 border border-amber-200" : "hover:bg-zinc-50 border border-transparent"
                      }`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleService(s.id)}
                        className="rounded text-primary focus:ring-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{s.name}</p>
                        <p className="text-xs text-zinc-400">{s.duration}min</p>
                      </div>
                      <span className="text-sm font-bold text-zinc-700 shrink-0">R$ {s.price.toFixed(2)}</span>
                    </label>
                  );
                })}
              </div>
              {selectedServiceIds.length > 0 && (
                <div className="flex flex-col gap-1 mt-2 px-1">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>{selectedServiceIds.length} serviço(s) · {totalDuration}min</span>
                    <span>Subtotal: {formatCurrency(totalPrice)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between text-xs text-green-600 font-medium">
                      <span>Desconto Plano ({beneficiaryName})</span>
                      <span>-{formatCurrency(discount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-100 mt-1">
                    <span className="text-sm font-bold text-zinc-900">Total a pagar:</span>
                    <span className="text-lg font-black text-primary/90">{formatCurrency(finalPrice)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-900 ml-1">Data</label>
              <div className="relative">
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-900 ml-1">Horário de Início</label>
              <div className="relative">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase">
                  Fim: {endTimeDisplay}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50">Cancelar</button>
          <button
            onClick={async () => {
              if (!clientName || !clientPhone || selectedServiceIds.length === 0 || !selectedDate) return;
              setSaving(true);
              const success = await onConfirm({ clientName, clientPhone, barberId, serviceIds: selectedServiceIds, date: selectedDate, startTime, beneficiaryName, price: finalPrice });
              setSaving(false);
              if (success) onClose();
            }}
            disabled={saving || selectedServiceIds.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-40">
            {saving ? "Salvando..." : `Agendar${selectedServiceIds.length > 1 ? ` (${selectedServiceIds.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DashData {
  barberName: string;
  hoje: { total: number; done: number; pending: number; noShow: number; faturado: number };
  mes: { atendimentos: number; faturado: number; comissao: number; avulso: number; assinatura: number };
  agenda: Appointment[];
  proximoAgendamento: Appointment | null;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const STATUS_BG: Record<string, string> = {
  CONFIRMED: "bg-primary",
  PENDING: "bg-primary/80",
  DONE: "bg-green-500",
  NO_SHOW: "bg-red-400",
  CANCELLED: "bg-zinc-300",
};

function ApptActionModal({ appt, onClose, onUpdate, onDone, onSaved, onDelete }: {
  appt: Appointment;
  onClose: () => void;
  onUpdate: (id: string, status: string, paymentMethod?: string) => void;
  onDone: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
}) {
  const { token } = useAuthStore();
  const [showPayment, setShowPayment] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(
    appt.subscription?.status === "ACTIVE" ? "SUBSCRIPTION" : "CASH"
  );
  const [tip, setTip] = useState("");
  const [extraPaymentMethod, setExtraPaymentMethod] = useState("CASH");
  const [overrideSub, setOverrideSub] = useState<any | null>(null);
  const [applyOverride, setApplyOverride] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string; price: number; stock: number }[]>([]);
  const [allServices, setAllServices] = useState<{ id: string; name: string; price: number; duration: number }[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    appt.services?.length > 0
      ? appt.services.map(s => s.service.id)
      : appt.service?.id ? [appt.service.id] : []
  );
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountSettings, setDiscountSettings] = useState<{ servicesEnabled: boolean; servicesMax: number; productsEnabled: boolean; productsMax: number }>({
    servicesEnabled: false, servicesMax: 20, productsEnabled: false, productsMax: 20,
  });
  const isActive = appt.status === "CONFIRMED" || appt.status === "PENDING";
  const isActiveSub = appt.subscription?.status === "ACTIVE";
  const effectiveSub = isActiveSub ? appt.subscription : (applyOverride ? overrideSub : null);
  const effectiveIsActiveSub = !!effectiveSub;
  const planServiceIds = effectiveSub?.plan?.planServices?.map((ps: any) => ps.serviceId ?? ps.service?.id).filter(Boolean) ?? [];
  const extraServiceIds = effectiveIsActiveSub ? selectedServiceIds.filter(id => !planServiceIds.includes(id)) : [];
  const extraServices = allServices.filter(s => extraServiceIds.includes(s.id));
  const calculatedExtraPrice = extraServices.reduce((sum, s) => sum + s.price, 0);
  const tipAmount = Number(tip) || 0;
  // Preço com desconto aplicado (para extras de assinante ou preço total de avulso)
  const discountedExtraPrice = calculatedExtraPrice * (1 - discountPercent / 100);
  const totalExtraToCharge = discountedExtraPrice + tipAmount;
  // Preço avulso descontado (usado para exibição no modal de não-assinante)
  const baseAppointmentPrice = appt.price;
  const discountedAppointmentPrice = baseAppointmentPrice * (1 - discountPercent / 100);

  useEffect(() => {
    if (!token) return;
    setLoadingServices(true);
    fetch("/api/barbershop/services", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setAllServices((d.services || []).filter((s: any) => s.active)))
      .finally(() => setLoadingServices(false));
    // Carrega configurações de desconto e inicializa % se plano tiver extraDiscount
    fetch("/api/barbershop/financeiro", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setDiscountSettings({
          servicesEnabled: Boolean(d.discountServicesEnabled),
          servicesMax: Number(d.discountServicesMax ?? 20),
          productsEnabled: Boolean(d.discountProductsEnabled),
          productsMax: Number(d.discountProductsMax ?? 20),
        });
        // Pré-preenche desconto automático do plano (só para extras de assinante)
        const planDiscount = appt.subscription?.plan?.extraDiscount ?? 0;
        if (isActiveSub && planDiscount > 0) {
          setDiscountPercent(planDiscount);
        }
      });
  }, [token]);

  useEffect(() => {
    if ((!showPayment && !showProducts) || !token) return;
    setLoadingProducts(true);
    fetch("/api/barbershop/products", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .finally(() => setLoadingProducts(false));
  }, [showPayment, token]);

  // Detecta assinatura ativa do cliente quando o agendamento foi criado sem uma
  useEffect(() => {
    if (isActiveSub || !appt.client?.phone || !token) return;
    const phone = appt.client.phone.replace(/\D/g, "");
    if (phone.length < 10) return;
    fetch(`/api/barbershop/subscriptions?phone=${phone}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        const sub = (d.subscriptions || []).find((s: any) => s.status === "ACTIVE");
        setOverrideSub(sub ?? null);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleApplyOverride() {
    setApplyOverride(true);
    setPaymentMethod("SUBSCRIPTION");
    const d = overrideSub?.plan?.extraDiscount ?? 0;
    if (d > 0) setDiscountPercent(d);
  }

  async function saveServices() {
    if (selectedServiceIds.length === 0) return;
    setSaving(true);
    const r = await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: appt.id, serviceIds: selectedServiceIds }),
    });
    setSaving(false);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(err?.error ?? "Erro ao salvar serviços. Tente novamente.");
      return;
    }
    setShowServices(false);
    onSaved(); // fecha modal e recarrega agenda com os serviços atualizados
  }

  function changeQty(id: string, delta: number) {
    setQtys(q => {
      const cur = q[id] ?? 0;
      const next = Math.max(0, cur + delta);
      if (next === 0) { const { [id]: _removed, ...rest } = q; return rest; }
      return { ...q, [id]: next };
    });
  }

  const productTotal = Object.entries(qtys).reduce(
    (sum, [id, q]) => sum + (products.find(p => p.id === id)?.price ?? 0) * q, 0
  );
  const hasProducts = Object.values(qtys).some(q => q > 0);

  async function handleConfirm() {
    setSaving(true);
    const toSell = Object.entries(qtys).filter(([, q]) => q > 0);
    if (toSell.length > 0) {
      await Promise.all(toSell.map(([pid, qty]) =>
        fetch(`/api/barbershop/products/${pid}/sell`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ quantity: qty, paymentMethod: effectiveIsActiveSub ? extraPaymentMethod : paymentMethod }),
        })
      ));
    }

    // Se os serviços foram alterados, salva primeiro em chamada separada.
    // Enviar serviceIds junto com status DONE faz o backend retornar cedo
    // e pular o contador de uso do plano e a notificação WhatsApp.
    const originalIds = (appt.services?.length > 0
      ? appt.services.map((s: any) => s.service.id)
      : appt.service?.id ? [appt.service.id] : []
    ).slice().sort().join(",");
    const selectedIds = [...selectedServiceIds].sort().join(",");
    if (originalIds !== selectedIds && selectedServiceIds.length > 0) {
      await fetch("/api/barbershop/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: appt.id, serviceIds: selectedServiceIds }),
      });
    }

    // Marca como DONE sem serviceIds — garante que contador do plano e WhatsApp disparem
    await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: appt.id,
        status: "DONE",
        paymentMethod,
        ...(discountPercent > 0 ? { discountPercent } : {}),
        ...(effectiveIsActiveSub && totalExtraToCharge > 0
          ? { extraPrice: totalExtraToCharge, extraPaymentMethod }
          : {}),
        ...(applyOverride && overrideSub ? { subscriptionId: overrideSub.id } : {}),
      }),
    });
    onDone();
    onClose();
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="font-bold text-zinc-900 text-lg">{appt.client.name}</p>
            <p className="text-sm text-zinc-500">
              {(() => {
                if (selectedServiceIds.length > 0 && allServices.length > 0) {
                  const names = allServices.filter(s => selectedServiceIds.includes(s.id)).map(s => s.name).join(" + ");
                  if (names) return names;
                }
                return appt.services?.length > 0
                  ? appt.services.map(s => s.service.name).join(" + ")
                  : appt.service?.name ?? "Serviço";
              })()} · {appt.startTime}–{appt.endTime}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          {isActive && !showPayment && !showServices && (
            <>
              <button
                onClick={() => setShowPayment(true)}
                className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-green-500 border border-green-600 text-white font-bold hover:bg-green-600 active:bg-green-700 transition-colors shadow-lg shadow-green-500/20 text-lg">
                <CheckCircle className="w-6 h-6 shrink-0" />
                <span>Marcar como concluído</span>
              </button>
              <button
                onClick={() => setShowServices(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold hover:bg-amber-100 active:bg-amber-200 transition-colors text-left">
                <Scissors className="w-5 h-5 shrink-0" />
                <span>Adicionar / editar serviços</span>
              </button>
              <button
                onClick={() => { onUpdate(appt.id, "NO_SHOW"); onClose(); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-semibold hover:bg-red-100 active:bg-red-200 transition-colors text-left">
                <UserX className="w-5 h-5 shrink-0" />
                <span>Cliente não compareceu</span>
              </button>
              <button
                onClick={() => { onUpdate(appt.id, "CANCELLED"); onClose(); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-100 active:bg-zinc-200 transition-colors text-left">
                <XCircle className="w-5 h-5 shrink-0" />
                <span>Cancelar agendamento</span>
              </button>
            </>
          )}

          {(isActive || appt.status === "DONE") && showServices && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-semibold text-zinc-900 text-center">Serviços realizados</h3>
              {loadingServices ? (
                <p className="text-sm text-zinc-400 text-center py-4">Carregando...</p>
              ) : (
                <div className="space-y-1.5 border border-zinc-100 rounded-xl p-1 max-h-56 overflow-y-auto">
                  {allServices.map(s => {
                    const checked = selectedServiceIds.includes(s.id);
                    return (
                      <label key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${checked ? "bg-amber-50 border border-amber-200" : "hover:bg-zinc-50 border border-transparent"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedServiceIds(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                          className="rounded text-amber-500 w-4 h-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 truncate">{s.name}</p>
                          <p className="text-xs text-zinc-400">{s.duration}min</p>
                        </div>
                        <span className="text-sm font-bold text-zinc-700 shrink-0">R$ {s.price.toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowServices(false)} className="flex-1 py-3 border border-zinc-200 text-zinc-600 font-semibold rounded-xl hover:bg-zinc-50 transition-colors">Voltar</button>
                <button
                  onClick={saveServices}
                  disabled={saving || selectedServiceIds.length === 0}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}

          {showPayment && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-semibold text-zinc-900 text-center">Fechar comanda</h3>

              {!isActiveSub && overrideSub && !applyOverride && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-blue-700 font-semibold text-sm">Assinante detectado</p>
                    <p className="text-blue-600 text-xs mt-0.5 truncate">Plano: {overrideSub.plan?.name}</p>
                  </div>
                  <button
                    onClick={handleApplyOverride}
                    className="shrink-0 text-xs font-bold text-blue-700 bg-blue-100 border border-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    Usar assinatura
                  </button>
                </div>
              )}

              {effectiveIsActiveSub ? (
                <div className="space-y-3">
                  {/* Serviços cobertos pelo plano */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-green-700 font-semibold text-sm">✅ Coberto pelo plano · {effectiveSub!.plan.name}</p>
                    {allServices.filter(s => planServiceIds.includes(s.id) && selectedServiceIds.includes(s.id)).map(s => (
                      <div key={s.id} className="flex justify-between text-xs text-green-600 mt-1">
                        <span>{s.name}</span>
                        <span className="line-through opacity-60">{formatCurrency(s.price)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Extras automáticos dos serviços adicionados */}
                  {extraServices.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                      <p className="text-amber-700 font-semibold text-sm">Extras a cobrar:</p>
                      {extraServices.map(s => (
                        <div key={s.id} className="flex justify-between text-sm">
                          <span className="text-zinc-700">{s.name}</span>
                          <span className="font-bold text-zinc-900">{formatCurrency(s.price)}</span>
                        </div>
                      ))}
                      {/* Campo de desconto nos extras (se habilitado nas configurações) */}
                      {discountSettings.servicesEnabled && (
                        <div className="pt-2 border-t border-amber-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-700 font-semibold shrink-0">Desconto:</span>
                            <div className="flex items-center gap-1 flex-1">
                              <input
                                type="number" min="0" max={discountSettings.servicesMax} step="1"
                                value={discountPercent}
                                onChange={e => setDiscountPercent(Math.min(discountSettings.servicesMax, Math.max(0, Number(e.target.value))))}
                                className="w-14 rounded-lg border border-amber-300 px-2 py-1 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                              />
                              <span className="text-xs text-amber-700">% (máx. {discountSettings.servicesMax}%)</span>
                            </div>
                          </div>
                          {discountPercent > 0 && (
                            <div className="flex justify-between text-xs mt-1">
                              <span className="text-zinc-500">Desconto:</span>
                              <span className="text-red-500 font-semibold">−{formatCurrency(calculatedExtraPrice - discountedExtraPrice)}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-amber-200">
                        <span>Subtotal:</span>
                        <div className="flex items-center gap-2">
                          {discountPercent > 0 && <span className="text-zinc-400 line-through text-xs font-normal">{formatCurrency(calculatedExtraPrice)}</span>}
                          <span className="text-amber-700">{formatCurrency(discountedExtraPrice)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gorgeta (único campo manual) */}
                  <div>
                    <p className="text-sm font-semibold text-zinc-700 mb-1.5">Gorgeta <span className="font-normal text-zinc-400">(opcional)</span></p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-semibold">R$</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={tip}
                        onChange={(e) => setTip(e.target.value)}
                        placeholder="0,00"
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                    </div>
                  </div>

                  {/* Forma de pagamento — só aparece se houver algo a cobrar */}
                  {totalExtraToCharge > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-zinc-700 mb-1.5">Como pagou {formatCurrency(totalExtraToCharge)}?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "CASH", label: "Dinheiro" },
                          { id: "PIX", label: "Pix" },
                          { id: "CREDIT_CARD", label: "Cartão de Crédito" },
                          { id: "DEBIT_CARD", label: "Cartão de Débito" },
                        ].map((p) => (
                          <button key={p.id} onClick={() => setExtraPaymentMethod(p.id)}
                            className={`p-3 rounded-xl border text-sm font-semibold transition-colors ${extraPaymentMethod === p.id ? "bg-green-500 border-green-500 text-white" : "bg-white border-zinc-200 text-zinc-700 hover:border-green-300"}`}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ── Não-assinante ou OVERDUE: fluxo normal de pagamento ── */
                <>
                  {appt.subscription?.status === "OVERDUE" && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                      <p className="text-orange-700 font-semibold text-sm">⚠️ Assinatura em atraso</p>
                      <p className="text-orange-600 text-xs mt-0.5">Regularize o pagamento antes de usar o plano.</p>
                    </div>
                  )}
                  {/* Resumo de valor + desconto (se habilitado) */}
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-600">Total dos serviços:</span>
                      <span className="font-bold text-zinc-900">{formatCurrency(baseAppointmentPrice)}</span>
                    </div>
                    {discountSettings.servicesEnabled && (
                      <div className="flex items-center gap-2 pt-1 border-t border-zinc-200">
                        <span className="text-xs text-zinc-600 font-semibold shrink-0">Desconto:</span>
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="number" min="0" max={discountSettings.servicesMax} step="1"
                            value={discountPercent}
                            onChange={e => setDiscountPercent(Math.min(discountSettings.servicesMax, Math.max(0, Number(e.target.value))))}
                            className="w-14 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                          />
                          <span className="text-xs text-zinc-500">% (máx. {discountSettings.servicesMax}%)</span>
                        </div>
                      </div>
                    )}
                    {discountPercent > 0 && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Desconto aplicado:</span>
                          <span className="text-red-500 font-semibold">−{formatCurrency(baseAppointmentPrice - discountedAppointmentPrice)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t border-zinc-200 pt-1">
                          <span className="text-zinc-700">Cliente paga:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400 line-through text-xs font-normal">{formatCurrency(baseAppointmentPrice)}</span>
                            <span className="text-green-600">{formatCurrency(discountedAppointmentPrice)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 text-center">Como o cliente pagou?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "CASH", label: "Dinheiro" },
                      { id: "PIX", label: "Pix" },
                      { id: "CREDIT_CARD", label: "Cartão de Crédito" },
                      { id: "DEBIT_CARD", label: "Cartão de Débito" },
                    ].map((p) => (
                      <button key={p.id} onClick={() => setPaymentMethod(p.id)}
                        className={`p-3 rounded-xl border text-sm font-semibold transition-colors ${paymentMethod === p.id ? "bg-green-500 border-green-500 text-white" : "bg-white border-zinc-200 text-zinc-700 hover:border-green-300"}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Produtos vendidos */}
              <div className="pt-3 border-t border-zinc-100">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" /> Produtos vendidos (opcional)
                </p>
                {loadingProducts && (
                  <p className="text-xs text-zinc-400 py-2">Carregando produtos...</p>
                )}
                {!loadingProducts && products.length === 0 && (
                  <div className="flex items-center gap-2 py-2 px-3 bg-zinc-50 rounded-xl border border-zinc-200">
                    <Package className="w-4 h-4 text-zinc-400 shrink-0" />
                    <p className="text-xs text-zinc-500">Sem produtos no estoque. O administrador pode cadastrá-los em <span className="font-semibold">Produtos</span>.</p>
                  </div>
                )}
                {products.length > 0 && (
                  <div className="space-y-2">
                    {products.map(p => {
                      const qty = qtys[p.id] ?? 0;
                      return (
                        <div key={p.id} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-800 truncate">{p.name}</p>
                            <p className="text-xs text-zinc-400">
                              {formatCurrency(p.price)}{p.stock > 0 ? ` · ${p.stock} em estoque` : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => changeQty(p.id, -1)}
                              disabled={qty === 0}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50 transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-5 text-center text-sm font-bold text-zinc-800">{qty}</span>
                            <button
                              onClick={() => changeQty(p.id, 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {hasProducts && (
                  <p className="text-xs text-green-600 font-semibold mt-2 flex items-center gap-1">
                    <Package className="w-3 h-3" /> +{formatCurrency(productTotal)} em produtos
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowPayment(false)} className="flex-1 py-3 border border-zinc-200 text-zinc-600 font-semibold rounded-xl hover:bg-zinc-50 transition-colors">Voltar</button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Confirmar"}
                </button>
              </div>
            </div>
          )}

          {appt.status === "DONE" && !showServices && !showProducts && (
            <div className="space-y-3">
              <div className="text-center py-2">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                <p className="font-semibold text-green-700">Atendimento concluído</p>
              </div>
              <button
                onClick={() => setShowServices(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-semibold hover:bg-amber-100 transition-colors text-left">
                <Scissors className="w-5 h-5 shrink-0" />
                <span>Editar serviços</span>
              </button>
              <button
                onClick={() => setShowProducts(true)}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-semibold hover:bg-blue-100 transition-colors text-left">
                <Package className="w-5 h-5 shrink-0" />
                <span>Adicionar produtos</span>
              </button>
              <button
                onClick={() => { onUpdate(appt.id, "CONFIRMED"); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-500 font-semibold hover:bg-zinc-100 transition-colors text-left">
                <XCircle className="w-5 h-5 shrink-0" />
                <span>Reabrir atendimento</span>
              </button>
            </div>
          )}

          {appt.status === "DONE" && showProducts && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="font-semibold text-zinc-900 text-center">Adicionar produtos</h3>
              {loadingProducts ? (
                <p className="text-sm text-zinc-400 text-center py-4">Carregando...</p>
              ) : products.length === 0 ? (
                <div className="flex items-center gap-2 py-3 px-3 bg-zinc-50 rounded-xl border border-zinc-200">
                  <Package className="w-4 h-4 text-zinc-400 shrink-0" />
                  <p className="text-xs text-zinc-500">Sem produtos no estoque. O administrador pode cadastrá-los em <span className="font-semibold">Produtos</span>.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map(p => {
                    const qty = qtys[p.id] ?? 0;
                    return (
                      <div key={p.id} className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 truncate">{p.name}</p>
                          <p className="text-xs text-zinc-400">{formatCurrency(p.price)}{p.stock > 0 ? ` · ${p.stock} em estoque` : ""}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => changeQty(p.id, -1)} disabled={qty === 0}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50 transition-colors">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold text-zinc-800">{qty}</span>
                          <button onClick={() => changeQty(p.id, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {hasProducts && (
                <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                  <Package className="w-3 h-3" /> +{formatCurrency(productTotal)} em produtos
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowProducts(false); setQtys({}); }} className="flex-1 py-3 border border-zinc-200 text-zinc-600 font-semibold rounded-xl hover:bg-zinc-50 transition-colors">Voltar</button>
                <button
                  onClick={async () => {
                    const toSell = Object.entries(qtys).filter(([, q]) => q > 0);
                    if (toSell.length === 0) return;
                    setSaving(true);
                    await Promise.all(toSell.map(([pid, qty]) =>
                      fetch(`/api/barbershop/products/${pid}/sell`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ quantity: qty, paymentMethod: "CASH" }),
                      })
                    ));
                    setSaving(false);
                    setQtys({});
                    setShowProducts(false);
                  }}
                  disabled={saving || !hasProducts}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Registrar venda"}
                </button>
              </div>
            </div>
          )}
          {appt.status === "NO_SHOW" && (
            <div className="space-y-3">
              <div className="text-center py-2">
                <UserX className="w-10 h-10 text-red-400 mx-auto mb-2" />
                <p className="font-semibold text-red-600">Cliente não compareceu</p>
              </div>
              <button
                onClick={() => { onUpdate(appt.id, "CONFIRMED"); onClose(); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-100 active:bg-zinc-200 transition-colors text-left">
                <XCircle className="w-5 h-5 shrink-0" />
                <span>Reabrir atendimento</span>
              </button>
              {onDelete && (
                <button
                  onClick={() => { if (window.confirm("Excluir este agendamento permanentemente?")) { onDelete(appt.id); onClose(); } }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-semibold hover:bg-red-100 active:bg-red-200 transition-colors text-left">
                  <UserX className="w-5 h-5 shrink-0" />
                  <span>Excluir agendamento</span>
                </button>
              )}
            </div>
          )}
          {appt.status === "CANCELLED" && (
            <div className="space-y-3">
              <div className="text-center py-2">
                <XCircle className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
                <p className="font-semibold text-zinc-500">Agendamento cancelado</p>
              </div>
              <button
                onClick={() => { onUpdate(appt.id, "CONFIRMED"); onClose(); }}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-600 font-semibold hover:bg-zinc-100 active:bg-zinc-200 transition-colors text-left">
                <XCircle className="w-5 h-5 shrink-0" />
                <span>Reabrir atendimento</span>
              </button>
              {onDelete && (
                <button
                  onClick={() => { if (window.confirm("Excluir este agendamento permanentemente?")) { onDelete(appt.id); onClose(); } }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-semibold hover:bg-red-100 active:bg-red-200 transition-colors text-left">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span>Excluir agendamento</span>
                </button>
              )}
            </div>
          )}

          {appt.client.phone && (
            <a href={`tel:${appt.client.phone}`}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors text-sm">
              <Phone className="w-4 h-4" /> Ligar para {appt.client.name.split(" ")[0]}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BarbeiroAgendaPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [agendaDate, setAgendaDate] = useState(getTodayBR);
  const [showNovoAgendamento, setShowNovoAgendamento] = useState(false);
  const [agendamentoInitTime, setAgendamentoInitTime] = useState<string | undefined>(undefined);
  const [showBloquear, setShowBloquear] = useState(false);
  const [showVenderProduto, setShowVenderProduto] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [agendaAppts, setAgendaAppts] = useState<Appointment[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [myBarberId, setMyBarberId] = useState<string | null>(null);
  const [encaixePendingData, setEncaixePendingData] = useState<any>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  const dragOffset = useRef<number>(0);
  const didDrag = useRef(false);
  const [dragOver, setDragOver] = useState<{ mins: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/barber/dashboard", { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (r.ok) setData(d);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadAgenda = useCallback(async (d: string) => {
    const [apptRes, blockRes] = await Promise.all([
      fetch(`/api/barbershop/appointments?date=${d}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/barber/blocks?date=${d}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const apptData = await apptRes.json();
    const blockData = await blockRes.json();
    setAgendaAppts(apptData.appointments || []);
    setBlocks(blockData.blocks || []);
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAgenda(agendaDate); }, [agendaDate, loadAgenda]);

  useEffect(() => {
    if (!token) return;
    fetch("/api/barber/booking-data", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.barberId) setMyBarberId(d.barberId); });
  }, [token]);

  // Auto-scroll para o horário atual
  useEffect(() => {
    if (!calendarRef.current) return;
    const br = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const top = (br.getHours() * 60 + br.getMinutes() - CAL_START * 60) * PX_PER_MIN;
    calendarRef.current.scrollTop = Math.max(0, top - 80);
  }, [agendaDate]);

  async function moveAppointment(apptId: string, newStartMins: number) {
    const appt = agendaAppts.find(a => a.id === apptId);
    if (!appt) return;
    const duration = timeToMin(appt.endTime) - timeToMin(appt.startTime);
    const clamped = Math.max(CAL_START * 60, Math.min(CAL_END * 60 - duration, newStartMins));
    const newStartTime = `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
    if (newStartTime === appt.startTime) return;
    const endMins = clamped + duration;
    const newEndTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
    const prev = agendaAppts;
    setAgendaAppts(cur => cur.map(a => a.id === apptId ? { ...a, startTime: newStartTime, endTime: newEndTime } : a));
    const res = await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: apptId, startTime: newStartTime }),
    });
    if (!res.ok) setAgendaAppts(prev);
  }

  function calcDropMins(clientY: number): number {
    const rect = colRef.current?.getBoundingClientRect();
    if (!rect) return CAL_START * 60;
    const rawMins = (clientY - rect.top - dragOffset.current) / PX_PER_MIN + CAL_START * 60;
    return Math.round(rawMins / 15) * 15;
  }

  async function deleteBlock(id: string) {
    await fetch("/api/barber/blocks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    loadAgenda(agendaDate);
  }

  async function handleNovoAgendamento(data: any): Promise<boolean> {
    try {
      const res = await fetch("/api/barbershop/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, force: false }),
      });
      if (res.status === 409) {
        setEncaixePendingData(data);
        return false;
      }
      if (!res.ok) {
        const err = await res.json();
        alert("Erro ao agendar: " + (err.error || "Tente novamente."));
        return false;
      }
      load();
      loadAgenda(agendaDate);
      return true;
    } catch (e: any) {
      alert("Erro de conexão: " + e.message);
      return false;
    }
  }

  async function updateStatus(id: string, status: string, paymentMethod?: string) {
    const prev = agendaAppts;
    setAgendaAppts(cur => cur.map(a => a.id === id ? { ...a, status } : a));
    const r = await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status, paymentMethod }),
    });
    if (!r.ok) {
      setAgendaAppts(prev);
      loadAgenda(agendaDate);
      const err = await r.json().catch(() => ({}));
      alert(err?.error ?? "Erro ao atualizar agendamento. Verifique sua conexão e tente novamente.");
      return;
    }
    load();
    loadAgenda(agendaDate);
  }

  async function deleteAppointment(id: string) {
    setAgendaAppts(cur => cur.filter(a => a.id !== id));
    const r = await fetch(`/api/barbershop/appointments?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      loadAgenda(agendaDate);
      const err = await r.json().catch(() => ({}));
      alert(err?.error ?? "Erro ao excluir agendamento.");
      return;
    }
    loadAgenda(agendaDate);
  }

  function prevDay() {
    const d = new Date(agendaDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setAgendaDate(d.toISOString().slice(0, 10));
  }
  function nextDay() {
    const d = new Date(agendaDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setAgendaDate(d.toISOString().slice(0, 10));
  }

  const isToday = agendaDate === getTodayBR();
  const totalHeight = (CAL_END - CAL_START) * PX_PER_HOUR;
  const hours = Array.from({ length: CAL_END - CAL_START + 1 }, (_, i) => CAL_START + i);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!data) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-zinc-500">
      <Scissors className="w-10 h-10 text-zinc-300" />
      <p className="text-sm">Perfil de barbeiro não encontrado para este usuário.</p>
    </div>
  );

  const d = data;

  const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const nowTop = (brNow.getHours() * 60 + brNow.getMinutes() - CAL_START * 60) * PX_PER_MIN;
  const showNowLine = isToday && nowTop >= 0 && nowTop <= totalHeight;

  return (
    <div className="space-y-6">
      {showNovoAgendamento && myBarberId && (
        <BarberAgendamentoModal
          barberId={myBarberId}
          date={agendaDate}
          onConfirm={handleNovoAgendamento}
          initialStartTime={agendamentoInitTime}
          onClose={() => { setShowNovoAgendamento(false); setAgendamentoInitTime(undefined); }}
        />
      )}
      {encaixePendingData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-primary/90" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Choque de Horário</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Este horário já está ocupado. Deseja forçar a criação como um <strong>ENCAIXE</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setEncaixePendingData(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors">Cancelar</button>
              <button onClick={async () => {
                const pending = encaixePendingData;
                setEncaixePendingData(null);
                setShowNovoAgendamento(false);
                const res = await fetch("/api/barbershop/appointments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ ...pending, force: true }),
                });
                if (!res.ok) {
                  const err = await res.json();
                  alert("Erro ao salvar encaixe: " + (err.error || "Desconhecido"));
                }
                load();
                loadAgenda(agendaDate);
              }} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">Confirmar Encaixe</button>
            </div>
          </div>
        </div>
      )}
      {showBloquear && (
        <BloquearAgendaModal
          token={token!}
          date={agendaDate}
          onClose={() => setShowBloquear(false)}
          onBlocked={() => loadAgenda(agendaDate)}
        />
      )}
      {showVenderProduto && (
        <VenderProdutoModal
          token={token!}
          onClose={() => setShowVenderProduto(false)}
        />
      )}
      {selectedAppt && (
        <ApptActionModal
          appt={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          onUpdate={(id, status, paymentMethod) => { updateStatus(id, status, paymentMethod); setSelectedAppt(null); }}
          onDone={() => {
            setAgendaAppts(cur => cur.map(a => a.id === selectedAppt.id ? { ...a, status: "DONE" } : a));
            setSelectedAppt(null);
            loadAgenda(agendaDate);
          }}
          onSaved={() => { setSelectedAppt(null); loadAgenda(agendaDate); }}
          onDelete={(id) => { deleteAppointment(id); setSelectedAppt(null); }}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Olá, {d.barberName.split(" ")[0]}!</h1>
        <p className="text-zinc-500 text-sm mt-0.5">{formatDate(new Date())} — Aqui está o resumo do seu dia</p>
      </div>

      {/* KPIs de hoje */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-zinc-100 p-4 text-center">
          <Calendar className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-zinc-900">{d.hoje.total}</p>
          <p className="text-xs text-zinc-400">hoje</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-700">{d.hoje.done}</p>
          <p className="text-xs text-green-600">concluídos</p>
        </div>
        <div className="bg-primary/10 rounded-xl border border-primary/20 p-4 text-center">
          <Clock className="w-5 h-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-700">{d.hoje.pending}</p>
          <p className="text-xs text-primary/90">pendentes</p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-100 p-4 text-center">
          <DollarSign className="w-5 h-5 text-zinc-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-zinc-900">{formatCurrency(d.hoje.faturado)}</p>
          <p className="text-xs text-zinc-400">faturado hoje</p>
        </div>
      </div>

      {/* Próximo agendamento */}
      {d.proximoAgendamento && (
        <div className="bg-primary rounded-xl p-4 text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center shrink-0 text-white font-bold">
            {getInitials(d.proximoAgendamento.client.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs opacity-80 font-medium mb-0.5">PRÓXIMO CLIENTE</p>
            <p className="font-bold truncate">{d.proximoAgendamento.client.name}</p>
            <p className="text-sm opacity-90">{d.proximoAgendamento.service?.name ?? "Serviço"} · {d.proximoAgendamento.startTime}</p>
          </div>
          {d.proximoAgendamento.client.phone && (
            <a href={`tel:${d.proximoAgendamento.client.phone}`}
              className="flex items-center gap-1 bg-primary/80 hover:bg-amber-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
              <Phone className="w-3.5 h-3.5" /> Ligar
            </a>
          )}
        </div>
      )}

      {/* Agenda — Calendário */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={prevDay} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-zinc-500" />
            </button>
            <div className="text-center min-w-[120px]">
              <p className="text-sm font-bold text-zinc-900">{formatDayLabel(agendaDate)}</p>
              {!isToday && <p className="text-xs text-zinc-400">{agendaDate}</p>}
              {isToday && <p className="text-xs text-primary/90 font-medium">Hoje</p>}
            </div>
            <button onClick={nextDay} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>
            {!isToday && (
              <button onClick={() => setAgendaDate(getTodayBR())}
                className="text-xs text-primary/90 font-semibold hover:underline px-1">
                Hoje
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowVenderProduto(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors">
              <Package className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vender</span>
            </button>
            <button onClick={() => setShowBloquear(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
              <Lock className="w-3.5 h-3.5" /> Bloquear
            </button>
            <button onClick={() => setShowNovoAgendamento(true)}
              className="flex items-center gap-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Novo</span>
            </button>
          </div>
        </div>

        {/* Grid de calendário */}
        <div ref={calendarRef} className="overflow-y-auto" style={{ maxHeight: "65vh" }}>
          <div className="flex">
            {/* Eixo de tempo */}
            <div className="w-12 flex-shrink-0 relative select-none bg-white" style={{ height: `${totalHeight}px` }}>
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ top: `${(h - CAL_START) * PX_PER_HOUR - 8}px` }}
                  className="absolute right-2 text-[10px] text-zinc-300 font-medium leading-none"
                >
                  {`${h.toString().padStart(2, "0")}:00`}
                </div>
              ))}
            </div>

            {/* Área de eventos */}
            <div
              ref={colRef}
              className="flex-1 relative border-l border-zinc-100"
              style={{ height: `${totalHeight}px` }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver({ mins: calcDropMins(e.clientY) });
              }}
              onDragLeave={(e) => {
                if (!colRef.current?.contains(e.relatedTarget as Node)) setDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = draggingId.current;
                const mins = calcDropMins(e.clientY);
                setDragOver(null);
                didDrag.current = true;
                setTimeout(() => { didDrag.current = false; }, 100);
                if (id) moveAppointment(id, mins);
              }}
            >
              {/* Linhas de hora */}
              {hours.map((h) => (
                <div
                  key={h}
                  style={{ top: `${(h - CAL_START) * PX_PER_HOUR}px` }}
                  className="absolute left-0 right-0 border-t border-zinc-100"
                />
              ))}
              {/* Linhas de meia hora */}
              {Array.from({ length: CAL_END - CAL_START }, (_, i) => i).map((i) => (
                <div
                  key={`half-${i}`}
                  style={{ top: `${i * PX_PER_HOUR + PX_PER_HOUR / 2}px` }}
                  className="absolute left-0 right-0 border-t border-dashed border-zinc-50"
                />
              ))}

              {/* Linha do horário atual */}
              {showNowLine && (
                <div style={{ top: `${nowTop}px` }} className="absolute left-0 right-0 z-30 flex items-center pointer-events-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                  <div className="flex-1 border-t-2 border-red-500" />
                </div>
              )}

              {/* Click em slot vazio → novo agendamento */}
              <div
                className="absolute inset-0 cursor-crosshair"
                style={{ zIndex: 0 }}
                onClick={(e) => {
                  if (didDrag.current) return;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const rawMins = (e.clientY - rect.top) / PX_PER_MIN + CAL_START * 60;
                  const snapped = Math.round(rawMins / 15) * 15;
                  const clamped = Math.max(CAL_START * 60, Math.min(CAL_END * 60 - 15, snapped));
                  const h = String(Math.floor(clamped / 60)).padStart(2, "0");
                  const m = String(clamped % 60).padStart(2, "0");
                  setAgendamentoInitTime(`${h}:${m}`);
                  setShowNovoAgendamento(true);
                }}
              />

              {/* Drop indicator */}
              {dragOver && (
                <div
                  style={{ top: `${(dragOver.mins - CAL_START * 60) * PX_PER_MIN}px` }}
                  className="absolute left-0 right-0 z-40 flex items-center pointer-events-none"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 -ml-1.5 shrink-0" />
                  <div className="flex-1 border-t-2 border-amber-400 border-dashed" />
                </div>
              )}

              {/* Bloqueios */}
              {blocks.map((b) => {
                const top = timeToTop(b.startTime);
                const dur = timeToMin(b.endTime) - timeToMin(b.startTime);
                const height = Math.max(dur * PX_PER_MIN, 26);
                return (
                  <div
                    key={b.id}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    className="absolute left-1 right-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1 z-20 flex items-center justify-between overflow-hidden"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <Lock className="w-3 h-3 text-red-400 shrink-0" />
                      <span className="text-xs font-semibold text-red-500 truncate">{b.reason || "Bloqueado"}</span>
                    </div>
                    <button
                      onClick={() => deleteBlock(b.id)}
                      className="p-1 hover:bg-red-100 rounded transition-colors shrink-0 ml-1"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                );
              })}

              {/* Agendamentos */}
              {agendaAppts.map((a) => {
                const top = timeToTop(a.startTime);
                const height = Math.max((timeToMin(a.endTime) - timeToMin(a.startTime)) * PX_PER_MIN, 28);
                const bg = STATUS_BG[a.status] ?? "bg-primary";
                const isActive = a.status === "CONFIRMED" || a.status === "PENDING";
                return (
                  <div
                    key={a.id}
                    draggable
                    style={{ top: `${top}px`, height: `${height}px` }}
                    className={`absolute left-1 right-1 ${bg} rounded-lg px-2 py-1 z-20 overflow-hidden cursor-grab select-none active:brightness-90`}
                    onDragStart={(e) => {
                      draggingId.current = a.id;
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      dragOffset.current = e.clientY - rect.top;
                      setTimeout(() => { (e.target as HTMLElement).style.opacity = "0.45"; }, 0);
                    }}
                    onDragEnd={(e) => { (e.target as HTMLElement).style.opacity = "1"; draggingId.current = null; }}
                    onClick={() => { if (didDrag.current) return; setSelectedAppt(a); }}
                  >
                    <div className="flex items-start gap-1 h-full">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate leading-tight">{a.client.name}</p>
                        {height >= 42 && (
                          <p className="text-[11px] text-white/85 truncate leading-tight">{a.service?.name ?? "Serviço"}</p>
                        )}
                        {height >= 58 && a.client.phone && (
                          <p className="text-[10px] text-white/70 flex items-center gap-0.5 leading-tight truncate">
                            <Phone className="w-2.5 h-2.5 shrink-0" /> {a.client.phone}
                          </p>
                        )}
                      </div>
                      {isActive && (
                        <button
                          onClick={(e) => { e.stopPropagation(); updateStatus(a.id, "DONE"); }}
                          className="shrink-0 w-6 h-6 rounded-full bg-white/30 hover:bg-white/50 active:bg-white/60 flex items-center justify-center transition-colors mt-0.5"
                          title="Marcar como concluído"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Estado vazio */}
              {agendaAppts.length === 0 && blocks.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                  <Calendar className="w-8 h-8 text-zinc-200" />
                  <p className="text-xs text-zinc-300">Nenhum agendamento</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="px-4 py-2.5 border-t border-zinc-100 flex items-center gap-3 flex-wrap">
          {[
            { label: "Confirmado", color: "bg-primary" },
            { label: "Concluído", color: "bg-green-500" },
            { label: "Não compareceu", color: "bg-red-400" },
            { label: "Cancelado", color: "bg-zinc-300" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
              <span className="text-[11px] text-zinc-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo do mês */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-5">
        <h2 className="font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Minha produção este mês
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-zinc-900">{d.mes.atendimentos}</p>
            <p className="text-xs text-zinc-400">atendimentos</p>
            <p className="text-xs text-zinc-400 mt-0.5">{d.mes.avulso} avulsos · {d.mes.assinatura} assinaturas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-zinc-900">{formatCurrency(d.mes.faturado)}</p>
            <p className="text-xs text-zinc-400">faturado</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-primary/90">{formatCurrency(d.mes.comissao)}</p>
            <p className="text-xs text-zinc-400">sua comissão</p>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowNovoAgendamento(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-primary hover:bg-primary/90 active:scale-95 text-white font-bold px-5 py-3.5 rounded-2xl shadow-xl transition-all text-sm">
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline">Novo Agendamento</span>
      </button>
    </div>
  );
}
