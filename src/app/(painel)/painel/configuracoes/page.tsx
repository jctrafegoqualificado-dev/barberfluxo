"use client";
import { useEffect, useState } from "react";
import { Clock, Copy, Check, Save, Settings, CreditCard, Bell, XCircle, Calendar, Plus, Trash2, KeyRound, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, UserX, Tag, ExternalLink, Unlink, Wifi } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import Button from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface HourRow {
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface SpecialDayRow {
  id: string;
  date: string;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  reason: string | null;
}

function defaultHours(): HourRow[] {
  return DAYS.map((_, i) => ({
    dayOfWeek: i,
    isOpen: i >= 1 && i <= 6,
    openTime: "09:00",
    closeTime: "20:00",
  }));
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

function calcDuration(open: string, close: string): string {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const diff = ch * 60 + cm - (oh * 60 + om);
  if (diff <= 0) return "";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h}h${m > 0 ? m + "min" : ""}`;
}

export default function ConfiguracoesPage() {
  const { token, user } = useAuthStore();
  const [hours, setHours] = useState<HourRow[]>(defaultHours());

  // ── modal de senha ──
  const [pwdModal, setPwdModal] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdStatus, setPwdStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function handlePasswordChange() {
    if (newPwd !== confirmPwd) {
      setPwdStatus({ type: "error", msg: "As senhas não coincidem." });
      return;
    }
    if (newPwd.length < 6) {
      setPwdStatus({ type: "error", msg: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }
    setPwdSaving(true);
    setPwdStatus(null);
    try {
      const res = await fetch("/api/barbershop/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro");
      setPwdStatus({ type: "success", msg: "Senha alterada com sucesso!" });
      setTimeout(() => {
        setPwdModal(false);
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
        setPwdStatus(null);
      }, 1500);
    } catch (e) {
      setPwdStatus({ type: "error", msg: e instanceof Error ? e.message : "Erro ao alterar senha" });
    } finally {
      setPwdSaving(false);
    }
  }
  const [loadingHours, setLoadingHours] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [debitFee, setDebitFee] = useState("");
  const [creditFee, setCreditFee] = useState("");
  const [reminderMinutes, setReminderMinutes] = useState("60");
  const [savingFees, setSavingFees] = useState(false);
  const [feesSaved, setFeesSaved] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [cancelByClientEnabled, setCancelByClientEnabled] = useState(true);
  const [minCancelHours, setMinCancelHours] = useState("0");
  const [savingCancel, setSavingCancel] = useState(false);
  const [cancelSaved, setCancelSaved] = useState(false);
  const [autoNoShowEnabled, setAutoNoShowEnabled] = useState(true);
  const [autoNoShowHours, setAutoNoShowHours] = useState("24");
  const [savingNoShow, setSavingNoShow] = useState(false);
  const [noShowSaved, setNoShowSaved] = useState(false);
  const [discountServicesEnabled, setDiscountServicesEnabled] = useState(false);
  const [discountServicesMax, setDiscountServicesMax] = useState("20");
  const [discountProductsEnabled, setDiscountProductsEnabled] = useState(false);
  const [discountProductsMax, setDiscountProductsMax] = useState("20");
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [discountSaved, setDiscountSaved] = useState(false);
  const [specialDays, setSpecialDays] = useState<SpecialDayRow[]>([]);
  const [newDay, setNewDay] = useState({ date: "", isClosed: true, openTime: "09:00", closeTime: "18:00", reason: "" });
  const [addingDay, setAddingDay] = useState(false);
  const [deletingDayId, setDeletingDayId] = useState<string | null>(null);
  const slug = user?.barbershopSlug ?? "";

  // ── Mercado Pago ──
  const [mpConfig, setMpConfig] = useState<{ connected: boolean; config?: { mpUserId: string; active: boolean; updatedAt: string } } | null>(null);
  const [mpToken, setMpToken] = useState("");
  const [showMpToken, setShowMpToken] = useState(false);
  const [savingMp, setSavingMp] = useState(false);
  const [mpStatus, setMpStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [disconnectingMp, setDisconnectingMp] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    fetch("/api/barbershop/financeiro", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.debitFee !== undefined) setDebitFee(String(d.debitFee));
        if (d.creditFee !== undefined) setCreditFee(String(d.creditFee));
        if (d.reminderMinutes !== undefined) setReminderMinutes(String(d.reminderMinutes));
        if (d.cancelByClientEnabled !== undefined) setCancelByClientEnabled(Boolean(d.cancelByClientEnabled));
        if (d.minCancelHours !== undefined) setMinCancelHours(String(d.minCancelHours));
        if (d.autoNoShowEnabled !== undefined) setAutoNoShowEnabled(Boolean(d.autoNoShowEnabled));
        if (d.autoNoShowHours !== undefined) setAutoNoShowHours(String(d.autoNoShowHours));
        if (d.discountServicesEnabled !== undefined) setDiscountServicesEnabled(Boolean(d.discountServicesEnabled));
        if (d.discountServicesMax !== undefined) setDiscountServicesMax(String(d.discountServicesMax));
        if (d.discountProductsEnabled !== undefined) setDiscountProductsEnabled(Boolean(d.discountProductsEnabled));
        if (d.discountProductsMax !== undefined) setDiscountProductsMax(String(d.discountProductsMax));
      });

    fetch("/api/barbershop/horarios", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.hours?.length > 0) {
          const filled = defaultHours().map((def) => {
            const found = d.hours.find((h: HourRow) => h.dayOfWeek === def.dayOfWeek);
            return found ?? def;
          });
          setHours(filled);
        }
        setLoadingHours(false);
      });

    fetch("/api/barbershop/special-days", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (d.days) setSpecialDays(d.days); });

    fetch("/api/barbershop/payment-config", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setMpConfig(d))
      .catch(() => setMpConfig({ connected: false }));
  }, [token]);

  async function addSpecialDay() {
    if (!newDay.date) return;
    setAddingDay(true);
    const res = await fetch("/api/barbershop/special-days", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(newDay),
    });
    const data = await res.json();
    if (res.ok) {
      setSpecialDays((prev) => {
        const filtered = prev.filter((d) => d.date !== data.day.date);
        return [...filtered, data.day].sort((a, b) => a.date.localeCompare(b.date));
      });
      setNewDay({ date: "", isClosed: true, openTime: "09:00", closeTime: "18:00", reason: "" });
    }
    setAddingDay(false);
  }

  async function deleteSpecialDay(id: string) {
    setDeletingDayId(id);
    await fetch(`/api/barbershop/special-days/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSpecialDays((prev) => prev.filter((d) => d.id !== id));
    setDeletingDayId(null);
  }

  function updateHour(dayOfWeek: number, field: keyof HourRow, value: string | boolean) {
    setHours((prev) => prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h)));
  }

  async function saveHours() {
    setSavingHours(true);
    await fetch("/api/barbershop/horarios", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ hours }),
    });
    setSavingHours(false);
    setHoursSaved(true);
    setTimeout(() => setHoursSaved(false), 2500);
  }

  async function saveFees() {
    setSavingFees(true);
    await fetch("/api/barbershop/financeiro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ debitFee: Number(debitFee), creditFee: Number(creditFee) }),
    });
    setSavingFees(false);
    setFeesSaved(true);
    setTimeout(() => setFeesSaved(false), 2500);
  }

  async function saveCancel() {
    setSavingCancel(true);
    await fetch("/api/barbershop/financeiro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cancelByClientEnabled, minCancelHours: Number(minCancelHours) }),
    });
    setSavingCancel(false);
    setCancelSaved(true);
    setTimeout(() => setCancelSaved(false), 2500);
  }

  async function saveReminder() {
    setSavingReminder(true);
    await fetch("/api/barbershop/financeiro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reminderMinutes: Number(reminderMinutes) }),
    });
    setSavingReminder(false);
    setReminderSaved(true);
    setTimeout(() => setReminderSaved(false), 2500);
  }

  async function saveNoShow() {
    setSavingNoShow(true);
    await fetch("/api/barbershop/financeiro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ autoNoShowEnabled, autoNoShowHours: Number(autoNoShowHours) }),
    });
    setSavingNoShow(false);
    setNoShowSaved(true);
    setTimeout(() => setNoShowSaved(false), 2500);
  }

  async function saveDiscount() {
    setSavingDiscount(true);
    await fetch("/api/barbershop/financeiro", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        discountServicesEnabled,
        discountServicesMax: Number(discountServicesMax),
        discountProductsEnabled,
        discountProductsMax: Number(discountProductsMax),
      }),
    });
    setSavingDiscount(false);
    setDiscountSaved(true);
    setTimeout(() => setDiscountSaved(false), 2500);
  }

  async function connectMp() {
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
      setMpStatus({ type: "success", msg: d.message });
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
      else setMpStatus({ type: "success", msg: "Mercado Pago desconectado." });
    } catch {
      setMpStatus({ type: "error", msg: "Erro ao desconectar. Tente novamente." });
    } finally {
      setDisconnectingMp(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/agendar/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Configurações</h1>
        <p className="text-zinc-500 text-sm mt-1">Gerencie horários e informações do estabelecimento</p>
      </div>

      {/* Link de agendamento */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Link de Agendamento
        </h2>
        <p className="text-sm text-zinc-500 mb-3">Compartilhe com seus clientes para agendamento online:</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={typeof window !== "undefined" ? `${window.location.origin}/agendar/${slug}` : ""}
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 font-mono"
          />
          <Button variant="secondary" onClick={copyLink} size="sm">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </Card>

      {/* Horários de funcionamento */}
      <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-zinc-900">Horários de Funcionamento</h2>
          </div>
          <button
            onClick={saveHours}
            disabled={savingHours}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {hoursSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {hoursSaved ? "Salvo!" : savingHours ? "Salvando..." : "Salvar"}
          </button>
        </div>

        {loadingHours ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-7 h-7 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {hours.map((row) => (
              <div
                key={row.dayOfWeek}
                className={`px-5 py-3.5 flex items-center gap-4 transition-opacity ${!row.isOpen ? "opacity-50" : ""}`}
              >
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => updateHour(row.dayOfWeek, "isOpen", !row.isOpen)}
                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${row.isOpen ? "bg-primary" : "bg-zinc-200"}`}
                >
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${row.isOpen ? "translate-x-5" : "translate-x-0"}`} />
                </button>

                {/* Dia */}
                <p className="w-20 shrink-0 text-sm font-semibold text-zinc-800">
                  <span className="hidden sm:inline">{DAYS[row.dayOfWeek]}</span>
                  <span className="sm:hidden">{DAYS_SHORT[row.dayOfWeek]}</span>
                </p>

                {row.isOpen ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={row.openTime}
                      onChange={(e) => updateHour(row.dayOfWeek, "openTime", e.target.value)}
                      className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-zinc-400 text-sm">até</span>
                    <select
                      value={row.closeTime}
                      onChange={(e) => updateHour(row.dayOfWeek, "closeTime", e.target.value)}
                      className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                    >
                      {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-xs text-zinc-400">{calcDuration(row.openTime, row.closeTime)}</span>
                  </div>
                ) : (
                  <span className="text-sm text-zinc-400 italic">Fechado</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Taxas de cartão */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> Taxas da Máquina de Cartão
        </h2>
        <p className="text-xs text-zinc-400 mb-4">Usadas para calcular receita líquida no financeiro</p>
        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-zinc-500 mb-1">Taxa Débito (%)</label>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="10" step="0.1"
                value={debitFee}
                onChange={(e) => setDebitFee(e.target.value)}
                placeholder="ex: 1.5"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-zinc-400 text-sm">%</span>
            </div>
          </div>
          <div className="flex-1 min-w-[120px]">
            <label className="block text-xs text-zinc-500 mb-1">Taxa Crédito (%)</label>
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" max="10" step="0.1"
                value={creditFee}
                onChange={(e) => setCreditFee(e.target.value)}
                placeholder="ex: 2.99"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-zinc-400 text-sm">%</span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" size="sm" onClick={saveFees} disabled={savingFees}>
            {feesSaved ? <><Check className="w-3.5 h-3.5 mr-1 inline" />Salvo!</> : savingFees ? "Salvando..." : <><Save className="w-3.5 h-3.5 mr-1 inline" />Salvar taxas</>}
          </Button>
        </div>
      </Card>

      {/* ── Mercado Pago ── */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
          <Wifi className="w-4 h-4 text-primary" /> Pagamentos Online — Mercado Pago
        </h2>
        <p className="text-xs text-zinc-400 mb-4">
          Conecte sua conta para cobrar clientes por Pix, cartão de crédito e débito automático em assinaturas.
          O dinheiro vai direto para a sua conta — a plataforma não cobra nenhuma %.
        </p>

        {/* Feedback */}
        {mpStatus && (
          <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm mb-4 ${
            mpStatus.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}>
            {mpStatus.type === "success"
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            <span>{mpStatus.msg}</span>
          </div>
        )}

        {mpConfig === null ? (
          /* carregando */
          <div className="flex items-center gap-2 text-sm text-zinc-400 py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando conexão...
          </div>
        ) : mpConfig.connected ? (
          /* ── CONECTADO ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-800">Conectado ao Mercado Pago</p>
                <p className="text-xs text-emerald-600">
                  ID da conta: <span className="font-mono">{mpConfig.config?.mpUserId}</span>
                </p>
              </div>
            </div>

            {!confirmDisconnect ? (
              <button
                onClick={() => { setConfirmDisconnect(true); setMpStatus(null); }}
                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-red-500 transition-colors"
              >
                <Unlink className="w-3.5 h-3.5" /> Desconectar Mercado Pago
              </button>
            ) : (
              <div className="border border-red-100 bg-red-50 rounded-xl p-4 space-y-3">
                <p className="text-sm text-red-700 font-medium">Tem certeza que quer desconectar?</p>
                <p className="text-xs text-red-500">
                  Assinaturas com débito automático ativo deixarão de ser processadas automaticamente.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDisconnect(false)}
                    className="flex-1 py-2 rounded-lg border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={disconnectMp}
                    disabled={disconnectingMp}
                    className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
                  >
                    {disconnectingMp ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Sim, desconectar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── NÃO CONECTADO ── */
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-zinc-500 mb-1 font-medium">
                Access Token de Produção
              </label>
              <div className="relative">
                <input
                  type={showMpToken ? "text" : "password"}
                  value={mpToken}
                  onChange={(e) => { setMpToken(e.target.value); setMpStatus(null); }}
                  placeholder="APP_USR-..."
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowMpToken((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showMpToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <a
                href="https://www.mercadopago.com.br/developers/panel/app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
              >
                <ExternalLink className="w-3 h-3" />
                Onde acho meu Access Token? (Portal MP)
              </a>
            </div>

            <Button
              variant="primary"
              size="sm"
              onClick={connectMp}
              disabled={savingMp || !mpToken.trim()}
            >
              {savingMp ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 inline animate-spin" />Validando...</>
              ) : (
                <><Check className="w-3.5 h-3.5 mr-1.5 inline" />Conectar Mercado Pago</>
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Lembrete WhatsApp */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" /> Lembrete de Agendamento (WhatsApp)
        </h2>
        <p className="text-xs text-zinc-400 mb-4">O cliente recebe uma mensagem automática antes do horário marcado</p>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Enviar lembrete com quanto tempo de antecedência?</label>
          <select
            value={reminderMinutes}
            onChange={(e) => setReminderMinutes(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="30">30 minutos antes</option>
            <option value="60">1 hora antes</option>
            <option value="120">2 horas antes</option>
            <option value="180">3 horas antes</option>
            <option value="360">6 horas antes</option>
            <option value="1440">24 horas antes (dia anterior)</option>
          </select>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="primary" size="sm" onClick={saveReminder} disabled={savingReminder}>
            {reminderSaved ? <><Check className="w-3.5 h-3.5 mr-1 inline" />Salvo!</> : savingReminder ? "Salvando..." : <><Save className="w-3.5 h-3.5 mr-1 inline" />Salvar</>}
          </Button>
        </div>
      </Card>

      {/* Cancelamento pelo cliente */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-primary" /> Cancelamento pelo Cliente
        </h2>
        <p className="text-xs text-zinc-400 mb-4">Controle se os clientes podem cancelar os próprios agendamentos pelo link público</p>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-zinc-800">Permitir cancelamento online</p>
            <p className="text-xs text-zinc-400">
              {cancelByClientEnabled ? "Clientes podem cancelar pela página de agendamento" : "Apenas a barbearia pode cancelar"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCancelByClientEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${cancelByClientEnabled ? "bg-primary" : "bg-zinc-200"}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${cancelByClientEnabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {cancelByClientEnabled && (
          <div className="mb-4">
            <label className="block text-xs text-zinc-500 mb-1">Antecedência mínima para cancelar</label>
            <div className="flex items-center gap-2">
              <select
                value={minCancelHours}
                onChange={(e) => setMinCancelHours(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              >
                <option value="0">Sem restrição (qualquer hora)</option>
                <option value="1">1 hora antes</option>
                <option value="2">2 horas antes</option>
                <option value="4">4 horas antes</option>
                <option value="8">8 horas antes</option>
                <option value="12">12 horas antes</option>
                <option value="24">24 horas antes</option>
                <option value="48">48 horas antes</option>
              </select>
            </div>
            {Number(minCancelHours) > 0 && (
              <p className="text-xs text-zinc-400 mt-1.5">
                Clientes só poderão cancelar com pelo menos {minCancelHours}h de antecedência.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={saveCancel} disabled={savingCancel}>
            {cancelSaved ? <><Check className="w-3.5 h-3.5 mr-1 inline" />Salvo!</> : savingCancel ? "Salvando..." : <><Save className="w-3.5 h-3.5 mr-1 inline" />Salvar</>}
          </Button>
        </div>
      </Card>

      {/* Marcação Automática de Ausência */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
          <UserX className="w-4 h-4 text-primary" /> Marcação Automática de Ausência
        </h2>
        <p className="text-xs text-zinc-400 mb-4">
          Agendamentos não fechados são marcados como <span className="font-medium text-zinc-600">NO_SHOW</span> automaticamente após o tempo configurado.
          O barbeiro tem até esse prazo para fechar o atendimento manualmente.
        </p>

        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-zinc-800">Ativar marcação automática</p>
            <p className="text-xs text-zinc-400">
              {autoNoShowEnabled
                ? `Agendamentos não fechados viram NO_SHOW após ${autoNoShowHours}h`
                : "Desativado — barbeiros fecham manualmente"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAutoNoShowEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${autoNoShowEnabled ? "bg-primary" : "bg-zinc-200"}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${autoNoShowEnabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {autoNoShowEnabled && (
          <div className="mb-4">
            <label className="block text-xs text-zinc-500 mb-1">Janela de tempo para o barbeiro fechar</label>
            <select
              value={autoNoShowHours}
              onChange={(e) => setAutoNoShowHours(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            >
              <option value="4">4 horas</option>
              <option value="8">8 horas</option>
              <option value="12">12 horas</option>
              <option value="24">24 horas (recomendado)</option>
              <option value="48">48 horas</option>
              <option value="72">72 horas</option>
            </select>
            <p className="text-xs text-zinc-400 mt-1.5">
              Agendamentos de mais de {autoNoShowHours}h atrás ainda CONFIRMED/PENDING serão marcados como NO_SHOW no próximo ciclo.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={saveNoShow} disabled={savingNoShow}>
            {noShowSaved ? <><Check className="w-3.5 h-3.5 mr-1 inline" />Salvo!</> : savingNoShow ? "Salvando..." : <><Save className="w-3.5 h-3.5 mr-1 inline" />Salvar</>}
          </Button>
        </div>
      </Card>

      {/* Sistema de Descontos na Comanda */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" /> Descontos na Comanda
        </h2>
        <p className="text-xs text-zinc-400 mb-4">
          Permite que o barbeiro aplique desconto no momento de fechar o atendimento.
          Defina o teto máximo — o barbeiro decide o quanto usar, até esse limite.
        </p>

        {/* Desconto em Serviços */}
        <div className="border border-zinc-100 rounded-xl p-4 mb-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-800">Desconto em Serviços</p>
              <p className="text-xs text-zinc-400">
                {discountServicesEnabled
                  ? `Barbeiro pode dar até ${discountServicesMax}% de desconto em serviços`
                  : "Desativado — sem desconto em serviços"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDiscountServicesEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${discountServicesEnabled ? "bg-primary" : "bg-zinc-200"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${discountServicesEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {discountServicesEnabled && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Desconto máximo permitido (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="100" step="1"
                  value={discountServicesMax}
                  onChange={(e) => setDiscountServicesMax(e.target.value)}
                  className="w-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-center font-semibold"
                />
                <span className="text-zinc-400 text-sm">%</span>
                <p className="text-xs text-zinc-400 ml-1">
                  O barbeiro pode aplicar entre 0% e {discountServicesMax}%
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Desconto em Produtos */}
        <div className="border border-zinc-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-800">Desconto em Produtos</p>
              <p className="text-xs text-zinc-400">
                {discountProductsEnabled
                  ? `Barbeiro pode dar até ${discountProductsMax}% de desconto em produtos`
                  : "Desativado — sem desconto em produtos"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDiscountProductsEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${discountProductsEnabled ? "bg-primary" : "bg-zinc-200"}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${discountProductsEnabled ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {discountProductsEnabled && (
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Desconto máximo permitido em produtos (%)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" min="1" max="100" step="1"
                  value={discountProductsMax}
                  onChange={(e) => setDiscountProductsMax(e.target.value)}
                  className="w-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-center font-semibold"
                />
                <span className="text-zinc-400 text-sm">%</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="sm" onClick={saveDiscount} disabled={savingDiscount}>
            {discountSaved ? <><Check className="w-3.5 h-3.5 mr-1 inline" />Salvo!</> : savingDiscount ? "Salvando..." : <><Save className="w-3.5 h-3.5 mr-1 inline" />Salvar descontos</>}
          </Button>
        </div>
      </Card>

      {/* Feriados e Horários Especiais */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-1 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> Feriados e Dias Especiais
        </h2>
        <p className="text-xs text-zinc-400 mb-4">Marque datas em que a barbearia estará fechada ou com horário diferente</p>

        {/* Lista de dias cadastrados */}
        {specialDays.length > 0 && (
          <div className="space-y-2 mb-4">
            {specialDays.map((d) => {
              const [ano, mes, dia] = d.date.split("-");
              return (
                <div key={d.id} className="flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800">
                      {dia}/{mes}/{ano}
                      {d.reason && <span className="ml-2 text-zinc-500 font-normal">— {d.reason}</span>}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {d.isClosed ? "Fechado" : `Horário especial: ${d.openTime} – ${d.closeTime}`}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteSpecialDay(d.id)}
                    disabled={deletingDayId === d.id}
                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Formulário para adicionar */}
        <div className="space-y-3 border-t border-zinc-100 pt-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Data</label>
              <input
                type="date"
                value={newDay.date}
                onChange={(e) => setNewDay((v) => ({ ...v, date: e.target.value }))}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 mb-1">Motivo (opcional)</label>
              <input
                type="text"
                value={newDay.reason}
                onChange={(e) => setNewDay((v) => ({ ...v, reason: e.target.value }))}
                placeholder="Ex: Natal, Feriado..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-600">Tipo:</span>
            <button
              type="button"
              onClick={() => setNewDay((v) => ({ ...v, isClosed: true }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${newDay.isClosed ? "bg-red-100 text-red-700 border border-red-200" : "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}
            >
              Fechado
            </button>
            <button
              type="button"
              onClick={() => setNewDay((v) => ({ ...v, isClosed: false }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!newDay.isClosed ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-zinc-100 text-zinc-500 border border-zinc-200"}`}
            >
              Horário especial
            </button>
          </div>

          {!newDay.isClosed && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">Abre</label>
                <select
                  value={newDay.openTime}
                  onChange={(e) => setNewDay((v) => ({ ...v, openTime: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-500 mb-1">Fecha</label>
                <select
                  value={newDay.closeTime}
                  onChange={(e) => setNewDay((v) => ({ ...v, closeTime: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={addSpecialDay}
            disabled={!newDay.date || addingDay}
          >
            {addingDay ? "Salvando..." : <><Plus className="w-3.5 h-3.5 mr-1 inline" />Adicionar data</>}
          </Button>
        </div>
      </Card>

      {/* Minha Conta */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 mb-1">Minha Conta</h2>
            <p className="text-sm text-zinc-500">
              Logado como:{" "}
              <span className="font-medium text-zinc-900">{user?.email}</span>
            </p>
          </div>
          <button
            onClick={() => setPwdModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            Alterar Senha
          </button>
        </div>
      </Card>

      <p className="text-xs text-zinc-400">
        Os horários de funcionamento definem os slots disponíveis para agendamento dos clientes e o cálculo da taxa de ocupação.
      </p>

      {/* ══════════════ MODAL ALTERAR SENHA ══════════════ */}
      {pwdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-in zoom-in-95 duration-200">
            {/* header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-zinc-900">Alterar Senha</h3>
              </div>
              <button
                onClick={() => { setPwdModal(false); setPwdStatus(null); }}
                className="p-2 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                <span className="sr-only">Fechar</span>
                <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* status */}
            {pwdStatus && (
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${
                pwdStatus.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              }`}>
                {pwdStatus.type === "success"
                  ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                  : <AlertCircle className="w-4 h-4 shrink-0" />}
                {pwdStatus.msg}
              </div>
            )}

            {/* campos */}
            <div className="space-y-4">
              {/* senha atual */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Senha atual</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 pl-10 pr-10 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* nova senha */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Nova senha</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-4 py-3 pl-10 pr-10 rounded-xl border border-zinc-200 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPwd.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          newPwd.length >= i * 3
                            ? i <= 2 ? "bg-amber-400" : "bg-emerald-500"
                            : "bg-zinc-200"
                        }`}
                      />
                    ))}
                    <span className="text-xs text-zinc-400 ml-1">
                      {newPwd.length < 6 ? "Fraca" : newPwd.length < 9 ? "Média" : "Forte"}
                    </span>
                  </div>
                )}
              </div>

              {/* confirmar */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Confirmar nova senha</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="Repita a nova senha"
                    className={`w-full px-4 py-3 pl-10 rounded-xl border text-sm focus:ring-2 outline-none ${
                      confirmPwd && confirmPwd !== newPwd
                        ? "border-red-300 focus:ring-red-200"
                        : "border-zinc-200 focus:ring-primary/20"
                    }`}
                  />
                </div>
                {confirmPwd && confirmPwd !== newPwd && (
                  <p className="text-xs text-red-500">As senhas não coincidem.</p>
                )}
              </div>
            </div>

            {/* actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setPwdModal(false); setPwdStatus(null); }}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={pwdSaving || !currentPwd || !newPwd || !confirmPwd}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pwdSaving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Salvando…</>
                ) : (
                  <><Lock className="w-4 h-4" /> Alterar Senha</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
