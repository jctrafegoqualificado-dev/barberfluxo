"use client";
import { useEffect, useState } from "react";
import { Clock, Copy, Check, Save, Settings, CreditCard, Bell } from "lucide-react";
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
  const slug = user?.barbershopSlug ?? "";

  useEffect(() => {
    fetch("/api/barbershop/financeiro", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (d.debitFee !== undefined) setDebitFee(String(d.debitFee));
        if (d.creditFee !== undefined) setCreditFee(String(d.creditFee));
        if (d.reminderMinutes !== undefined) setReminderMinutes(String(d.reminderMinutes));
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
  }, [token]);

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

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/agendar/${slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Configurações</h1>
        <p className="text-zinc-500 text-sm mt-1">Gerencie horários e informações da barbearia</p>
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

      {/* Conta */}
      <Card>
        <h2 className="text-base font-semibold text-zinc-900 mb-2">Minha Conta</h2>
        <p className="text-sm text-zinc-500">Logado como: <span className="font-medium text-zinc-900">{user?.email}</span></p>
      </Card>

      <p className="text-xs text-zinc-400">
        Os horários de funcionamento definem os slots disponíveis para agendamento dos clientes e o cálculo da taxa de ocupação.
      </p>
    </div>
  );
}
