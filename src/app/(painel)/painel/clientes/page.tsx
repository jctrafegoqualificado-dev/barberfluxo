"use client";
import { useEffect, useState, useCallback } from "react";
import { 
  Search, Users, CalendarDays, DollarSign, RotateCcw, 
  BadgeCheck, Edit3, Trash2, X, Save, AlertTriangle, 
  ShieldAlert, Star, Cake, MessageSquare, PhoneCall, ArrowUpDown
} from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { formatCurrency, getInitials } from "@/lib/utils";
import { ConfirmDialog, AlertDialog } from "@/components/ui/ConfirmDialog";

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
}

function FrequencyBadge({ days }: { days: number | null }) {
  if (!days) return <span className="text-xs text-zinc-400">—</span>;
  const color = days <= 21 ? "text-green-600 bg-green-50 animate-pulse" : days <= 45 ? "text-amber-600 bg-amber-50" : "text-red-500 bg-red-50";
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      a cada {days}d
    </span>
  );
}

function formatLastVisitHuman(days: number | null) {
  if (days === null) return <span className="text-xs text-zinc-400">Nunca frequentou</span>;
  if (days === 0) return <span className="text-xs font-semibold text-emerald-600">Hoje</span>;
  if (days === 1) return <span className="text-xs text-emerald-600">Ontem</span>;
  if (days <= 7) return <span className="text-xs text-emerald-600">há {days} dias</span>;
  if (days <= 30) return <span className="text-xs text-amber-600">há {days} dias</span>;
  const months = Math.floor(days / 30);
  if (months === 1) return <span className="text-xs text-red-500">há 1 mês</span>;
  return <span className="text-xs text-red-500 font-medium">há {months} meses</span>;
}

export default function ClientesPage() {
  const { token } = useAuthStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [moral, setMoral] = useState(4.7); // NPS default
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "ultima_visita" | "bloqueados" | "aniversariantes">("todos");
  const [sortOrder, setSortOrder] = useState<"crescente_az" | "decrescente_za" | "mais_visitas" | "maior_faturamento" | "inativo_tempo">("crescente_az");
  
  // Edit & Detail modal (Ficha do Cliente)
  const [editModal, setEditModal] = useState<Cliente | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthday, setEditBirthday] = useState("");
  const [editIsBlocked, setEditIsBlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ id: string } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ title: string; message: string; type?: "info" | "danger" | "success" } | null>(null);

  const load = useCallback(() => {
    fetch("/api/barbershop/clientes", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { 
        setClientes(d.clientes || []); 
        if (d.moral !== undefined) setMoral(d.moral);
        setLoading(false); 
      });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openEdit(c: Cliente) {
    setEditModal(c);
    setEditName(c.name);
    setEditPhone(c.phone || "");
    setEditIsBlocked(c.isBlocked);
    if (c.birthday) {
      setEditBirthday(c.birthday.substring(0, 10)); // YYYY-MM-DD
    } else {
      setEditBirthday("");
    }
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

  const currentMonth = new Date().getMonth();

  // 1. Filtragem reativa
  const filtered = clientes.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
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

  // 2. Ordenação avançada
  filtered.sort((a, b) => {
    if (sortOrder === "crescente_az") {
      return a.name.localeCompare(b.name);
    }
    if (sortOrder === "decrescente_za") {
      return b.name.localeCompare(a.name);
    }
    if (sortOrder === "mais_visitas") {
      return b.totalVisits - a.totalVisits;
    }
    if (sortOrder === "maior_faturamento") {
      return b.totalSpent - a.totalSpent;
    }
    if (sortOrder === "inativo_tempo") {
      const daysA = a.daysSinceLastVisit ?? 9999;
      const daysB = b.daysSinceLastVisit ?? 9999;
      return daysB - daysA;
    }
    return 0;
  });

  // Métricas rápidas para os Cards do Topo
  const totalClientes = clientes.length;
  const totalBloqueados = clientes.filter((c) => c.isBlocked).length;
  const aniversariantesDoMes = clientes.filter((c) => {
    if (!c.birthday) return false;
    return new Date(c.birthday).getMonth() === currentMonth;
  }).length;

  // Função para abrir WhatsApp rápido
  function triggerWhatsappMessage(name: string, phone: string | null, type: "reengage" | "birthday") {
    if (!phone) {
      setAlertDialog({ title: "WhatsApp Indisponível", message: "Este cliente não possui telefone cadastrado.", type: "danger" });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    let text = "";
    if (type === "reengage") {
      text = `Olá ${name}! Sentimos sua falta ultimamente. 💈 Que tal reservar um horário para dar aquele trato no visual esta semana? Agende online clicando aqui!`;
    } else {
      text = `Parabéns, ${name}! 🥳 Desejamos um feliz aniversário e muita saúde! Para comemorar seu dia especial, preparamos um desconto exclusivo para você em seu próximo corte. Reserve seu horário!`;
    }
    const url = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Gestão de Clientes</h1>
          <p className="text-zinc-500 text-sm mt-1">Estatísticas, controle de reputação moral e fidelização ativa</p>
        </div>
      </div>

      {/* 🚀 3 Cards Analíticos Premium de Alta Categoria (Inspirados na Imagem) */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Total Clientes */}
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
            <p className="text-xs text-zinc-400 mt-2">Já realizaram pelo menos 1 interação</p>
          </div>

          {/* Card 2: Clientes Bloqueados */}
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
            <p className="text-xs text-zinc-400 mt-2">Contatos bloqueados no robô de WhatsApp</p>
          </div>

          {/* Card 3: Moral / Reputação (NPS do Salão) */}
          <div className="bg-white rounded-2xl border border-zinc-150 p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
            <div className="absolute right-0 bottom-0 translate-x-2 translate-y-2 opacity-5 scale-150 group-hover:scale-125 transition-transform duration-300">
              <Star className="w-24 h-24 text-amber-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-500">Reputação Moral</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center animate-bounce">
                <Star className="w-4 h-4 text-emerald-600 fill-emerald-600" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-zinc-900">★ {moral}</span>
              <span className="text-xs text-zinc-400">/ 10 NPS</span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">Média das notas reais dadas nas avaliações</p>
          </div>
        </div>
      )}

      {/* 🚀 Filtros rápidos estilizados como Abas da Imagem */}
      {!loading && (
        <div className="flex gap-2 flex-wrap bg-zinc-100/80 p-1.5 rounded-xl border border-zinc-200/50 max-w-max">
          {([
            { key: "todos", label: "Todos", count: totalClientes },
            { key: "ultima_visita", label: "Última Visita", count: clientes.filter(c => c.totalVisits > 0).length },
            { key: "bloqueados", label: "Bloqueados", count: totalBloqueados },
            { key: "aniversariantes", label: `Aniversariantes do Mês (${aniversariantesDoMes})`, count: aniversariantesDoMes },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${filter === key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              {label} {count > 0 && <span className="ml-1 text-[10px] bg-zinc-200 text-zinc-600 px-1.5 py-0.5 rounded-full">{count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* 🚀 Barra de Pesquisa & Ordenação Combinados (Inspirado no BarberCode) */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome ou telefone..."
            className="w-full rounded-xl border border-zinc-200 pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white shadow-sm"
          />
        </div>

        {/* Seletor de Ordenação */}
        <div className="flex items-center gap-2 shrink-0 bg-white border border-zinc-200 rounded-xl px-3 shadow-sm">
          <ArrowUpDown className="w-4 h-4 text-zinc-400" />
          <select
            value={sortOrder}
            onChange={(e: any) => setSortOrder(e.target.value)}
            className="border-0 focus:ring-0 text-sm font-semibold text-zinc-700 bg-transparent py-3 pr-8 focus:outline-none cursor-pointer"
          >
            <option value="crescente_az">Ordenação: Crescente - A-Z</option>
            <option value="decrescente_za">Ordenação: Decrescente - Z-A</option>
            <option value="mais_visitas">Ordenação: Mais Visitas</option>
            <option value="maior_faturamento">Ordenação: Maior Faturamento</option>
            <option value="inativo_tempo">Ordenação: Inativo há mais tempo</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-150 p-16 text-center text-zinc-400 shadow-sm">
          <Users className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
          <p className="font-semibold text-zinc-700">Nenhum cliente encontrado com esse filtro</p>
          <p className="text-xs text-zinc-400 mt-1">Experimente buscar por outro termo ou trocar o filtro rápido.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
          <div className="divide-y divide-zinc-100">
            {filtered.map((c) => (
              <div key={c.id} className="px-5 py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-zinc-50/50 transition-all">
                
                {/* Lado Esquerdo: Avatar & Informações Básicas */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${c.isBlocked ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-100'}`}>
                    <span className={`font-black text-sm ${c.isBlocked ? 'text-red-500' : 'text-amber-800'}`}>{getInitials(c.name)}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-zinc-900 truncate text-sm sm:text-base">{c.name}</p>
                      {c.isBlocked && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1 border border-red-200">
                          <ShieldAlert className="w-2.5 h-2.5" /> BLOQUEADO
                        </span>
                      )}
                      {c.isNew && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">NOVO</span>
                      )}
                      {c.activePlan && (
                        <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
                          <BadgeCheck className="w-2.5 h-2.5" />{c.activePlan}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5 truncate">
                      <span>{c.email}</span>
                      {c.phone && (
                        <>
                          <span className="text-zinc-300">·</span>
                          <span className="font-medium text-zinc-700">{c.phone}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Centro: Métricas com Grid Inteligente */}
                <div className="flex flex-wrap items-center gap-5 sm:gap-7 shrink-0 text-zinc-600">
                  
                  {/* Coluna Aniversário se aba aniversariantes */}
                  {c.birthday && (
                    <div className="text-left">
                      <p className="text-[10px] text-zinc-400 font-semibold uppercase flex items-center gap-1">
                        <Cake className="w-3 h-3 text-pink-500" /> Aniversário
                      </p>
                      <p className="text-xs font-bold text-zinc-800">
                        {new Date(c.birthday).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </p>
                    </div>
                  )}

                  <div className="text-center">
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase">Visitas</p>
                    <p className="text-sm font-extrabold text-zinc-900 mt-0.5">{c.totalVisits}</p>
                    {c.thisMonthVisits > 0 && (
                      <p className="text-[10px] font-semibold text-amber-600">+{c.thisMonthVisits} este mês</p>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase">Gasto total</p>
                    <p className="text-sm font-extrabold text-zinc-900 mt-0.5">{formatCurrency(c.totalSpent)}</p>
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase">Frequência</p>
                    <div className="mt-0.5">
                      <FrequencyBadge days={c.avgFrequency} />
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-[10px] text-zinc-400 font-semibold uppercase">Última visita</p>
                    <div className="mt-0.5">
                      {formatLastVisitHuman(c.daysSinceLastVisit)}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Ações Rápidas do Robô & Ficha Completa */}
                <div className="flex items-center gap-2 justify-end shrink-0 border-t border-zinc-100 sm:border-0 pt-3 sm:pt-0">
                  
                  {/* WhatsApp Rápido (Seletivo com cor verde moderna e base de reengajamento) */}
                  {c.phone && (
                    <button
                      onClick={() => triggerWhatsappMessage(c.name, c.phone, filter === "aniversariantes" ? "birthday" : "reengage")}
                      title={filter === "aniversariantes" ? "Dar Parabéns pelo WhatsApp" : "Enviar lembrete de retorno"}
                      className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 transition-all flex items-center gap-1.5 text-xs font-bold"
                    >
                      <MessageSquare className="w-4 h-4 fill-emerald-600/10" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>
                  )}

                  {/* Botão Ficha (Inspirado no visual premium "Ficha") */}
                  <button
                    onClick={() => openEdit(c)}
                    className="px-4 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:text-amber-700 hover:border-amber-400 shadow-sm hover:shadow transition-all text-xs font-bold flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ficha</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🚀 Ficha do Cliente Premium (Modal Completo de Visualização e Ajustes Sênior) */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-zinc-150 animate-scaleUp">
            
            {/* Header com Gradiente Amber */}
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
              
              {/* Seção Principal: Informações Cadastrais */}
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

              {/* Seção Avançada: Status de Bloqueio e Prevenção do Chatbot */}
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

              {/* Informações Auxiliares (Planos Ativos) */}
              {editModal.activePlan && (
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                  <p className="text-green-700 font-bold text-sm flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 fill-green-700/10" /> 
                    <span>Membro do Plano: {editModal.activePlan}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Ações de Rodapé */}
            <div className="px-6 pb-6 pt-2 flex gap-2">
              <button
                onClick={() => handleDelete(editModal.id)}
                title="Excluir cliente de forma segura"
                className="p-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-all shadow-sm"
              >
                <Trash2 className="w-5 h-5" />
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
