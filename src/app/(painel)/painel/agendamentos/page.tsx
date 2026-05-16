"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Calendar, CreditCard, Banknote, Smartphone, X, Lock, Trash2, Plus, List, LayoutGrid, ChevronLeft, ChevronRight, AlertTriangle, Edit3 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency } from "@/lib/utils";
import { ConfirmDialog, AlertDialog } from "@/components/ui/ConfirmDialog";

/* ─── Tipos ─── */
interface AppointmentServiceItem {
  service: { id: string; name: string; price: number; duration: number };
  price: number; duration: number;
}
interface Appointment {
  id: string; startTime: string; endTime: string; status: string; price: number; date: string;
  paymentMethod: string | null;
  client: { name: string; phone: string };
  service: { id: string; name: string; duration: number } | null;
  services: AppointmentServiceItem[];
  barber: { id: string; user: { name: string; phone?: string } };
  subscription: { plan: { name: string } } | null;
  beneficiaryName: string | null;
}
interface Bloqueio {
  id: string; startTime: string; endTime: string; reason: string | null;
  barber: { id: string; user: { name: string } };
}
interface Barber { id: string; nickname?: string | null; user: { name: string; phone?: string } }

/* ─── Constantes da grade ─── */
const ROW_H = 12;        // px por 5 minutos
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_MINS = (END_HOUR - START_HOUR) * 60;
const GUTTER_W = 52;     // largura da coluna de horários
const COL_MIN_W = 180;   // largura mínima de cada coluna de barbeiro

const DIAS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  CONFIRMED: { bg: "bg-blue-50",   border: "border-blue-400",  text: "text-blue-800",  dot: "bg-blue-500",  label: "Confirmado" },
  PENDING:   { bg: "bg-amber-50",  border: "border-amber-400", text: "text-amber-800", dot: "bg-amber-400", label: "Aguardando" },
  DONE:      { bg: "bg-green-50",  border: "border-green-400", text: "text-green-800", dot: "bg-green-500", label: "Concluído" },
  NO_SHOW:   { bg: "bg-red-50",    border: "border-red-400",   text: "text-red-800",   dot: "bg-red-400",   label: "Faltou" },
  CANCELLED: { bg: "bg-zinc-100",  border: "border-zinc-300",  text: "text-zinc-500",  dot: "bg-zinc-400",  label: "Cancelado" },
};

const PAYMENT_OPTIONS = [
  { value: "PIX",    label: "PIX",     icon: Smartphone, color: "text-green-600 bg-green-50 border-green-200" },
  { value: "DEBIT",  label: "Débito",  icon: CreditCard, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "CREDIT", label: "Crédito", icon: CreditCard, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "CASH",   label: "Dinheiro",icon: Banknote,   color: "text-amber-600 bg-amber-50 border-amber-200" },
];
const METHOD_LABELS: Record<string, string> = { PIX: "PIX", DEBIT: "Débito", CREDIT: "Crédito", CASH: "Dinheiro" };

/* ─── Helpers ─── */
function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minToTop(t: string) { return ((toMin(t) - START_HOUR * 60) / 5) * ROW_H; }
function durationHeight(start: string, end: string) { return ((toMin(end) - toMin(start)) / 5) * ROW_H; }
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getInitials(name: string) { return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase(); }

/* ─── Modal de pagamento (com edição de serviços) ─── */
function PaymentModal({ 
  appt, services, onConfirm, onUpdateServices, onDelete, onClose 
}: { 
  appt: Appointment; 
  services: any[];
  onConfirm: (id: string, m: string, p: number) => Promise<void>; 
  onUpdateServices: (id: string, sids: string[]) => Promise<void>;
  onDelete: (id: string) => void; 
  onClose: () => void 
}) {
  const [mode, setMode] = useState<"payment" | "edit">("payment");
  const [sel, setSel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!appt || !appt.client) return null;
  
  // Estado para edição de serviços
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    appt.services.length > 0 ? appt.services.map(s => s.service.id) : (appt.service?.id ? [appt.service.id] : [])
  );

  function toggleService(id: string) {
    setSelectedServiceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const totalPrice = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + s.price, 0);
  const totalDuration = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + s.duration, 0);

  // Lógica Rígida na Comanda
  let discount = 0;
  if (appt.beneficiaryName || appt.subscription) {
    const coveredService = services.find(s => 
      selectedServiceIds.includes(s.id) && 
      s.name.toLowerCase().includes("corte") && 
      !s.name.toLowerCase().includes("+")
    );
    if (coveredService) discount = coveredService.price;
  }
  const finalPrice = Math.max(0, totalPrice - discount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
          <h2 className="font-semibold text-zinc-900">
            {mode === "payment" ? "Detalhes / Fechar comanda" : "Editar serviços"}
          </h2>
          <div className="flex items-center gap-1">
            {mode === "payment" && (
              <button onClick={() => onDelete(appt.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Excluir agendamento">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors" title="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto">
          {mode === "payment" ? (
            <>
              <div className="bg-zinc-50 rounded-xl p-3 mb-4 text-sm relative group">
                <p className="font-semibold text-zinc-900">{appt.client.name}</p>
                <p className="text-zinc-500 pr-8">
                  {appt.services.length > 0 ? appt.services.map(s => s.service.name).join(" + ") : appt.service?.name} · {appt.barber.user.name}
                </p>
                <p className="text-amber-600 font-bold text-lg">
                  {discount > 0 ? (
                    <span className="flex flex-col">
                      <span className="text-xs text-zinc-400 line-through font-normal">{formatCurrency(totalPrice)}</span>
                      <span>{formatCurrency(finalPrice)}</span>
                      <span className="text-[10px] text-green-600 font-medium">Plano aplicado: {services.find(s => s.price === discount)?.name || "Corte"}</span>
                    </span>
                  ) : formatCurrency(totalPrice)}
                </p>
                
                <button 
                  onClick={() => setMode("edit")}
                  className="absolute top-3 right-3 p-2 bg-white border border-zinc-200 rounded-lg text-zinc-400 hover:text-amber-500 hover:border-amber-200 shadow-sm transition-all active:scale-95"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
              
              {finalPrice === 0 ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 mt-4 text-center">
                  <p className="text-green-700 font-medium text-sm mb-1">Atendimento 100% coberto pelo plano</p>
                  <p className="text-green-600 text-xs">Nenhum pagamento físico é necessário.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-zinc-500 mb-3 font-medium mt-4">Forma de pagamento:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_OPTIONS.map(({ value, label, icon: Icon, color }) => (
                      <button key={value} onClick={() => setSel(value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all active:scale-95 ${sel === value ? color + " ring-2 ring-offset-1 ring-current" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}>
                        <Icon className="w-5 h-5" /><span className="text-sm font-semibold">{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs text-zinc-500 mb-1.5">Selecione os serviços realizados:</label>
                <div className="space-y-1.5 border border-zinc-100 rounded-xl p-1 max-h-64 overflow-y-auto">
                  {services.map((s) => {
                    const checked = selectedServiceIds.includes(s.id);
                    return (
                      <label key={s.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                          checked ? "bg-amber-50 border border-amber-200" : "hover:bg-zinc-50 border border-transparent"
                        }`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleService(s.id)}
                          className="rounded text-amber-500 focus:ring-amber-500 w-4 h-4" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 truncate">{s.name}</p>
                          <p className="text-xs text-zinc-400">{s.duration}min</p>
                        </div>
                        <span className="text-sm font-bold text-zinc-700 shrink-0">R$ {s.price.toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              
              <div className="bg-zinc-50 rounded-xl p-3 flex justify-between items-center">
                <div className="text-xs text-zinc-500">
                  <p>{selectedServiceIds.length} selecionado(s)</p>
                  <p>{totalDuration} min de duração</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-400">Novo Total</p>
                  <p className="text-lg font-bold text-amber-600">{formatCurrency(totalPrice)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-2 flex gap-2 shrink-0 border-t border-zinc-50 mt-auto">
          {mode === "payment" ? (
            <>
              <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 active:scale-95 transition-all">Cancelar</button>
              <button 
                onClick={async () => { 
                  if (finalPrice > 0 && !sel) return; 
                  setSaving(true); 
                  await onConfirm(appt.id, finalPrice === 0 ? "SUBSCRIPTION" : sel!, finalPrice); 
                  setSaving(false); 
                  onClose(); 
                }}
                disabled={(finalPrice > 0 && !sel) || saving} 
                className={`flex-[1.5] py-3 rounded-xl text-white text-sm font-bold active:scale-95 transition-all shadow-md ${
                  finalPrice === 0 ? "bg-green-600 hover:bg-green-700 shadow-green-200" : "bg-amber-500 hover:bg-amber-600 shadow-amber-200"
                }`}
              >
                {saving ? "Salvando..." : finalPrice === 0 ? "Confirmar Uso do Plano" : "Concluir Atendimento"}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setMode("payment")} className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50 active:scale-95 transition-all">Voltar</button>
              <button 
                onClick={async () => {
                  if (selectedServiceIds.length === 0) {
                    // Como estamos em um sub-componente, vamos usar o alert por enquanto 
                    // ou passar o setAlertDialog via props.
                    // Para manter a simplicidade e garantir que funcione, vou manter o alert aqui
                    // mas com uma mensagem melhorada.
                    alert("⚠️ Selecione ao menos um serviço para continuar.");
                    return;
                  }
                  setSaving(true);
                  await onUpdateServices(appt.id, selectedServiceIds);
                  setSaving(false);
                  setMode("payment");
                }}
                disabled={saving || selectedServiceIds.length === 0}
                className="flex-[1.5] py-3 rounded-xl bg-zinc-900 text-white text-sm font-bold hover:bg-zinc-800 disabled:opacity-40 active:scale-95 transition-all shadow-md shadow-zinc-200"
              >
                {saving ? "Atualizando..." : "Salvar Serviços"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Modal de bloqueio ─── */
function BloqueioModal({ barbers, date, onConfirm, onClose }: {
  barbers: Barber[]; date: string;
  onConfirm: (data: { barberId: string; startTime: string; endTime: string; reason: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Bloquear horário</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4 text-zinc-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {barbers.length > 0 && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Barbeiro</label>
              <select value={barberId} onChange={(e) => setBarberId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.user.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Das</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Até</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Motivo (opcional)</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Almoço..."
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50">Cancelar</button>
          <button onClick={async () => { setSaving(true); await onConfirm({ barberId, startTime, endTime, reason }); setSaving(false); onClose(); }}
            disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-40">
            {saving ? "Bloqueando..." : "Bloquear"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal de agendamento (multi-serviço) ─── */
function AgendamentoModal({
  barbers, date, onConfirm, onClose
}: {
  barbers: Barber[]; date: string;
  onConfirm: (data: { clientName: string; clientPhone: string; barberId: string; serviceIds: string[]; date: string; startTime: string }) => Promise<boolean>;
  onClose: () => void;
}) {
  const { token } = useAuthStore();
  const [services, setServices] = useState<{ id: string; name: string; price: number; duration: number }[]>([]);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(date);
  const [startTime, setStartTime] = useState("09:00");
  const [saving, setSaving] = useState(false);
  const [activeSub, setActiveSub] = useState<{ id: string; beneficiaries: any[]; plan: any } | null>(null);
  const [beneficiaryName, setBeneficiaryName] = useState("");

  function handleSelectBeneficiary(b: any) {
    if (b.uses >= b.maxUses) return;
    setBeneficiaryName(b.name);

    // Auto-seleciona serviços do plano se houver
    if (activeSub?.plan?.planServices) {
      const planServiceIds = activeSub.plan.planServices.map((ps: any) => ps.serviceId);
      setSelectedServiceIds(prev => {
        const newIds = [...prev];
        planServiceIds.forEach((id: string) => {
          if (!newIds.includes(id)) newIds.push(id);
        });
        return newIds;
      });
    }
  }

  // Busca assinatura ao digitar o telefone
  useEffect(() => {
    const phone = clientPhone.replace(/\D/g, "");
    if (phone.length >= 10) {
      fetch(`/api/barbershop/subscriptions?phone=${phone}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => {
          const sub = (d.subscriptions || []).find((s: any) => s.status === "ACTIVE");
          if (sub && Array.isArray(sub.beneficiaries)) {
            // Sprint 1: Verifica se está vencida
            const isOverdue = new Date(sub.nextBillingDate) < new Date();
            if (isOverdue) {
              setActiveSub({ ...sub, _overdue: true });
              setBeneficiaryName("");
            } else {
              setActiveSub(sub);
              setBeneficiaryName(sub.beneficiaries[0]?.name || "");
            }
            // Sincroniza o nome do cliente automaticamente
            if (sub.client?.name && !clientName) {
              setClientName(sub.client.name);
            }
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
      .then(r => r.json()).then(d => {
        const svcs = (d.services || []).filter((s: any) => s.active);
        setServices(svcs);
      });
  }, [token]);

  function toggleService(id: string) {
    setSelectedServiceIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const totalPrice = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + s.price, 0);
  const totalDuration = services.filter(s => selectedServiceIds.includes(s.id)).reduce((sum, s) => sum + s.duration, 0);
  
  // Lógica Rígida: O plano só cobre o serviço de "Corte". 
  // Se o serviço selecionado for o "Corte", ele fica grátis. Todo o restante é cobrado cheio.
  let discount = 0;
  if (activeSub && beneficiaryName) {
    const coveredService = services.find(s => 
      selectedServiceIds.includes(s.id) && 
      s.name.toLowerCase().includes("corte") && 
      !s.name.toLowerCase().includes("+") // Evita combos, foca no serviço puro
    );
    if (coveredService) {
      discount = coveredService.price;
    }
  }
  const finalPrice = Math.max(0, totalPrice - discount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Novo agendamento</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4 text-zinc-500" /></button>
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Nome do Cliente</label>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: João Silva"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">WhatsApp (com DDD)</label>
            <input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="Ex: 11999999999"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>

          {activeSub && (activeSub as any)._overdue ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
              <p className="text-xs font-bold text-red-700 uppercase tracking-wider">⚠️ Assinatura Vencida</p>
              <p className="text-xs text-red-600 mt-1">Pagamento pendente desde {new Date(activeSub.nextBillingDate).toLocaleDateString("pt-BR")}. O plano não pode ser utilizado até a regularização.</p>
            </div>
          ) : activeSub && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 animate-in fade-in slide-in-from-top-2">
              <label className="block text-xs font-bold text-amber-700 mb-1.5 uppercase tracking-wider">Assinatura Familiar Ativa</label>
              <div className="flex flex-wrap gap-2">
                {activeSub.beneficiaries.map((b: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectBeneficiary(b)}
                    disabled={b.uses >= b.maxUses}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${
                      beneficiaryName === b.name 
                        ? "bg-amber-500 text-white border-amber-600 shadow-sm" 
                        : b.uses >= b.maxUses
                          ? "bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed"
                          : "bg-white text-amber-700 border-amber-200 hover:bg-amber-100"
                    }`}
                  >
                    {b.name}
                    <span className="block text-[10px] opacity-80">
                      {b.uses >= b.maxUses ? "Cota esgotada" : `${b.uses}/${b.maxUses} usos`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {barbers.length > 0 && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Barbeiro</label>
              <select value={barberId} onChange={(e) => setBarberId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
                {barbers.map((b) => <option key={b.id} value={b.id}>{b.user.name}</option>)}
              </select>
            </div>
          )}
          {services.length > 0 && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1.5">Serviços <span className="text-zinc-400">(selecione um ou mais)</span></label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                {services.map((s) => {
                  const checked = selectedServiceIds.includes(s.id);
                  return (
                    <label key={s.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                        checked ? "bg-amber-50 border border-amber-200" : "hover:bg-zinc-50 border border-transparent"
                      }`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleService(s.id)}
                        className="rounded text-amber-500 focus:ring-amber-500" />
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
                    <span className="text-lg font-black text-amber-600">{formatCurrency(finalPrice)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-500 ml-1">Data</label>
              <div className="relative">
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-500 ml-1">Horário de Início</label>
              <div className="relative">
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase">
                  Fim: {(() => {
                    const [h, m] = startTime.split(":").map(Number);
                    const endTotal = h * 60 + m + totalDuration;
                    const eh = Math.floor(endTotal / 60);
                    const em = endTotal % 60;
                    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-medium hover:bg-zinc-50">Cancelar</button>
          <button onClick={async () => { 
            if (!clientName || !clientPhone || selectedServiceIds.length === 0 || !barberId || !selectedDate) return;
            setSaving(true); 
            const success = await onConfirm({ 
              clientName, clientPhone, barberId, 
              serviceIds: selectedServiceIds, 
              date: selectedDate, 
              startTime, 
              beneficiaryName,
              price: finalPrice 
            }); 
            setSaving(false); 
            if (success) onClose(); 
          }}
            disabled={saving || selectedServiceIds.length === 0} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-40">
            {saving ? "Salvando..." : `Agendar${selectedServiceIds.length > 1 ? ` (${selectedServiceIds.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ─── */
export default function AgendamentosPage() {
  const { token } = useAuthStore();
  const [date, setDate] = useState(localDateStr);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [modalAppt, setModalAppt] = useState<Appointment | null>(null);
  const [showBloqueio, setShowBloqueio] = useState(false);
  const [showAgendamento, setShowAgendamento] = useState(false);
  const [encaixePendingData, setEncaixePendingData] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; type?: "danger" | "info" } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ title: string; message: string; type?: "info" | "danger" | "success" } | null>(null);
  const [nowPx, setNowPx] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);


  /* Carrega dados */
  const load = useCallback(async () => {
    const [ar, br] = await Promise.all([
      fetch(`/api/barbershop/appointments?date=${date}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/barbershop/bloqueios?date=${date}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [ad, bd] = await Promise.all([ar.json(), br.json()]);
    setAppointments(ad.appointments || []);
    setBloqueios(bd.bloqueios || []);
  }, [date, token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/barbershop/barbers", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setBarbers(d.barbers || []));
    fetch("/api/barbershop/services", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setServices((d.services || []).filter((s: any) => s.active)));
  }, [token]);

  /* Linha do horário atual */
  useEffect(() => {
    function updateNow() {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const mins = now.getHours() * 60 + now.getMinutes() - START_HOUR * 60;
      if (mins >= 0 && mins <= TOTAL_MINS) setNowPx((mins / 5) * ROW_H);
      else setNowPx(null);
    }
    updateNow();
    const id = setInterval(updateNow, 30000);
    return () => clearInterval(id);
  }, []);

  /* Scroll até horário atual ao abrir */
  useEffect(() => {
    if (nowPx !== null && gridRef.current) {
      gridRef.current.scrollTop = Math.max(0, nowPx - 150);
    }
  }, [nowPx, date]);

  /* Navegação de data */
  function navigate(days: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + days);
    setDate(localDateStr(d));
  }

  /* Ações */
  async function updateStatus(id: string, status: string, paymentMethod?: string, price?: number) {
    await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ 
        id, 
        status, 
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(price !== undefined ? { price } : {})
      }),
    });
    load();
  }

  async function handleBloqueio(data: { barberId: string; startTime: string; endTime: string; reason: string }) {
    await fetch("/api/barbershop/bloqueios", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...data, date }),
    });
    load();
  }

  async function handleNovoAgendamento(data: any) {
    try {
      const res = await fetch("/api/barbershop/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, force: false }),
      });
      
      if (res.status === 409) {
         setEncaixePendingData(data);
         return false; // Mantém o modal original aberto por baixo
      } else if (res.status === 403) {
        const err = await res.json();
        if (err.error === "WEEKLY_LIMIT") {
          setAlertDialog({ title: "Limite Semanal", message: err.message, type: "danger" });
          return false;
        } else if (err.error === "SUBSCRIPTION_OVERDUE") {
          setAlertDialog({ title: "Assinatura Vencida", message: err.message, type: "danger" });
          return false;
        }
      } else if (!res.ok) {
        const err = await res.json();
        setAlertDialog({ title: "Erro ao salvar", message: err.error || "Tente novamente mais tarde.", type: "danger" });
        return false;
      }
      
      load();
      return true;
    } catch (e: any) {
      alert("Erro de conexão: " + e.message);
      return false;
    }
  }

  async function deleteBloqueio(id: string) {
    await fetch(`/api/barbershop/bloqueios/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  }

  async function deleteAppointment(id: string) {
    setConfirmDialog({
      title: "Excluir Agendamento",
      message: "Deseja realmente EXCLUIR este agendamento? Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        await fetch(`/api/barbershop/appointments?id=${id}`, { 
          method: "DELETE", 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setModalAppt(null);
        load();
      }
    });
  }

  /* Label da data */
  const dateObj = new Date(date + "T12:00:00");
  const todayStr = localDateStr();
  const isToday = date === todayStr;
  const dayLabel = `${DIAS_PT[dateObj.getDay()]} ${dateObj.getDate()} ${MESES_PT[dateObj.getMonth()]}`;

  /* Horários para a coluna lateral (a cada 60 min) */
  const timeLabels: string[] = [];
  for (let m = 0; m <= TOTAL_MINS; m += 60) {
    const h = START_HOUR + Math.floor(m / 60);
    timeLabels.push(`${String(h).padStart(2, "0")}:00`);
  }

  /* Linhas da grade (a cada 30 min) */
  const gridLines: number[] = [];
  for (let m = 0; m <= TOTAL_MINS; m += 30) gridLines.push((m / 5) * ROW_H);

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      {/* Modais */}
      {modalAppt && (
        <PaymentModal appt={modalAppt} services={services}
          onConfirm={async (id, m, p) => { await updateStatus(id, "DONE", m, p); }}
          onUpdateServices={async (id, sids) => {
            const res = await fetch("/api/barbershop/appointments", {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ id, serviceIds: sids }),
            });
            const data = await res.json();
            if (data.appointment) setModalAppt(data.appointment);
            load();
          }}
          onDelete={deleteAppointment}
          onClose={() => setModalAppt(null)} />
      )}
      {showBloqueio && (
        <BloqueioModal barbers={barbers} date={date}
          onConfirm={handleBloqueio}
          onClose={() => setShowBloqueio(false)} />
      )}
      {showAgendamento && (
        <AgendamentoModal barbers={barbers} date={date}
          onConfirm={handleNovoAgendamento}
          onClose={() => setShowAgendamento(false)} />
      )}
      {encaixePendingData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Choque de Horário</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Este barbeiro já possui um agendamento neste mesmo horário. Deseja forçar a criação como um <strong>ENCAIXE</strong>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setEncaixePendingData(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors">Cancelar</button>
              <button onClick={async () => {
                const data = encaixePendingData;
                setEncaixePendingData(null);
                setShowAgendamento(false);
                const resEncaixe = await fetch("/api/barbershop/appointments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ ...data, force: true }),
                });
                if (!resEncaixe.ok) {
                  const err = await resEncaixe.json();
                  alert("Erro ao salvar encaixe: " + (err.error || "Desconhecido"));
                }
                load();
              }} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors">Confirmar Encaixe</button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">{confirmDialog.title}</h2>
            <p className="text-sm text-zinc-500 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors">Cancelar</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        {/* Navegação de data */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-zinc-100 border border-zinc-200" title="Dia anterior">
            <ChevronLeft className="w-4 h-4 text-zinc-600" />
          </button>
          <button onClick={() => setDate(todayStr)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${isToday ? "bg-amber-500 text-white border-amber-500" : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50"}`}>
            Hoje
          </button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-zinc-100 border border-zinc-200" title="Próximo dia">
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>
          <div className="relative flex items-center group cursor-pointer ml-2 bg-zinc-50 hover:bg-amber-50 px-3 py-1.5 rounded-lg border border-zinc-200 hover:border-amber-200 transition-all">
            <input type="date" value={date} onChange={(e) => { if(e.target.value) setDate(e.target.value); }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" title="Selecionar data" />
            <span className="text-base font-bold text-zinc-900 group-hover:text-amber-600 transition-colors select-none whitespace-nowrap">{dayLabel}</span>
            <Calendar className="w-4 h-4 text-zinc-400 ml-2 group-hover:text-amber-500 transition-colors pointer-events-none" />
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          {/* Toggle view */}
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden">
            <button onClick={() => setView("list")}
              className={`p-2 transition-colors ${view === "list" ? "bg-zinc-100 text-zinc-900" : "bg-white text-zinc-400 hover:bg-zinc-50"}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setView("calendar")}
              className={`p-2 transition-colors ${view === "calendar" ? "bg-zinc-100 text-zinc-900" : "bg-white text-zinc-400 hover:bg-zinc-50"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowBloqueio(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100">
            <Lock className="w-3.5 h-3.5" /> Bloquear
          </button>
          <button onClick={() => setShowAgendamento(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> Novo agendamento
          </button>
        </div>
      </div>

      {/* ── VISTA CALENDÁRIO ── */}
      {view === "calendar" && (
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col flex-1" style={{ minHeight: 0 }}>
          {/* Header com barbeiros (sticky) */}
          <div className="flex border-b border-zinc-100 bg-white z-20 sticky top-0">
            <div style={{ width: GUTTER_W, minWidth: GUTTER_W }} className="shrink-0 border-r border-zinc-100" />
            <div className="flex overflow-x-auto flex-1">
              {barbers.map((b, i) => {
                const colors = ["bg-amber-100 text-amber-700", "bg-blue-100 text-blue-700", "bg-green-100 text-green-700", "bg-purple-100 text-purple-700", "bg-rose-100 text-rose-700"];
                const color = colors[i % colors.length];
                return (
                  <div key={b.id} className="border-r border-zinc-100 px-3 py-3 flex items-center gap-2.5"
                    style={{ minWidth: COL_MIN_W, flex: 1 }}>
                    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center shrink-0 font-bold text-sm`}>
                      {getInitials(b.user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-zinc-900 truncate">{b.user.name}</p>
                      {b.user.phone && <p className="text-xs text-zinc-400 truncate">{b.user.phone}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grade de horários (scrollável) */}
          <div ref={gridRef} className="flex overflow-auto flex-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
            {/* Coluna de horas */}
            <div style={{ width: GUTTER_W, minWidth: GUTTER_W, height: (TOTAL_MINS / 5) * ROW_H }} className="shrink-0 relative border-r border-zinc-100 bg-white">
              {timeLabels.map((t) => (
                <div key={t} style={{ top: minToTop(t) - 8 }}
                  className="absolute right-2 text-xs text-zinc-400 font-medium select-none">
                  {t}
                </div>
              ))}
            </div>

            {/* Colunas dos barbeiros */}
            <div className="flex flex-1">
              {barbers.map((b) => {
                const barberAppts = appointments.filter(a => a.barber.id === b.id);
                const barberBlocks = bloqueios.filter(bl => bl.barber.id === b.id);

                return (
                  <div key={b.id} className="relative border-r border-zinc-100"
                    style={{ minWidth: COL_MIN_W, flex: 1, height: (TOTAL_MINS / 5) * ROW_H }}>

                    {/* Linhas de grade */}
                    {gridLines.map((top, i) => (
                      <div key={i} className={`absolute left-0 right-0 border-t ${i % 2 === 0 ? "border-zinc-100" : "border-zinc-50"}`}
                        style={{ top }} />
                    ))}

                    {/* Bloqueios */}
                    {barberBlocks.map((bl) => {
                      const top = minToTop(bl.startTime);
                      const height = durationHeight(bl.startTime, bl.endTime);
                      if (height <= 0) return null;
                      return (
                        <div key={bl.id} className="absolute left-1 right-1 bg-red-100 border border-red-200 rounded-md overflow-hidden flex items-start gap-1 px-1.5 py-1 group"
                          style={{ top, height }}>
                          <Lock className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-red-600 font-medium truncate flex-1">{bl.reason || "Bloqueado"}</span>
                          <button onClick={() => { 
                            setConfirmDialog({ title: "Remover Bloqueio", message: "Deseja remover este bloqueio de horário?", onConfirm: () => deleteBloqueio(bl.id) }); 
                          }}
                            className="hidden group-hover:block p-0.5 rounded hover:bg-red-200">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Agendamentos */}
                    {barberAppts.map((a) => {
                      const top = minToTop(a.startTime);
                      const height = Math.max(durationHeight(a.startTime, a.endTime), ROW_H * 2);
                      const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.CONFIRMED;

                      // Lógica de Encaixe: Divide a largura se houver colisão de horário inicial
                      const overlapping = barberAppts.filter(x => x.startTime === a.startTime);
                      const totalOverlapping = overlapping.length;
                      const overlapIndex = overlapping.findIndex(x => x.id === a.id);
                      
                      const widthPct = 100 / totalOverlapping;
                      const leftPct = overlapIndex * widthPct;

                      return (
                        <div key={a.id}
                          className={`absolute ${s.bg} border-l-4 ${s.border} rounded-r-lg overflow-hidden px-1.5 py-1 cursor-pointer hover:brightness-95 transition-all shadow-sm`}
                          style={{ 
                            top, 
                            height,
                            left: `calc(${leftPct}% + 4px)`,
                            width: `calc(${widthPct}% - 8px)`
                          }}
                          onClick={() => setModalAppt(a)}>
                          <p className={`text-xs font-bold truncate ${s.text}`}>{a.client.name}</p>
                          <div className="flex items-center justify-between gap-1">
                            <p className={`text-[10px] truncate opacity-80 flex-1 ${s.text}`}>
                              {a.services.length > 0 ? a.services.map(x => x.service.name).join(" + ") : a.service?.name}
                            </p>
                            {(() => {
                              // Cálculo de desconto na grade
                              let dnt = 0;
                              const total = a.price;
                              if (a.beneficiaryName || a.subscription) {
                                const covered = a.services.find(xs => 
                                  xs.service.name.toLowerCase().includes("corte") && 
                                  !xs.service.name.toLowerCase().includes("+")
                                );
                                if (covered) dnt = covered.service.price;
                              }
                              return <p className={`text-xs font-black shrink-0 ${s.text}`}>{formatCurrency(Math.max(0, total - dnt))}</p>;
                            })()}
                          </div>
                          {a.beneficiaryName && (
                            <div className={`mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider ${s.text} opacity-70`}>
                              <CreditCard className="w-2.5 h-2.5" /> {a.beneficiaryName}
                            </div>
                          )}
                          {height > ROW_H * 5 && (
                            <p className={`text-[10px] opacity-60 mt-0.5 ${s.text}`}>{a.startTime} – {a.endTime}</p>
                          )}
                          {(a.status === "CONFIRMED" || a.status === "PENDING") && height > ROW_H * 6 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setModalAppt(a); }}
                              className="mt-1 text-xs bg-green-500 text-white px-2 py-0.5 rounded font-medium hover:bg-green-600">
                              Concluir
                            </button>
                          )}
                          {a.status === "NO_SHOW" && height > ROW_H * 6 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateStatus(a.id, "CONFIRMED"); }}
                              className="mt-1 text-xs bg-amber-500 text-white px-2 py-0.5 rounded font-medium hover:bg-amber-600">
                              Reabrir
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Linha do horário atual */}
                    {isToday && nowPx !== null && (
                      <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: nowPx }}>
                        <div className="h-px bg-red-500 relative">
                          <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {barbers.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-zinc-400 py-20">
                  <p className="text-sm">Nenhum barbeiro cadastrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Legenda */}
          <div className="border-t border-zinc-100 px-4 py-2 flex items-center gap-4 flex-wrap bg-white">
            {Object.entries(STATUS_STYLE).map(([, s]) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                <span className="text-xs text-zinc-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VISTA LISTA ── */}
      {view === "list" && (
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
          {appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Calendar className="w-12 h-12 mb-3" />
              <p className="font-medium">Nenhum agendamento nesta data</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {appointments.map((a) => {
                const s = STATUS_STYLE[a.status] ?? STATUS_STYLE.CONFIRMED;
                return (
                  <div key={a.id} className="px-5 py-4 flex items-start gap-4">
                    <div className={`w-1 self-stretch rounded-full ${s.dot}`} />
                    <div className="w-14 shrink-0 text-center">
                      <p className="text-sm font-bold text-zinc-900">{a.startTime}</p>
                      <p className="text-xs text-zinc-400">{a.endTime}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-zinc-900">{a.client.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
                        {a.subscription && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />{a.subscription.plan.name}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500 mt-0.5">{a.services.length > 0 ? a.services.map(x => x.service.name).join(" + ") : a.service?.name} · {a.barber.user.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-zinc-900">{formatCurrency(a.price)}</p>
                      {a.paymentMethod && <p className="text-xs text-zinc-400">{METHOD_LABELS[a.paymentMethod]}</p>}
                      {(a.status === "CONFIRMED" || a.status === "PENDING") && (
                        <button onClick={() => setModalAppt(a)}
                          className="mt-1.5 text-xs bg-green-500 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-green-600">
                          Concluir
                        </button>
                      )}
                      {a.status === "NO_SHOW" && (
                        <button onClick={() => updateStatus(a.id, "CONFIRMED")}
                          className="mt-1.5 text-xs bg-amber-500 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-amber-600">
                          Reabrir
                        </button>
                      )}
                      {a.status === "DONE" && (
                        <p className="text-xs text-green-600 font-medium mt-1">✓ Concluído</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        title={confirmDialog?.title || ""}
        message={confirmDialog?.message || ""}
        type={confirmDialog?.type || "danger"}
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />

      <AlertDialog
        isOpen={!!alertDialog}
        title={alertDialog?.title || ""}
        message={alertDialog?.message || ""}
        type={alertDialog?.type}
        onClose={() => setAlertDialog(null)}
      />
    </div>
  );
}
