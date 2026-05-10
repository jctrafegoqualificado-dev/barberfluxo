"use client";
import { useEffect, useState } from "react";
import { Calendar, DollarSign, Users, Layers, Clock, CheckCircle, TrendingUp, TrendingDown, UserPlus, RefreshCw, Banknote, BadgeCheck } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { StatCard } from "@/components/layout/StatCard";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface DashboardData {
  todayAppointments: Array<{
    id: string; startTime: string; status: string;
    client: { name: string };
    service: { name: string; price: number };
    barber: { user: { name: string } };
  }>;
  monthRevenue: number;
  todayRevenue: number;
  projecaoMes: number;
  activeSubscriptions: number;
  totalClients: number;
  pendingToday: number;
  doneToday: number;
  clientesNovos: number;
  clientesRecorrentes: number;
  receitaMesAnterior: number;
  variacaoReceita: number | null;
  comissoes: { totalPago: number; totalVales: number; barbeirosPagos: number };
}

export default function DashboardPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/barbershop/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setData);
  }, [token]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const variacaoPositiva = data.variacaoReceita !== null && data.variacaoReceita >= 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">{formatDate(new Date())}</p>
      </div>

      {/* Receitas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita do Mês" value={data.monthRevenue} icon={DollarSign} color="green" isCurrency />
        <StatCard title="Receita Hoje" value={data.todayRevenue} icon={DollarSign} color="amber" isCurrency />
        <StatCard title="Assinantes Ativos" value={data.activeSubscriptions} icon={Layers} color="purple" />
        <StatCard title="Total de Clientes" value={data.totalClients} icon={Users} color="blue" />
      </div>

      {/* Projeção + variação + novos vs recorrentes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Projeção do mês */}
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Projeção do Mês</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{formatCurrency(data.projecaoMes)}</p>
          {data.variacaoReceita !== null && (
            <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${variacaoPositiva ? "text-green-600" : "text-red-500"}`}>
              {variacaoPositiva ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {variacaoPositiva ? "+" : ""}{data.variacaoReceita}% vs mês anterior
            </div>
          )}
          <p className="text-xs text-zinc-400 mt-0.5">Mês ant.: {formatCurrency(data.receitaMesAnterior)}</p>
        </div>

        {/* Clientes novos */}
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Clientes Novos</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{data.clientesNovos}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Primeira visita este mês</p>
        </div>

        {/* Clientes recorrentes */}
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className="w-4 h-4 text-green-500" />
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Recorrentes</span>
          </div>
          <p className="text-2xl font-black text-zinc-900">{data.clientesRecorrentes}</p>
          <p className="text-xs text-zinc-400 mt-0.5">Já vieram antes</p>
          {data.clientesNovos + data.clientesRecorrentes > 0 && (
            <div className="mt-2 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full bg-green-400 rounded-full"
                style={{ width: `${Math.round((data.clientesRecorrentes / (data.clientesNovos + data.clientesRecorrentes)) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Comissões do Mês */}
      {(data.comissoes.totalPago > 0 || data.comissoes.totalVales > 0) && (
        <div className="bg-white rounded-xl border border-zinc-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-zinc-700">Comissões do Mês</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {data.comissoes.totalPago > 0 && (
              <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <BadgeCheck className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-xs font-medium text-green-700">Pago</span>
                </div>
                <p className="text-lg font-black text-green-700">{formatCurrency(data.comissoes.totalPago)}</p>
                <p className="text-xs text-green-600">{data.comissoes.barbeirosPagos} barbeiro(s)</p>
              </div>
            )}
            {data.comissoes.totalVales > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-medium text-red-600">Vales</span>
                </div>
                <p className="text-lg font-black text-red-500">{formatCurrency(data.comissoes.totalVales)}</p>
                <p className="text-xs text-red-400">adiantamentos</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hoje */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">Pendentes hoje</span>
          </div>
          <p className="text-3xl font-bold text-amber-700">{data.pendingToday}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Concluídos hoje</span>
          </div>
          <p className="text-3xl font-bold text-green-700">{data.doneToday}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Total hoje</span>
          </div>
          <p className="text-3xl font-bold text-blue-700">{data.todayAppointments.length}</p>
        </div>
      </div>

      {/* Agenda */}
      <div className="bg-white rounded-xl shadow-sm border border-zinc-100">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">Agenda de Hoje</h2>
        </div>
        {data.todayAppointments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
            <Calendar className="w-10 h-10 mb-2" />
            <p>Nenhum agendamento para hoje</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50">
            {data.todayAppointments.map((a) => (
              <div key={a.id} className="px-6 py-4 flex items-center gap-4">
                <div className="w-16 text-center">
                  <span className="text-sm font-bold text-zinc-900">{a.startTime}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900">{a.client.name}</p>
                  <p className="text-xs text-zinc-500">{a.service.name} · {a.barber.user.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-zinc-900">{formatCurrency(a.service.price)}</p>
                </div>
                <Badge status={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
