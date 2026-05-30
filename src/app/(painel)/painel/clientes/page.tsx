"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, Users, CalendarDays, DollarSign, RotateCcw, BadgeCheck,
  ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  MessageSquare, Phone, Mail, Sparkles, Filter, ShieldAlert, Star, Cake, Edit3, Trash2, X, Save, Plus, CreditCard,
  Upload, UserPlus, Loader2, FileText, CheckCircle2
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, getInitials, formatDate } from "@/lib/utils";
import { ConfirmDialog, AlertDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonRow } from "@/components/ui/SkeletonCard";

interface Plan { id: string; name: string; price: number }

interface Cliente {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  totalVisits: number;
  totalSpent: number;
  thisMonthVisits: number;
  firstVisit: string | null;
  lastVisit: string | null;
  daysSinceLastVisit: number | null;
  avgFrequency: number | null;
  isNew: boolean;
  activePlan: string | null;
  isBlocked: boolean;
  birthday: string | null;
  noShowCount: number;
}

function FrequencyBadge({ days }: { days: number | null }) {
  if (days === null || days === undefined) return <span className="text-xs text-zinc-400 font-medium">—</span>;
  const color = days <= 21 ? "text-emerald-700 bg-emerald-50 border-emerald-100" : days <= 45 ? "text-amber-700 bg-amber-50 border-amber-100" : "text-rose-700 bg-rose-50 border-rose-100";
  return (
    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${color}`}>
      a cada {days}d
    </span>
  );
}

function LastVisitBadge({ days, date }: { days: number | null; date: string | null }) {
  if (days === null || date === null) return <span className="text-xs text-zinc-400 italic">Nunca frequentou</span>;
  if (days === 0) return <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Hoje</span>;
  
  let color = "text-emerald-600 bg-emerald-50 border-emerald-100";
  if (days > 7 && days <= 30) {
    color = "text-amber-600 bg-amber-50 border-amber-100";
  } else if (days > 30) {
    color = "text-rose-500 bg-rose-50 border-rose-100";
  }
  
  return (
    <div className="flex flex-col text-right">
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border self-end ${color}`}>
        {days}d atrás
      </span>
      <span className="text-[10px] text-zinc-400 mt-0.5">{formatDate(date)}</span>
    </div>
  );
}

export default function ClientesPage() {
  const { token } = useAuthStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [moral, setMoral] = useState(4.7); // NPS default
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "ultima_visita" | "bloqueados" | "aniversariantes">("todos");
  
  // Sorting states
  const [sortField, setSortField] = useState<"name" | "totalVisits" | "totalSpent" | "avgFrequency" | "daysSinceLastVisit">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Edit & Detail modal (Ficha do Cliente)
  const [editModal, setEditModal] = useState<Cliente | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [editIsBlocked, setEditIsBlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ id: string } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ title: string; message: string; type?: "info" | "danger" | "success" } | null>(null);

  // Subscription add from Ficha
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addSubPlanId, setAddSubPlanId] = useState("");
  const [addSubBillingDay, setAddSubBillingDay] = useState("");
  const [addSubSaving, setAddSubSaving] = useState(false);

  // Novo cliente manual
  const [newClientModal, setNewClientModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientSaving, setNewClientSaving] = useState(false);

  // Importar CSV
  const [importModal, setImportModal] = useState(false);
  const [csvRows, setCsvRows] = useState<{ name: string; phone: string; email: string }[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    Promise.all([
      fetch("/api/barbershop/clientes", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/barbershop/plans", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([clientData, planData]) => {
      setClientes(clientData.clientes || []);
      if (clientData.moral !== undefined) setMoral(clientData.moral);
      setPlans(planData.plans || []);
      setLoading(false);
    });
  }, [token]);

  async function handleAddSubscription(cliente: Cliente) {
    if (!addSubPlanId) { setAlertDialog({ title: "Selecione um plano", message: "Escolha um plano antes de confirmar.", type: "danger" }); return; }
    setAddSubSaving(true);
    try {
      const res = await fetch("/api/barbershop/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientName: cliente.name, clientPhone: cliente.phone || "", planId: addSubPlanId, billingDay: addSubBillingDay }),
      });
      const data = await res.json();
      if (!res.ok) { setAlertDialog({ title: "Erro", message: data.error || "Não foi possível criar a assinatura.", type: "danger" }); return; }
      setEditModal(null);
      setAddSubPlanId("");
      setAddSubBillingDay("");
      setAlertDialog({ title: "Assinatura criada!", message: `${cliente.name} agora é assinante.`, type: "success" });
      load();
    } finally {
      setAddSubSaving(false);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  // Reset pagination when searching/filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      if (field === "name") {
        setSortDirection("asc");
      } else {
        setSortDirection("desc");
      }
    }
    setCurrentPage(1);
  };

  function openEdit(c: Cliente) {
    setEditModal(c);
    setEditName(c.name);
    setEditPhone(c.phone || "");
    setEditIsBlocked(c.isBlocked);
    setEditBirthday(c.birthday ? c.birthday.substring(0, 10) : "");
    setAddSubPlanId("");
    setAddSubBillingDay("");
  }

  async function handleSaveEdit() {
    if (!editModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/barbershop/clientes/${editModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          name: editName, 
          phone: editPhone, 
          isBlocked: editIsBlocked,
          birthday: editBirthday ? new Date(editBirthday).toISOString() : null
        }),
      });
      const data = await res.json();
      if (!res.ok) { 
        setAlertDialog({ title: "Erro ao salvar", message: data.error || "Tente novamente.", type: "danger" });
        return; 
      }
      setEditModal(null);
      setAlertDialog({ title: "Sucesso!", message: "Ficha do cliente atualizada com sucesso.", type: "success" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: string) {
    const res = await fetch(`/api/barbershop/clientes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      setAlertDialog({ title: "Erro ao excluir", message: data.error || "Tente novamente mais tarde.", type: "danger" });
      return;
    }
    setEditModal(null);
    setAlertDialog({ title: "Cliente excluído", message: "O cadastro foi anonimizado e removido da lista ativa.", type: "success" });
    load();
  }

  function handleDelete(id: string) {
    setConfirmDialog({ id });
  }

  async function handleCreateClient() {
    if (!newClientName.trim()) return;
    setNewClientSaving(true);
    try {
      const res = await fetch("/api/barbershop/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newClientName, phone: newClientPhone, email: newClientEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertDialog({ title: "Erro", message: data.error || "Não foi possível criar o cliente.", type: "danger" });
        return;
      }
      setNewClientModal(false);
      setNewClientName(""); setNewClientPhone(""); setNewClientEmail("");
      setAlertDialog({ title: "Cliente criado!", message: `${newClientName} foi adicionado com sucesso.`, type: "success" });
      load();
    } finally {
      setNewClientSaving(false);
    }
  }

  function parseCsv(text: string) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = lines[0].toLowerCase().split(/[;,\t]/).map(h => h.trim().replace(/"/g, ""));
    const nameIdx = header.findIndex(h => h.includes("nome") || h === "name");
    const phoneIdx = header.findIndex(h => h.includes("fone") || h.includes("celular") || h.includes("whatsapp") || h === "phone" || h === "telefone");
    const emailIdx = header.findIndex(h => h === "email" || h === "e-mail");
    if (nameIdx === -1) return [];
    return lines.slice(1).map(line => {
      const cols = line.split(/[;,\t]/).map(c => c.trim().replace(/"/g, ""));
      return {
        name: cols[nameIdx] ?? "",
        phone: phoneIdx >= 0 ? (cols[phoneIdx] ?? "") : "",
        email: emailIdx >= 0 ? (cols[emailIdx] ?? "") : "",
      };
    }).filter(r => r.name.length > 0);
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRows(parseCsv(text));
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    if (csvRows.length === 0) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/barbershop/clientes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rows: csvRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertDialog({ title: "Erro na importação", message: data.error || "Falha ao importar.", type: "danger" });
        return;
      }
      setImportResult(data);
      load();
    } finally {
      setImportLoading(false);
    }
  }

  const currentMonth = new Date().getMonth();

  const filtered = clientes.filter((c) => {
    const realEmail = c.email && !c.email.includes("@cliente.") ? c.email : "";
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      realEmail.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone ?? "").includes(search);

    let matchFilter = true;
    if (filter === "bloqueados") {
      matchFilter = c.isBlocked;
    } else if (filter === "aniversariantes") {
      if (!c.birthday) {
        matchFilter = false;
      } else {
        const bMonth = new Date(c.birthday).getMonth();
        matchFilter = bMonth === currentMonth;
      }
    } else if (filter === "ultima_visita") {
      matchFilter = c.totalVisits > 0;
    }

    return matchSearch && matchFilter;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === "avgFrequency") {
      if (valA === null || valA === undefined) return sortDirection === "asc" ? 1 : -1;
      if (valB === null || valB === undefined) return sortDirection === "asc" ? -1 : 1;
    }

    if (sortField === "daysSinceLastVisit") {
      if (valA === null || valA === undefined) return sortDirection === "asc" ? 1 : -1;
      if (valB === null || valB === undefined) return sortDirection === "asc" ? -1 : 1;
    }

    if (typeof valA === "string") {
      return sortDirection === "asc"
        ? valA.localeCompare(valB as string)
        : (valB as string).localeCompare(valA);
    }

    const numA = valA as number;
    const numB = valB as number;
    return sortDirection === "asc" ? numA - numB : numB - numA;
  });

  // Pagination bounds
  const totalRows = sorted.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginated = sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const totalClientes = clientes.length;
  const totalBloqueados = clientes.filter((c) => c.isBlocked).length;
  const aniversariantesDoMes = clientes.filter((c) => {
    if (!c.birthday) return false;
    return new Date(c.birthday).getMonth() === currentMonth;
  }).length;

  const renderSortIcon = (field: typeof sortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 text-zinc-400 group-hover:text-zinc-600 transition-colors" />;
    return sortDirection === "asc" 
      ? <ChevronUp className="w-3.5 h-3.5 ml-1 text-amber-600 font-bold" />
      : <ChevronDown className="w-3.5 h-3.5 ml-1 text-amber-600 font-bold" />;
  };

  function triggerWhatsappMessage(name: string, phone: string | null, type: "reengage" | "birthday") {
    if (!phone) {
      setAlertDialog({ title: "WhatsApp Indisponível", message: "Este cliente não possui telefone cadastrado.", type: "danger" });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    let text = "";
    if (type === "reengage") {
      text = `Olá, ${name}! Sentimos sua falta ultimamente. 💈 Que tal reservar um horário para dar aquele trato no visual esta semana? Agende online clicando aqui!`;
    } else {
      text = `Parabéns, ${name}! 🥳 Desejamos um feliz aniversário e muita saúde! Para comemorar seu dia especial, preparamos um desconto exclusivo para você em seu próximo corte. Reserve seu horário!`;
    }
    const url = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-zinc-950 tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-amber-500" />
            Gestão de Clientes
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">Visão unificada, frequência de retorno e histórico financeiro</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setImportModal(true); setCsvRows([]); setImportResult(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-bold text-sm shadow-sm transition-all"
          >
            <Upload className="w-4 h-4" />
            Importar CSV
          </button>
          <button
            onClick={() => { setNewClientModal(true); setNewClientName(""); setNewClientPhone(""); setNewClientEmail(""); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* 🚀 Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-zinc-150 p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 scale-150 group-hover:scale-125 transition-transform duration-300">
              <Users className="w-24 h-24 text-zinc-900" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-500">Clientes Ativos</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-zinc-900">{totalClientes}</span>
              <span className="text-xs text-zinc-400">clientes únicos</span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">Já realizaram pelo menos 1 atendimento</p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-150 p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 scale-150 group-hover:scale-125 transition-transform duration-300">
              <ShieldAlert className="w-24 h-24 text-red-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-500">Bloqueados</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-red-500" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-zinc-900">{totalBloqueados}</span>
              <span className="text-xs text-zinc-400">impedidos</span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">Agendamentos bloqueados no WhatsApp</p>
          </div>

          <div className="bg-white rounded-2xl border border-zinc-150 p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 scale-150 group-hover:scale-125 transition-transform duration-300">
              <Star className="w-24 h-24 text-amber-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-500">Reputação Moral</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-zinc-900">★ {moral}</span>
              <span className="text-xs text-zinc-400">/ 10 NPS</span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">Avaliação de satisfação dos clientes</p>
          </div>
        </div>
      )}

      {/* Filtros rápidos & Search */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between lg:items-center">
          {/* Quick Filters */}
          {!loading && (
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-xs font-bold text-zinc-400 flex items-center gap-1 uppercase tracking-wider mr-1">
                <Filter className="w-3 h-3" /> Filtrar:
              </span>
              {([
                { key: "todos", label: `Todos (${clientes.length})` },
                { key: "ultima_visita", label: `Última Visita (${clientes.filter(c => c.totalVisits > 0).length})` },
                { key: "bloqueados", label: `Bloqueados (${totalBloqueados})` },
                { key: "aniversariantes", label: `Aniversariantes (${aniversariantesDoMes})` },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border ${
                    filter === key
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                      : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Rows selector */}
          {!loading && (
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 self-end lg:self-auto">
              <span>Linhas por página:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-zinc-50 border border-zinc-200 rounded-lg p-1.5 font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 text-zinc-700 cursor-pointer"
              >
                {[10, 25, 50, 100].map((num) => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome, e-mail ou telefone..."
            className="w-full rounded-xl border border-zinc-200 pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
          />
        </div>
      </div>

      {loading && clientes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-16 text-center text-zinc-400 shadow-sm">
          <Users className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          <p className="font-semibold text-zinc-950">Nenhum cliente encontrado</p>
          <p className="text-xs text-zinc-400 mt-1">Refine seus filtros de busca ou pesquise outro termo</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50/80 text-zinc-500 text-xs font-bold uppercase tracking-wider border-b border-zinc-200">
                <tr>
                  <th 
                    onClick={() => handleSort("name")}
                    className="px-6 py-4 cursor-pointer hover:bg-zinc-100/50 transition-colors group select-none"
                  >
                    <div className="flex items-center">
                      Cliente
                      {renderSortIcon("name")}
                    </div>
                  </th>
                  <th className="px-6 py-4 select-none">Telefone</th>
                  <th 
                    onClick={() => handleSort("totalVisits")}
                    className="px-6 py-4 text-center cursor-pointer hover:bg-zinc-100/50 transition-colors group select-none"
                  >
                    <div className="flex items-center justify-center">
                      Visitas
                      {renderSortIcon("totalVisits")}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("totalSpent")}
                    className="px-6 py-4 text-right cursor-pointer hover:bg-zinc-100/50 transition-colors group select-none"
                  >
                    <div className="flex items-center justify-end">
                      Gasto Total
                      {renderSortIcon("totalSpent")}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("avgFrequency")}
                    className="px-6 py-4 text-center cursor-pointer hover:bg-zinc-100/50 transition-colors group select-none"
                  >
                    <div className="flex items-center justify-center">
                      Frequência
                      {renderSortIcon("avgFrequency")}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort("daysSinceLastVisit")}
                    className="px-6 py-4 text-right cursor-pointer hover:bg-zinc-100/50 transition-colors group select-none"
                  >
                    <div className="flex items-center justify-end">
                      Última Visita
                      {renderSortIcon("daysSinceLastVisit")}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right select-none font-bold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {paginated.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/50 transition-all duration-150">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${c.isBlocked ? 'bg-red-50 border-red-200' : 'bg-amber-100 border-amber-200'}`}>
                            <span className={`font-extrabold text-sm ${c.isBlocked ? 'text-red-500' : 'text-amber-700'}`}>{getInitials(c.name)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-zinc-950 truncate max-w-[150px] sm:max-w-[200px]">{c.name}</p>
                              {c.isBlocked && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-650 border border-red-100 flex items-center gap-1 shrink-0">
                                  <ShieldAlert className="w-2.5 h-2.5" /> Bloqueado
                                </span>
                              )}
                              {c.isNew && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                                  Novo
                                </span>
                              )}
                              {c.activePlan && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                                  <BadgeCheck className="w-3 h-3 text-emerald-500" />
                                  {c.activePlan}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 truncate max-w-[150px] sm:max-w-[200px] flex items-center gap-1 mt-0.5">
                              <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
                              {c.email && !c.email.includes("@cliente.") ? c.email : <span className="italic text-zinc-300">sem e-mail</span>}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-zinc-600 font-medium">
                        {c.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-zinc-400" />
                            {c.phone}
                          </span>
                        ) : (
                          <span className="text-zinc-300 italic text-xs">Sem telefone</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-zinc-900 text-sm">{c.totalVisits}</span>
                          {c.thisMonthVisits > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full mt-0.5 border border-amber-100 shrink-0">
                              +{c.thisMonthVisits} este mês
                            </span>
                          )}
                          {c.noShowCount > 0 && (
                            <span title="Faltas (não compareceu)" className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full mt-0.5 border border-red-100 shrink-0">
                              {c.noShowCount} falta{c.noShowCount > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right font-black text-zinc-950 text-sm">
                        {formatCurrency(c.totalSpent)}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <FrequencyBadge days={c.avgFrequency} />
                      </td>

                      <td className="px-6 py-4">
                        <LastVisitBadge days={c.daysSinceLastVisit} date={c.lastVisit} />
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {c.phone && (
                            <button
                              onClick={() => triggerWhatsappMessage(c.name, c.phone, filter === "aniversariantes" ? "birthday" : "reengage")}
                              title={filter === "aniversariantes" ? "WhatsApp Parabéns" : "Mensagem de Retorno"}
                              className="inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(c)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:text-amber-700 hover:border-amber-400 shadow-sm hover:shadow transition-all text-xs font-bold flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Ficha</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                Mostrando {(currentPage - 1) * rowsPerPage + 1} a{" "}
                {Math.min(currentPage * rowsPerPage, totalRows)} de {totalRows} clientes
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4 text-zinc-600" />
                </button>
                
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  if (
                    totalPages > 5 &&
                    pNum !== 1 &&
                    pNum !== totalPages &&
                    Math.abs(currentPage - pNum) > 1
                  ) {
                    if (pNum === 2 && currentPage > 3) {
                      return <span key="ell-1" className="px-2 text-zinc-400 text-xs self-center">...</span>;
                    }
                    if (pNum === totalPages - 1 && currentPage < totalPages - 2) {
                      return <span key="ell-2" className="px-2 text-zinc-400 text-xs self-center">...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold border transition-all duration-150 ${
                        currentPage === pNum
                          ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                          : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600"
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <ChevronRight className="w-4 h-4 text-zinc-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* PM Tip */}
      <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-4 text-xs text-zinc-500 flex gap-2.5 items-start">
        <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-zinc-950">Dica de Produto — Fidelidade & Atrito:</p>
          <p className="mt-0.5">Use o botão <strong>WhatsApp</strong> para entrar em contato diretamente com os clientes que estão com frequência abaixo da média ou que não visitam há mais de 30 dias. Campanhas direcionadas geram até 35% mais agendamentos recorrentes.</p>
        </div>
      </div>

      {/* 🚀 Ficha do Cliente Premium Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-150 animate-scaleUp">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 flex items-center justify-between text-white">
              <div>
                <h2 className="font-black text-lg">Ficha Completa do Cliente</h2>
                <p className="text-xs text-amber-100 mt-0.5">ID: {editModal.id}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Cadastral Details */}
              <div className="space-y-3.5">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Dados Cadastrais</h3>
                
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Nome Completo</label>
                  <input 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-zinc-50 hover:bg-white transition-all font-semibold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Telefone / WhatsApp</label>
                  <input 
                    value={editPhone} 
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-zinc-50 hover:bg-white transition-all font-mono font-semibold" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Data de Nascimento (Aniversário)</label>
                  <input 
                    type="date"
                    value={editBirthday} 
                    onChange={(e) => setEditBirthday(e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-zinc-50 hover:bg-white transition-all font-semibold" 
                  />
                </div>
              </div>

              {/* Security section (Block contact) */}
              <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide">Área de Segurança</h4>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-800">Bloquear Cliente</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Impede agendamentos via robô do WhatsApp</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={editIsBlocked}
                      onChange={(e) => setEditIsBlocked(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                  </label>
                </div>
              </div>

              {editModal.activePlan ? (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                  <p className="text-green-700 font-bold text-sm flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 fill-green-700/10" />
                    <span>Assinante — {editModal.activePlan}</span>
                  </p>
                </div>
              ) : plans.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-amber-500" />
                    <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wide">Adicionar ao Plano</h4>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Plano</label>
                    <select
                      value={addSubPlanId}
                      onChange={(e) => setAddSubPlanId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    >
                      <option value="">Selecione um plano...</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}/mês</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Dia de cobrança (opcional)</label>
                    <input
                      type="number" min="1" max="31" value={addSubBillingDay}
                      onChange={(e) => setAddSubBillingDay(e.target.value)}
                      placeholder="Ex: 10"
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    />
                  </div>
                  <button
                    onClick={() => handleAddSubscription(editModal)}
                    disabled={!addSubPlanId || addSubSaving || !editModal.phone}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {addSubSaving ? "Criando assinatura..." : "Criar Assinatura"}
                  </button>
                  {!editModal.phone && (
                    <p className="text-[10px] text-red-500 font-semibold">WhatsApp obrigatório para criar assinatura. Salve o telefone primeiro.</p>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé modal */}
            <div className="px-6 pb-6 pt-2 flex gap-2">
              <button
                onClick={() => handleDelete(editModal.id)}
                title="Excluir cliente"
                className="p-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button
                onClick={async () => {
                  const res = await fetch(`/api/barbershop/clientes/${editModal.id}/lgpd`, {
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!res.ok) return;
                  const blob = new Blob([await res.text()], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `lgpd_${editModal.name.replace(/\s+/g, "_")}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                title="Exportar dados (LGPD)"
                className="p-3 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm"
              >
                <FileText className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setEditModal(null)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-bold hover:bg-zinc-50 hover:border-zinc-350 shadow-sm transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editName.trim()}
                className="flex-[1.8] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-black hover:shadow-md disabled:opacity-40 flex items-center justify-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" />
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── Modal Novo Cliente ─── */}
      {newClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-150">
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 flex items-center justify-between text-white">
              <div>
                <h2 className="font-black text-lg">Novo Cliente</h2>
                <p className="text-xs text-amber-100 mt-0.5">Adicionar cliente manualmente</p>
              </div>
              <button onClick={() => setNewClientModal(false)} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Nome Completo *</label>
                <input
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-zinc-50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Telefone / WhatsApp</label>
                <input
                  value={newClientPhone}
                  onChange={e => setNewClientPhone(e.target.value)}
                  placeholder="Ex: 11999998888"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-zinc-50 font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">E-mail (opcional)</label>
                <input
                  value={newClientEmail}
                  onChange={e => setNewClientEmail(e.target.value)}
                  placeholder="Ex: joao@email.com"
                  type="email"
                  className="w-full rounded-xl border border-zinc-200 px-3.5 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none bg-zinc-50"
                />
              </div>
              <p className="text-[11px] text-zinc-400">Informe ao menos o telefone ou o e-mail para criar o cadastro.</p>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => setNewClientModal(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-bold hover:bg-zinc-50">
                Cancelar
              </button>
              <button
                onClick={handleCreateClient}
                disabled={newClientSaving || !newClientName.trim()}
                className="flex-[1.8] py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-black hover:shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {newClientSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {newClientSaving ? "Criando..." : "Criar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Importar CSV ─── */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-zinc-150">
            <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 px-6 py-5 flex items-center justify-between text-white">
              <div>
                <h2 className="font-black text-lg">Importar Clientes via CSV</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Migre clientes de outros sistemas</p>
              </div>
              <button onClick={() => setImportModal(false)} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {!importResult ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 space-y-1">
                    <p className="font-bold">Formato esperado do CSV:</p>
                    <p>• Colunas: <code className="bg-amber-100 px-1 rounded">nome</code>, <code className="bg-amber-100 px-1 rounded">telefone</code>, <code className="bg-amber-100 px-1 rounded">email</code> (separadas por vírgula, ponto-vírgula ou tab)</p>
                    <p>• Primeira linha deve ser o cabeçalho</p>
                    <p>• Clientes com telefone/e-mail já cadastrado serão ignorados</p>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleCsvFile}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-zinc-300 hover:border-amber-400 rounded-2xl py-8 flex flex-col items-center gap-2 text-zinc-500 hover:text-amber-600 transition-colors"
                    >
                      <FileText className="w-8 h-8" />
                      <span className="font-semibold text-sm">Clique para selecionar o arquivo CSV</span>
                      <span className="text-xs text-zinc-400">ou arraste aqui</span>
                    </button>
                  </div>

                  {csvRows.length > 0 && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                      <p className="text-sm font-bold text-zinc-800 mb-2">
                        <CheckCircle2 className="inline w-4 h-4 text-emerald-500 mr-1" />
                        {csvRows.length} cliente{csvRows.length !== 1 ? "s" : ""} encontrado{csvRows.length !== 1 ? "s" : ""}
                      </p>
                      <div className="max-h-36 overflow-y-auto space-y-1">
                        {csvRows.slice(0, 8).map((r, i) => (
                          <p key={i} className="text-xs text-zinc-600 truncate">
                            <span className="font-semibold">{r.name}</span>
                            {r.phone && <span className="text-zinc-400 ml-2">{r.phone}</span>}
                          </p>
                        ))}
                        {csvRows.length > 8 && <p className="text-xs text-zinc-400 italic">… e mais {csvRows.length - 8}</p>}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3 text-center py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <p className="text-lg font-black text-zinc-900">Importação concluída!</p>
                  <div className="flex justify-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-2xl font-black text-emerald-600">{importResult.created}</p>
                      <p className="text-zinc-500">importados</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-zinc-400">{importResult.skipped}</p>
                      <p className="text-zinc-500">ignorados</p>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="text-xs text-red-500 bg-red-50 rounded-xl p-3 text-left space-y-0.5">
                      {importResult.errors.map((err, i) => <p key={i}>{err}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button onClick={() => setImportModal(false)} className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-600 text-sm font-bold hover:bg-zinc-50">
                {importResult ? "Fechar" : "Cancelar"}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={importLoading || csvRows.length === 0}
                  className="flex-[1.8] py-3 rounded-xl bg-zinc-900 text-white text-sm font-black hover:bg-zinc-800 disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importLoading ? "Importando..." : `Importar ${csvRows.length > 0 ? csvRows.length + " clientes" : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDialog}
        title="Excluir Cliente?"
        message="O cadastro será anonimizado. Agendamentos e assinaturas ativos serão cancelados, mas o histórico financeiro será preservado."
        onConfirm={() => {
          if (confirmDialog) confirmDelete(confirmDialog.id);
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />

      <ConfirmDialog
        isOpen={!!alertDialog}
        title={alertDialog?.title || ""}
        message={alertDialog?.message || ""}
        onConfirm={() => setAlertDialog(null)}
        onCancel={() => setAlertDialog(null)}
      />
    </div>
  );
}
