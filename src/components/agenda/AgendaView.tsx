"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, Lock, Trash2, Plus, ChevronLeft, ChevronRight, AlertTriangle, UserCheck, Package } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/store/auth";
import { AlertDialog } from "@/components/ui/ConfirmDialog";
import { formatCurrency } from "@/lib/utils";
import WaitlistPanelButton from "@/components/booking/WaitlistPanelButton";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/ui/Badge";
import WeekStrip from "@/components/agenda/WeekStrip";
import WeekView from "@/components/agenda/WeekView";
import AgendaMobile from "@/components/agenda/AgendaMobile";
import AppointmentDetails from "@/components/agenda/AppointmentDetails";
import NovoAgendamentoModal, { type NovoAgendamentoData } from "@/components/agenda/NovoAgendamentoModal";
import ConcluirAtendimentoModal from "@/components/agenda/ConcluirAtendimentoModal";
import VenderProdutoModal from "@/components/agenda/VenderProdutoModal";
import {
  type Appointment, type Bloqueio, type Barber, type WeekDay, type DayHours,
  toHHMM, servicesLabel, cardStyle, STATUS_NOTE, isOpenStatus, nowMinutesSP,
} from "@/components/agenda/types";

/* ─── Tipos ─── */
// Ficam em components/agenda/types.ts (compartilhados com os componentes da agenda).

/* ─── Constantes da grade ─── */
const ROW_H = 7;         // px por 5 minutos (30 min = 42px, perto do design)
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_MINS = (END_HOUR - START_HOUR) * 60;
const GRID_H = (TOTAL_MINS / 5) * ROW_H;
const GUTTER_W = 52;     // largura da coluna de horários
const COL_MIN_W = 180;   // largura mínima de cada coluna de barbeiro

const METHOD_LABELS: Record<string, string> = {
  PIX: "PIX", DEBIT: "Débito", DEBIT_CARD: "Débito", CREDIT: "Crédito", CREDIT_CARD: "Crédito", CASH: "Dinheiro", SUBSCRIPTION: "Clube (Assinatura)",
};

/* ─── Helpers ─── */
function toMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function minToTop(t: string) { return ((toMin(t) - START_HOUR * 60) / 5) * ROW_H; }
function durationHeight(start: string, end: string) { return ((toMin(end) - toMin(start)) / 5) * ROW_H; }
function localDateStr(d = new Date()) {
  return new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(d);
}
function getInitials(name: string) { return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase(); }

/* ─── Modal de bloqueio ─── */
function BloqueioModal({ barbers, date, onConfirm, onClose }: {
  barbers: Barber[]; date: string;
  onConfirm: (data: { barberId: string; startTime: string; endTime: string; reason: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [barberId, setBarberId] = useState(barbers[0]?.id ?? "");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const invalid = toMin(endTime) <= toMin(startTime);
  const dayLabel = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <Modal open onClose={onClose} title="Bloquear horário" description={`Para ${dayLabel}. Ninguém consegue marcar nesse intervalo.`}>
      <div className="flex flex-col gap-3.5">
        {barbers.length > 0 && (
          <div>
            <label htmlFor="bl-barber" className="block text-[13px] font-semibold text-ink-2 mb-1.5">Profissional</label>
            <select id="bl-barber" value={barberId} onChange={(e) => setBarberId(e.target.value)}
              className="w-full h-11 rounded-[10px] border border-control bg-surface px-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.user.name}</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input type="time" label="Das" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input type="time" label="Até" value={endTime} onChange={(e) => setEndTime(e.target.value)}
            error={invalid ? "Precisa ser depois do início" : undefined} />
        </div>
        <Input label="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Almoço, médico, curso…" />
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="secondary" size="lg" className="flex-1" loading={saving} disabled={invalid}
            onClick={async () => { setSaving(true); await onConfirm({ barberId, startTime, endTime, reason }); setSaving(false); onClose(); }}>
            <Lock className="w-4 h-4" /> Bloquear
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Página principal ─── */
/**
 * Agenda do dia. "owner": todos os profissionais (painel do dono).
 * "barber": só a coluna do próprio barbeiro (Minha agenda), com venda de produto avulsa.
 */
export default function AgendaView({ mode = "owner" }: { mode?: "owner" | "barber" }) {
  const barberMode = mode === "barber";
  const [showVender, setShowVender] = useState(false);
  const { token } = useAuthStore();
  const [date, setDate] = useState(localDateStr);
  const [view, setView] = useState<"calendar" | "week" | "list">("calendar");
  // Visão Semana: recarrega junto com a agenda do dia e abre o horário clicado
  const [loadTick, setLoadTick] = useState(0);
  const [pendingSelect, setPendingSelect] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; price: number; stock: number }[]>([]);
  const [discountSettings, setDiscountSettings] = useState<{ servicesEnabled: boolean; servicesMax: number }>({ servicesEnabled: false, servicesMax: 20 });
  const [modalAppt, setModalAppt] = useState<Appointment | null>(null);
  const [showBloqueio, setShowBloqueio] = useState(false);
  const [showAgendamento, setShowAgendamento] = useState(false);

  // ?novo=1 (botão "+" da barra inferior do celular) já abre o novo agendamento.
  // Vindo da ficha do cliente também traz nome, telefone, profissional e serviços preferidos.
  // Observa a URL (não só a montagem): tocar no "+" já estando na agenda não remonta a página.
  const searchParams = useSearchParams();
  const [pendingNovo, setPendingNovo] = useState<{ name?: string; phone?: string; barberId?: string; serviceIds: string[] } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("novo") === "1") {
      setPendingNovo({
        name: params.get("cliente") ?? undefined,
        phone: params.get("tel") ?? undefined,
        barberId: params.get("barbeiro") ?? undefined,
        serviceIds: (params.get("servicos") ?? "").split(",").filter(Boolean),
      });
      for (const k of ["novo", "cliente", "tel", "barbeiro", "servicos"]) params.delete(k);
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, [searchParams]);
  const [agendamentoInit, setAgendamentoInit] = useState<{
    barberId?: string; startTime?: string; client?: { name: string; phone: string }; serviceIds?: string[];
  } | null>(null);
  const [encaixePendingData, setEncaixePendingData] = useState<any>(null);
  // Motivo do 409 vindo da API — distingue "barbeiro ocupado" de "cliente já tem horário".
  const [encaixeMotivo, setEncaixeMotivo] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; type?: "danger" | "info" } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ title: string; message: string; type?: "info" | "danger" | "success" } | null>(null);
  // Remarcação por arrasto fica pendente até o usuário confirmar. `conflito` guarda
  // a mensagem do 409, quando a API recusa e oferece seguir mesmo assim.
  const [movePending, setMovePending] = useState<{
    apptId: string; newBarberId: string; newStartTime: string; newEndTime: string;
    clientName: string; fromStartTime: string; trocaBarbeiro: string | null; conflito?: string;
  } | null>(null);
  const [nowPx, setNowPx] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  const dragOffset = useRef<number>(0);
  const didDrag = useRef(false);
  const [dragOver, setDragOver] = useState<{ barberId: string; mins: number } | null>(null);
  // Horário aberto no painel de detalhes (ao lado no computador; folha no celular)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [week, setWeek] = useState<WeekDay[]>([]);
  const [dayHours, setDayHours] = useState<DayHours | null>(null);
  const [shopSlug, setShopSlug] = useState<string | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  // Abre o novo agendamento pedido pela URL depois que os serviços carregaram
  // (os serviços preferidos do cliente só entram se ainda estiverem ativos).
  useEffect(() => {
    if (!pendingNovo || !catalogLoaded) return;
    setAgendamentoInit({
      barberId: pendingNovo.barberId,
      client: pendingNovo.name ? { name: pendingNovo.name, phone: pendingNovo.phone ?? "" } : undefined,
      serviceIds: pendingNovo.serviceIds.filter((id) => services.some((s) => s.id === id)),
    });
    setShowAgendamento(true);
    setPendingNovo(null);
  }, [pendingNovo, catalogLoaded, services]);


  /* Carrega dados */
  const load = useCallback(async () => {
    const [ar, br] = await Promise.all([
      fetch(`/api/barbershop/appointments?date=${date}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/api/barbershop/bloqueios?date=${date}`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const [ad, bd] = await Promise.all([ar.json(), br.json()]);
    setAppointments(ad.appointments || []);
    setBloqueios(bd.bloqueios || []);
    setLoadTick((t) => t + 1);
  }, [date, token]);

  useEffect(() => { load(); }, [load]);

  // ?comanda=<id> (botão "Fechar comanda" do Início do barbeiro) abre a comanda do horário de hoje
  const [pendingComanda, setPendingComanda] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("comanda");
    if (!id) return;
    setPendingComanda(id);
    params.delete("comanda");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);
  useEffect(() => {
    if (!pendingComanda || !catalogLoaded) return;
    const a = appointments.find((x) => x.id === pendingComanda);
    if (a) { setModalAppt(a); setPendingComanda(null); }
  }, [pendingComanda, appointments, catalogLoaded]);

  useEffect(() => {
    if (barberMode) {
      // Barbeiro não lista a equipe: a agenda mostra só a coluna dele
      fetch("/api/barber/booking-data", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setBarbers(d.barber ? [d.barber] : []));
    } else {
      fetch("/api/barbershop/barbers", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json()).then(d => setBarbers(d.barbers || []));
    }
    fetch("/api/barbershop/services", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setServices((d.services || []).filter((s: any) => s.active)); setCatalogLoaded(true); });
    fetch("/api/barbershop/products", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setProducts(d.products || []));
    fetch("/api/barbershop/settings", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        setDiscountSettings({ servicesEnabled: Boolean(d.discountServicesEnabled), servicesMax: Number(d.discountServicesMax ?? 20) });
        setShopSlug(d.slug ?? null);
      });
  }, [token, barberMode]);

  /* Linha do horário atual */
  useEffect(() => {
    function updateNow() {
      const brTime = new Intl.DateTimeFormat("en", {
        timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date());
      const [bH, bM] = brTime.split(":").map(Number);
      const mins = bH * 60 + bM - START_HOUR * 60;
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
    d.setDate(d.getDate() + (view === "week" ? days * 7 : days)); // na Semana, as setas pulam uma semana
    setDate(localDateStr(d));
  }

  /* Ações */
  async function updateStatus(id: string, status: string, paymentMethod?: string, price?: number, extraPrice?: number, extraPaymentMethod?: string, discountPercent?: number, tipAmount?: number) {
    // Optimistic update: muda o card imediatamente sem esperar a API
    const prev = appointments;
    setAppointments(cur =>
      cur.map(a => a.id === id
        ? { ...a, status, ...(paymentMethod ? { paymentMethod } : {}), ...(price !== undefined ? { price } : {}) }
        : a
      )
    );

    const res = await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id,
        status,
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(price !== undefined ? { price } : {}),
        ...(extraPrice !== undefined ? { extraPrice } : {}),
        ...(extraPaymentMethod ? { extraPaymentMethod } : {}),
        ...(discountPercent !== undefined && discountPercent > 0 ? { discountPercent } : {}),
        // Assinante paga a gorjeta pela forma escolhida na comanda (extraPaymentMethod)
        ...(tipAmount !== undefined ? { tipAmount, tipPaymentMethod: extraPaymentMethod ?? paymentMethod } : {}),
      }),
    });

    if (!res.ok) {
      // Reverte para o estado anterior se a API falhar
      setAppointments(prev);
      const err = await res.json().catch(() => ({}));
      alert(err?.error ?? "Erro ao atualizar agendamento. Verifique sua conexão e tente novamente.");
      load();
    }
  }

  // Check-in ("Chegou"): marca/desmarca a hora em que o cliente chegou.
  async function toggleArrived(appt: Appointment) {
    const arrived = !appt.arrivedAt;
    const optimistic = arrived ? new Date().toISOString() : null;
    setAppointments(cur => cur.map(a => a.id === appt.id ? { ...a, arrivedAt: optimistic } : a));
    setModalAppt(m => m && m.id === appt.id ? { ...m, arrivedAt: optimistic } : m);
    const res = await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: appt.id, arrived }),
    });
    if (!res.ok) load();
  }

  async function handleBloqueio(data: { barberId: string; startTime: string; endTime: string; reason: string }) {
    await fetch("/api/barbershop/bloqueios", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...data, date }),
    });
    load();
  }

  async function handleNovoAgendamento(data: NovoAgendamentoData) {
    try {
      const res = await fetch("/api/barbershop/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, force: false }),
      });
      
      if (res.status === 409) {
         const err = await res.json().catch(() => ({}));
         setEncaixePendingData(data);
         setEncaixeMotivo(err?.message ?? null);
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

  // O arrasto apenas PROPÕE a mudança. Antes esta função remarcava direto, então
  // um clique que escorregasse alguns pixels já alterava o horário de verdade e
  // disparava WhatsApp para o cliente, sem diálogo e sem desfazer.
  function moveAppointment(apptId: string, newBarberId: string, newStartMins: number) {
    const appt = appointments.find(a => a.id === apptId);
    if (!appt) return;
    const duration = toMin(appt.endTime) - toMin(appt.startTime);
    const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - duration, newStartMins));
    const newStartTime = `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
    const endMins = clamped + duration;
    const newEndTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
    if (newStartTime === appt.startTime && newBarberId === appt.barber.id) return;
    const destino = barbers.find(b => b.id === newBarberId);
    setMovePending({
      apptId, newBarberId, newStartTime, newEndTime,
      clientName: appt.client.name,
      fromStartTime: appt.startTime,
      trocaBarbeiro: newBarberId !== appt.barber.id ? (destino?.user.name ?? "outro profissional") : null,
    });
  }

  async function commitMove(force: boolean) {
    const p = movePending;
    if (!p) return;
    const res = await fetch("/api/barbershop/appointments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: p.apptId, startTime: p.newStartTime, endTime: p.newEndTime, barberId: p.newBarberId,
        ...(force ? { force: true } : {}),
      }),
    });
    if (res.status === 409 && !force) {
      const err = await res.json().catch(() => ({}));
      setMovePending({ ...p, conflito: err?.message ?? "Há um conflito neste horário." });
      return;
    }
    setMovePending(null);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setAlertDialog({ title: "Erro ao mover", message: err?.error || "Tente novamente.", type: "danger" });
    }
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

  /* Semana (contagem por dia) e horário de funcionamento do dia */
  useEffect(() => {
    if (!token) return;
    let alive = true;
    fetch(`/api/barbershop/agenda/semana?date=${date}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) { setWeek(d.days ?? []); setDayHours(d.hours ?? null); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [date, token, appointments.length]);

  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  // Veio da Semana: quando o dia carregar, abre o horário clicado
  useEffect(() => {
    if (!pendingSelect) return;
    const a = appointments.find((x) => x.id === pendingSelect);
    if (!a) return;
    setPendingSelect(null);
    setSelectedId(a.id);
    if (window.matchMedia("(max-width: 1279px)").matches) setSheetOpen(true);
  }, [pendingSelect, appointments]);

  function selectAppt(a: Appointment) {
    setSelectedId(a.id);
    // Abaixo de 1280px não há espaço para o painel ao lado: abre como folha.
    if (window.matchMedia("(max-width: 1279px)").matches) setSheetOpen(true);
  }

  // No computador largo, abre já com o próximo cliente do dia selecionado no painel.
  useEffect(() => {
    if (selectedId && appointments.some((a) => a.id === selectedId)) return;
    if (!window.matchMedia("(min-width: 1280px)").matches) return;
    const nowMin = nowMinutesSP();
    const next = [...appointments]
      .filter((a) => isOpenStatus(a.status) && (date !== localDateStr() || toMin(a.endTime) > nowMin))
      .sort((x, y) => toMin(x.startTime) - toMin(y.startTime))[0];
    setSelectedId(next?.id ?? null);
  }, [appointments, date, selectedId]);

  const detailActions = {
    onConclude: (a: Appointment) => { setSheetOpen(false); setModalAppt(a); },
    onToggleArrived: toggleArrived,
    onStatus: (a: Appointment, status: "NO_SHOW" | "CANCELLED") => setConfirmDialog({
      title: status === "NO_SHOW" ? "Marcar falta" : "Cancelar agendamento",
      message: status === "NO_SHOW"
        ? `Marcar que ${a.client.name.split(" ")[0]} não veio às ${a.startTime}?`
        : `Cancelar o horário de ${a.client.name.split(" ")[0]} às ${a.startTime}? O cliente é avisado pelo WhatsApp e a vaga abre para a lista de espera.`,
      onConfirm: () => { setSheetOpen(false); updateStatus(a.id, status); },
    }),
    onReopen: (a: Appointment) => updateStatus(a.id, "CONFIRMED"),
    onDelete: (a: Appointment) => { setSheetOpen(false); deleteAppointment(a.id); },
  };

  const stats = {
    done: appointments.filter((a) => a.status === "DONE").length,
    confirmed: appointments.filter((a) => a.status === "CONFIRMED").length,
    pending: appointments.filter((a) => a.status === "PENDING").length,
    noShow: appointments.filter((a) => a.status === "NO_SHOW").length,
  };

  /** Janela de trabalho do profissional no dia: horário dele dentro do horário da barbearia. */
  function workWindow(b: Barber): [number, number] | null {
    if (!dayHours?.isOpen || !dayHours.open || !dayHours.close) return null;
    const start = Math.max(toMin(dayHours.open), b.workStart ? toMin(b.workStart) : 0);
    const end = Math.min(toMin(dayHours.close), b.workEnd ? toMin(b.workEnd) : 24 * 60);
    return end > start ? [start, end] : null;
  }

  function barberSummary(b: Barber) {
    const appts = appointments.filter((a) => a.barber.id === b.id && a.status !== "CANCELLED");
    const n = `${appts.length} ${appts.length === 1 ? "horário" : "horários"}`;
    const win = workWindow(b);
    if (!win) return n;
    const booked = appts.reduce((s, a) => s + (toMin(a.endTime) - toMin(a.startTime)), 0);
    return `${n} · ${Math.min(100, Math.round((booked / (win[1] - win[0])) * 100))}% ocupado`;
  }

  /** Faixas acinzentadas fora da janela de trabalho (só sinaliza; encaixe continua possível). */
  function offHours(b: Barber) {
    const win = workWindow(b);
    if (!win) return dayHours && !dayHours.isOpen ? [{ key: "dia", top: 0, height: GRID_H }] : [];
    const top = minToTop(toHHMM(Math.max(win[1], START_HOUR * 60)));
    return [
      { key: "antes", top: 0, height: minToTop(toHHMM(Math.max(win[0], START_HOUR * 60))) },
      { key: "depois", top, height: GRID_H - top },
    ].filter((z) => z.height > 0);
  }

  /** Segunda linha do card: o que o dono mais quer saber sobre o horário. */
  function cardNote(a: Appointment) {
    if (a.arrivedAt && isOpenStatus(a.status)) return "chegou";
    if (a.confirmedVia === "WHATSAPP" && isOpenStatus(a.status)) return "confirmou no WhatsApp";
    return STATUS_NOTE[a.status] ?? a.status;
  }

  const nowLabel = (() => { const m = nowMinutesSP(); return toHHMM(m); })();

  /* Label da data */
  const dateObj = new Date(date + "T12:00:00");
  const todayStr = localDateStr();
  const isToday = date === todayStr;
  // "Sexta, 16 de outubro" — só a primeira letra maiúscula
  const longDayLabel = view === "week" ? (() => {
    const mon = new Date(dateObj); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    const f = (d: Date, m: boolean) => d.toLocaleDateString("pt-BR", m ? { day: "numeric", month: "short" } : { day: "numeric" }).replace(".", "");
    return `Semana de ${f(mon, mon.getMonth() !== sun.getMonth())} a ${f(sun, true)}`;
  })() : (() => {
    const s = dateObj.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).replace("-feira", "");
    return s.charAt(0).toUpperCase() + s.slice(1);
  })();

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
      {showVender && <VenderProdutoModal onClose={() => setShowVender(false)} />}
      {modalAppt && (
        <ConcluirAtendimentoModal appt={modalAppt} services={services} products={products} discountSettings={discountSettings}
          onConfirm={async (id, m, p, extraPrice, extraPaymentMethod, discountPercent, tipAmount) => { await updateStatus(id, "DONE", m, p, extraPrice, extraPaymentMethod, discountPercent, tipAmount); }}
          onNoShow={(id) => { setModalAppt(null); updateStatus(id, "NO_SHOW"); }}
          onUpdateServices={async (id, sids) => {
            const res = await fetch("/api/barbershop/appointments", {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ id, serviceIds: sids }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              alert(err?.error ?? "Erro ao salvar serviços. Tente novamente.");
              return;
            }
            const data = await res.json();
            if (data.appointment) setModalAppt(data.appointment);
            load();
          }}
          onDelete={deleteAppointment}
          onReopen={async (id) => { await updateStatus(id, "CONFIRMED"); setModalAppt(null); }}
          onClose={() => setModalAppt(null)} />
      )}
      {showBloqueio && (
        <BloqueioModal barbers={barbers} date={date}
          onConfirm={handleBloqueio}
          onClose={() => setShowBloqueio(false)} />
      )}
      {showAgendamento && (
        <NovoAgendamentoModal barbers={barbers} date={date} services={services} slug={shopSlug}
          onConfirm={handleNovoAgendamento}
          initialBarberId={agendamentoInit?.barberId}
          initialStartTime={agendamentoInit?.startTime}
          initialClient={agendamentoInit?.client}
          initialServiceIds={agendamentoInit?.serviceIds}
          onClose={() => { setShowAgendamento(false); setAgendamentoInit(null); }} />
      )}
      {movePending && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className={`w-12 h-12 rounded-full ${movePending.conflito ? "bg-amber-100" : "bg-primary/20"} flex items-center justify-center mx-auto mb-4`}>
              <AlertTriangle className={`w-6 h-6 ${movePending.conflito ? "text-amber-600" : "text-primary/90"}`} />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">
              {movePending.conflito ? "Conflito de Horário" : "Confirmar remarcação"}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              {movePending.conflito ?? (
                <>
                  Mover <strong>{movePending.clientName}</strong> das{" "}
                  <strong>{movePending.fromStartTime}</strong> para as{" "}
                  <strong>{movePending.newStartTime}</strong>
                  {movePending.trocaBarbeiro && <>, com <strong>{movePending.trocaBarbeiro}</strong></>}?
                  <br />
                  <span className="text-xs text-zinc-400">O cliente e o profissional serão avisados por WhatsApp.</span>
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setMovePending(null); load(); }} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors">Cancelar</button>
              <button onClick={() => commitMove(!!movePending.conflito)} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">
                {movePending.conflito ? "Mover assim mesmo" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {encaixePendingData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-primary/90" />
            </div>
            <h2 className="text-lg font-bold text-zinc-900 mb-2">Choque de Horário</h2>
            <p className="text-sm text-zinc-500 mb-6">
              {encaixeMotivo ?? "Este profissional já possui um agendamento neste mesmo horário. Deseja forçar a criação como um ENCAIXE?"}
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setEncaixePendingData(null); setEncaixeMotivo(null); }} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors">Cancelar</button>
              <button onClick={async () => {
                const data = encaixePendingData;
                setEncaixePendingData(null);
                setEncaixeMotivo(null);
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
              }} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition-colors">Confirmar Encaixe</button>
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

      {/* Detalhes no celular/tablet: folha que sobe de baixo (no computador largo fica ao lado da grade) */}
      {sheetOpen && selected && (
        <div className="xl:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setSheetOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={`Horário de ${selected.client.name}`}
            className="relative bg-surface w-full sm:max-w-md rounded-t-[18px] sm:rounded-[18px] max-h-[88vh] overflow-y-auto">
            <AppointmentDetails appt={selected} onClose={() => setSheetOpen(false)} {...detailActions} />
          </div>
        </div>
      )}

      {/* ── Celular ── */}
      <div className="md:hidden flex flex-col gap-3.5">
        <div className="flex items-center justify-between h-12">
          <h1 className="font-display text-[28px] font-bold tracking-[-0.02em]">{barberMode ? "Minha agenda" : "Agenda"}</h1>
          <div className="flex gap-2">
            {!barberMode && <WaitlistPanelButton key={`m-${date}`} date={date} />}
            {barberMode && (
              <button type="button" onClick={() => setShowVender(true)} aria-label="Vender produto"
                className="w-11 h-11 rounded-[10px] border border-control bg-surface text-ink inline-flex items-center justify-center">
                <Package className="w-[18px] h-[18px]" />
              </button>
            )}
            <button type="button" onClick={() => setShowBloqueio(true)} aria-label="Bloquear horário"
              className="w-11 h-11 rounded-[10px] border border-control bg-surface text-ink inline-flex items-center justify-center">
              <Lock className="w-[18px] h-[18px]" />
            </button>
            <label className="relative w-11 h-11 rounded-[10px] border border-control bg-surface text-ink inline-flex items-center justify-center cursor-pointer">
              <Calendar className="w-[18px] h-[18px]" aria-hidden />
              <span className="sr-only">Escolher data</span>
              <input type="date" value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
                className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
        </div>
        {week.length > 0 && <WeekStrip compact days={week} selected={date} today={todayStr} onPick={setDate} />}
        {!isToday && <p className="text-sm font-semibold text-ink-2 -mt-1">{longDayLabel}</p>}
        <AgendaMobile
          appointments={appointments}
          bloqueios={bloqueios}
          barbers={barbers}
          isToday={isToday}
          onSelect={selectAppt}
          onConclude={(a) => setModalAppt(a)}
          onToggleArrived={toggleArrived}
        />
      </div>

      {/* ── Computador ── */}
      <div className="hidden md:flex flex-col gap-4 flex-1 min-h-0">
        <header className="flex items-center justify-between gap-5 flex-wrap">
          <div className="flex items-center gap-3.5 min-w-0">
            <h1 className="font-display text-[30px] font-bold tracking-[-0.02em]">{barberMode ? "Minha agenda" : "Agenda"}</h1>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => navigate(-1)} aria-label="Dia anterior"
                className="w-10 h-10 rounded-[10px] border border-control bg-surface text-ink inline-flex items-center justify-center hover:bg-surface-3">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setDate(todayStr)} disabled={isToday}
                className="h-10 px-3.5 rounded-[10px] border border-control bg-surface text-ink text-[13px] font-semibold hover:bg-surface-3 disabled:opacity-50">
                Hoje
              </button>
              <button type="button" onClick={() => navigate(1)} aria-label="Próximo dia"
                className="w-10 h-10 rounded-[10px] border border-control bg-surface text-ink inline-flex items-center justify-center hover:bg-surface-3">
                <ChevronRight className="w-4 h-4" />
              </button>
              <label className="relative h-10 px-3 rounded-[10px] text-base font-semibold text-ink inline-flex items-center gap-2 cursor-pointer hover:bg-surface-2">
                <span>{longDayLabel}</span>
                <Calendar className="w-4 h-4 text-ink-3" aria-hidden />
                <input type="date" value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
                  aria-label="Escolher data" className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div role="group" aria-label="Visualização" className="flex p-1 gap-0.5 rounded-[10px] bg-track">
              {([["calendar", "Dia"], ["week", "Semana"], ["list", "Lista"]] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key}
                  className={cn("h-[34px] px-3.5 rounded-[7px] text-[13px] font-semibold",
                    view === key ? "bg-surface text-ink shadow-[0_1px_2px_rgba(27,25,22,0.12)]" : "text-ink-2")}>
                  {label}
                </button>
              ))}
            </div>
            {!barberMode && <WaitlistPanelButton key={date} date={date} />}
            {barberMode && (
              <button type="button" onClick={() => setShowVender(true)}
                className="h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-ink text-sm font-semibold inline-flex items-center gap-2 hover:bg-surface-3">
                <Package className="w-4 h-4" /> Vender produto
              </button>
            )}
            <button type="button" onClick={() => setShowBloqueio(true)}
              className="h-[42px] px-3.5 rounded-[10px] border border-control bg-surface text-ink text-sm font-semibold inline-flex items-center gap-2 hover:bg-surface-3">
              <Lock className="w-4 h-4" /> Bloquear horário
            </button>
            <button type="button" onClick={() => setShowAgendamento(true)}
              className="h-[42px] px-4 rounded-[10px] bg-primary hover:bg-primary/90 text-white text-sm font-semibold inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Novo agendamento
            </button>
          </div>
        </header>

        {/* Na Semana, a grade já mostra os dias e a situação de cada horário */}
        {view !== "week" && <div className="flex items-center justify-between gap-4 flex-wrap">
          {week.length > 0 && <WeekStrip days={week} selected={date} today={todayStr} onPick={setDate} />}
          <div className="flex items-center gap-4 text-[13px] text-ink-2 flex-wrap">
            <Legend swatch="bg-surface-3" n={stats.done} label="concluídos" />
            <Legend swatch="bg-surface border border-[#B9B0A1]" n={stats.confirmed} label="confirmados" />
            <Legend swatch="bg-[#FFF8E8] border border-dashed border-[#B08A2E]" n={stats.pending} label="sem confirmação" />
            <Legend swatch="bg-danger-soft border border-[#E3A59D]" n={stats.noShow} label={stats.noShow === 1 ? "falta" : "faltas"} />
          </div>
        </div>}

        {view !== "week" && dayHours && !dayHours.isOpen && (
          <p className="text-[13px] text-warning bg-warning-soft rounded-[10px] px-3.5 py-2.5">
            A barbearia não abre neste dia{dayHours.reason ? ` (${dayHours.reason})` : ""}. Dá para agendar mesmo assim, como encaixe.
          </p>
        )}

        <div className="flex gap-5 flex-1 min-h-0">
          {view === "calendar" ? (
            <section aria-label="Grade de horários" className="flex-1 min-w-0 bg-surface border border-line rounded-2xl flex flex-col overflow-hidden">
              {/* Profissionais */}
              <div className="flex border-b border-line-2">
                <div style={{ width: GUTTER_W, minWidth: GUTTER_W }} className="shrink-0" />
                <div className="flex flex-1 overflow-x-hidden">
                  {barbers.map((b) => {
                    const sum = barberSummary(b);
                    return (
                      <div key={b.id} className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-3 border-l border-line-2" style={{ minWidth: COL_MIN_W }}>
                        <div className="w-[34px] h-[34px] rounded-full overflow-hidden bg-surface-2 text-ink-2 text-xs font-bold flex items-center justify-center shrink-0">
                          {b.photoUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={b.photoUrl} alt="" className="w-full h-full object-cover" />
                            : getInitials(b.user.name)}
                        </div>
                        <div className="min-w-0 flex flex-col">
                          <span className="text-sm font-semibold truncate">{b.user.name}</span>
                          <span className="text-xs text-ink-3 truncate">{sum}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grade */}
              <div ref={gridRef} className="relative flex overflow-auto flex-1" style={{ maxHeight: "calc(100vh - 300px)" }}>
                <div style={{ width: GUTTER_W, minWidth: GUTTER_W, height: GRID_H }} className="shrink-0 relative">
                  {timeLabels.map((t) => (
                    <span key={t} style={{ top: minToTop(t) - 7 }} className="absolute right-2.5 text-[11px] text-ink-4 select-none">{t}</span>
                  ))}
                  {isToday && nowPx !== null && (
                    <span style={{ top: nowPx - 10 }} className="absolute left-1 z-20 h-5 px-1.5 rounded-[5px] bg-primary text-white text-[11px] font-bold inline-flex items-center pointer-events-none">
                      {nowLabel}
                    </span>
                  )}
                </div>

                <div className="flex flex-1">
                  {barbers.map((b) => {
                    const barberAppts = appointments.filter((a) => a.barber.id === b.id);
                    const barberBlocks = bloqueios.filter((bl) => bl.barber.id === b.id);
                    return (
                      <div key={b.id} className="relative flex-1 border-l border-line-2"
                        style={{
                          minWidth: COL_MIN_W, height: GRID_H,
                          backgroundImage: `repeating-linear-gradient(to bottom, #EFEBE3 0, #EFEBE3 1px, transparent 1px, transparent ${ROW_H * 6}px)`,
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const offsetY = e.clientY - rect.top - dragOffset.current;
                          const snapped = Math.round(Math.max(0, offsetY) / (ROW_H * 3)) * 15;
                          setDragOver({ barberId: b.id, mins: START_HOUR * 60 + Math.min(TOTAL_MINS - 15, snapped) });
                        }}
                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = draggingId.current;
                          if (!id) return;
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const offsetY = e.clientY - rect.top - dragOffset.current;
                          const snapped = Math.round(Math.max(0, offsetY) / (ROW_H * 3)) * 15;
                          moveAppointment(id, b.id, START_HOUR * 60 + Math.min(TOTAL_MINS - 15, snapped));
                          draggingId.current = null;
                          setDragOver(null);
                          didDrag.current = true;
                          setTimeout(() => { didDrag.current = false; }, 100);
                        }}>

                        {/* Clique em espaço vazio → novo agendamento naquele horário */}
                        <div className="absolute inset-0 cursor-crosshair" style={{ zIndex: 0 }}
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const snapped = Math.round((e.clientY - rect.top) / (ROW_H * 3)) * 15;
                            const totalMins = Math.max(0, Math.min(TOTAL_MINS - 15, snapped)) + START_HOUR * 60;
                            setAgendamentoInit({ barberId: b.id, startTime: toHHMM(totalMins) });
                            setShowAgendamento(true);
                          }}
                        />

                        {/* Fora do horário do profissional ou da barbearia: só sinaliza, encaixe continua possível */}
                        {offHours(b).map((z) => (
                          <div key={z.key} className="absolute left-0 right-0 bg-surface-2/70 pointer-events-none"
                            style={{ top: z.top, height: z.height }} title="Fora do horário de atendimento" />
                        ))}

                        {/* Bloqueios */}
                        {barberBlocks.map((bl) => {
                          const top = minToTop(bl.startTime);
                          const height = durationHeight(bl.startTime, bl.endTime);
                          if (height <= 0) return null;
                          return (
                            <div key={bl.id}
                              className="absolute left-1 right-1 z-[1] rounded-md border border-control overflow-hidden flex items-start gap-1 px-2 py-1 group bg-[repeating-linear-gradient(135deg,#F7F5F0_0,#F7F5F0_6px,#EBE6DC_6px,#EBE6DC_12px)]"
                              style={{ top: top + 1, height: height - 2 }}>
                              <Lock className="w-3 h-3 text-ink-3 shrink-0 mt-0.5" aria-hidden />
                              <span className="text-xs text-ink-2 font-semibold truncate flex-1">
                                {bl.reason || "Bloqueado"} <span className="font-normal text-ink-3">{bl.startTime} – {bl.endTime}</span>
                              </span>
                              <button type="button" aria-label="Remover bloqueio"
                                onClick={() => setConfirmDialog({ title: "Remover bloqueio", message: "Deseja remover este bloqueio de horário?", onConfirm: () => deleteBloqueio(bl.id) })}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-surface-2">
                                <Trash2 className="w-3 h-3 text-danger" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Horários */}
                        {barberAppts.map((a) => {
                          const top = minToTop(a.startTime);
                          const height = Math.max(durationHeight(a.startTime, a.endTime), ROW_H * 3);
                          const aStart = toMin(a.startTime);
                          const aEnd = toMin(a.endTime);
                          const overlapping = barberAppts
                            .filter((x) => aStart < toMin(x.endTime) && aEnd > toMin(x.startTime))
                            .sort((x, y) => x.id.localeCompare(y.id));
                          const widthPct = 100 / overlapping.length;
                          const leftPct = overlapping.findIndex((x) => x.id === a.id) * widthPct;
                          const st = cardStyle(a.status, a.id === selectedId);
                          const tall = height - 2 >= 36;
                          return (
                            <div key={a.id}
                              role="button"
                              tabIndex={0}
                              aria-label={`${a.startTime} ${a.client.name}, ${servicesLabel(a)}, ${cardNote(a)}`}
                              draggable={isOpenStatus(a.status)}
                              onDragStart={(e) => {
                                draggingId.current = a.id;
                                dragOffset.current = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
                                e.dataTransfer.effectAllowed = "move";
                                e.dataTransfer.setData("text/plain", a.id);
                                setTimeout(() => { (e.target as HTMLElement).style.opacity = "0.45"; }, 0);
                              }}
                              onDragEnd={(e) => { (e.target as HTMLElement).style.opacity = "1"; setDragOver(null); }}
                              onClick={() => { if (didDrag.current) return; selectAppt(a); }}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectAppt(a); } }}
                              className={cn("absolute z-[2] rounded-md overflow-hidden flex flex-col gap-px select-none hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                                isOpenStatus(a.status) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                                tall ? "px-2 py-[5px]" : "px-2 py-1", st.box)}
                              style={{ top: top + 1, height: height - 2, left: `calc(${leftPct}% + 4px)`, width: `calc(${widthPct}% - 8px)` }}>
                              <span className={cn("text-xs leading-4 font-semibold truncate flex items-center gap-1", st.name, st.strike && "line-through")}>
                                {a.arrivedAt && isOpenStatus(a.status) && <UserCheck className="w-3 h-3 shrink-0 text-positive" aria-hidden />}
                                <span className="font-medium opacity-80">{a.startTime}</span>
                                <span className="truncate">{a.client.name}</span>
                              </span>
                              {tall && (
                                <span className={cn("text-[11px] leading-[14px] truncate", st.meta)}>
                                  {servicesLabel(a)} · {cardNote(a)}
                                </span>
                              )}
                            </div>
                          );
                        })}

                        {dragOver?.barberId === b.id && (
                          <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                            style={{ top: ((dragOver.mins - START_HOUR * 60) / 5) * ROW_H }}>
                            <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 -ml-1.5" />
                            <div className="h-0.5 bg-primary flex-1 opacity-80" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {barbers.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-ink-3 py-20 text-sm">Nenhum profissional cadastrado</div>
                  )}
                </div>

                {/* Agora */}
                {isToday && nowPx !== null && (
                  <div aria-hidden className="absolute right-0 z-10 h-0.5 bg-primary pointer-events-none" style={{ top: nowPx, left: GUTTER_W - 8 }}>
                    <span className="absolute -left-0.5 -top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            </section>
          ) : view === "week" ? (
            <WeekView date={date} today={todayStr} barbers={barbers} reloadKey={loadTick}
              onOpen={(day, id) => { setDate(day); setView("calendar"); if (id) setPendingSelect(id); }} />
          ) : (
            <section aria-label="Lista de horários" className="flex-1 min-w-0 bg-surface border border-line rounded-2xl overflow-hidden">
              {appointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-ink-3">
                  <Calendar className="w-10 h-10" aria-hidden />
                  <p className="text-sm font-semibold">Nenhum horário neste dia</p>
                </div>
              ) : (
                <ul className="divide-y divide-line-3">
                  {[...appointments].sort((x, y) => toMin(x.startTime) - toMin(y.startTime)).map((a) => {
                    const st = cardStyle(a.status, false);
                    return (
                      <li key={a.id}>
                        <button type="button" onClick={() => selectAppt(a)}
                          className={cn("w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-surface-3/60", a.id === selectedId && "bg-primary/5")}>
                          <span className="w-14 shrink-0">
                            <span className="block text-sm font-bold text-ink">{a.startTime}</span>
                            <span className="block text-xs text-ink-4">{a.endTime}</span>
                          </span>
                          <span className={cn("w-1 self-stretch rounded-full", st.box)} aria-hidden />
                          <span className="flex-1 min-w-0">
                            <span className={cn("flex items-center gap-2 flex-wrap font-semibold", st.name, st.strike && "line-through")}>
                              {a.client.name}
                              {a.subscription && <Pill tone="info">{a.subscription.plan.name}</Pill>}
                              {a.confirmedVia === "WHATSAPP" && isOpenStatus(a.status) && <Pill tone="success">Confirmou no WhatsApp</Pill>}
                              {a.arrivedAt && isOpenStatus(a.status) && <Pill tone="success">Chegou</Pill>}
                            </span>
                            <span className="block text-[13px] text-ink-3 truncate">{servicesLabel(a)} · {a.barber.user.name} · {STATUS_NOTE[a.status] ?? a.status}</span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className="block text-sm font-semibold text-ink">{formatCurrency(a.price)}</span>
                            {(a.tipAmount ?? 0) > 0 && <span className="block text-xs font-semibold text-positive">+ {formatCurrency(a.tipAmount!)} gorjeta</span>}
                            {a.paymentMethod && a.status === "DONE" && <span className="block text-xs text-ink-4">{METHOD_LABELS[a.paymentMethod] ?? a.paymentMethod}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {/* Detalhes ao lado (computador largo) */}
          <aside aria-label="Detalhes do horário" className={view === "week" ? "hidden" : "hidden xl:flex w-[348px] shrink-0 bg-surface border border-line rounded-2xl flex-col overflow-hidden"}>
            <AppointmentDetails appt={selected} {...detailActions} />
          </aside>
        </div>
      </div>

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

function Legend({ swatch, n, label }: { swatch: string; n: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("w-2.5 h-2.5 rounded-[3px]", swatch)} aria-hidden />
      <strong className="text-ink">{n}</strong> {label}
    </span>
  );
}
