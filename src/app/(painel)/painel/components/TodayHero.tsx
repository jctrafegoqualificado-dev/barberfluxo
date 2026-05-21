"use client";
import React from "react";
import { Sparkles, Wifi, WifiOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface TodayHeroProps {
  today: {
    total: number;
    done: number;
    pending: number;
    noShow: number;
    revenue: number;
    expectedRevenue: number;
    nextAppointment: {
      startTime: string;
      client: { name: string };
      service: { name: string };
      barber: { user: { name: string } };
    } | null;
  };
  whatsapp: {
    status: string;
    lastConnectedAt: string | null;
  };
}

export function TodayHero({ today, whatsapp }: TodayHeroProps) {
  const wsConnected = whatsapp?.status === "CONNECTED";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-6 text-white shadow-xl">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl -ml-10 -mb-10" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-bold">Raio-X de Hoje</h2>
          </div>

          {/* WhatsApp Status Pulse */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
              wsConnected
                ? "bg-green-500/20 text-green-400"
                : "bg-yellow-500/20 text-yellow-400"
            }`}
          >
            <span className="relative flex h-2.5 w-2.5">
              {wsConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  wsConnected ? "bg-green-400" : "bg-yellow-400"
                }`}
              />
            </span>
            {wsConnected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {wsConnected ? "WhatsApp Online" : "WhatsApp Offline"}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Next Client */}
          <div className="col-span-2 sm:col-span-1 bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
            <p className="text-xs text-zinc-400 font-medium mb-1">Próximo Cliente</p>
            {today.nextAppointment ? (
              <>
                <p className="text-lg font-black">
                  {today.nextAppointment.client?.name?.split(" ")[0] || "Cliente"}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {today.nextAppointment.startTime} · {today.nextAppointment.service?.name || "Serviço"}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  com {today.nextAppointment.barber?.user?.name || "Barbeiro"}
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500 mt-1">Nenhum pendente</p>
            )}
          </div>

          {/* Today Metrics */}
          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
            <p className="text-xs text-zinc-400 font-medium mb-1">Agendamentos</p>
            <p className="text-2xl font-black">{today.total}</p>
            <p className="text-[10px] text-zinc-500">
              {today.done} feitos · {today.pending} pendentes
            </p>
          </div>

          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
            <p className="text-xs text-zinc-400 font-medium mb-1">Faturado Hoje</p>
            <p className="text-2xl font-black text-green-400">
              {formatCurrency(today.revenue)}
            </p>
            <p className="text-[10px] text-zinc-500">
              de {formatCurrency(today.expectedRevenue)} previsto
            </p>
          </div>

          <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/10">
            <p className="text-xs text-zinc-400 font-medium mb-1">No-Show Hoje</p>
            <p
              className={`text-2xl font-black ${
                today.noShow > 0 ? "text-red-400" : "text-green-400"
              }`}
            >
              {today.noShow}
            </p>
            <p className="text-[10px] text-zinc-500">faltas registradas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
