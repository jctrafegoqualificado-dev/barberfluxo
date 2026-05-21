"use client";
import React from "react";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils";

interface TodayAgendaProps {
  appointments: Array<{
    id: string;
    startTime: string;
    status: string;
    client: { name: string };
    service: { name: string; price: number; duration: number };
    barber: { user: { name: string } };
  }>;
  total: number;
}

export function TodayAgenda({ appointments, total }: TodayAgendaProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-150 overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-900">Agenda de Hoje</h2>
        <span className="text-[10px] text-zinc-400 font-bold uppercase">
          {total} agendamento{total !== 1 ? "s" : ""}
        </span>
      </div>
      {appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
          <Calendar className="w-10 h-10 mb-2" />
          <p className="text-sm">Nenhum agendamento para hoje</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-50">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="px-6 py-3.5 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors"
            >
              <div className="w-14 text-center shrink-0">
                <span className="text-sm font-black text-zinc-900">{a.startTime}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-zinc-900 truncate">
                  {a.client?.name || "Cliente"}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {a.service?.name || "Serviço"} · {a.barber?.user?.name || "Barbeiro"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-black text-zinc-900">
                  {formatCurrency(a.service?.price || 0)}
                </span>
                <div className="mt-1">
                  <Badge status={a.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
