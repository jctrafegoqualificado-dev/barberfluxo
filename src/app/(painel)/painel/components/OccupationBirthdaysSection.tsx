"use client";
import React from "react";
import { Zap, Gift, MessageCircle } from "lucide-react";
import { PieChart, Pie, ResponsiveContainer } from "recharts";

interface OccupationBirthdaysSectionProps {
  occupation: {
    pct: number;
    status: string;
    usedMinutes: number;
    availableMinutes: number;
  };
  birthdaysThisMonth: Array<{
    id: string;
    name: string;
    phone: string | null;
    day: number;
  }>;
}

export function OccupationBirthdaysSection({
  occupation,
  birthdaysThisMonth,
}: OccupationBirthdaysSectionProps) {
  const currentMonthName = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date()
  );
  const capitalizedMonth =
    currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Gauge de Ocupação da Equipe */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-zinc-900 text-sm">Ocupação da Equipe</h3>
        </div>
        <div className="h-40 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  {
                    value: occupation.pct,
                    fill:
                      occupation.pct >= 80
                        ? "#EF4444"
                        : occupation.pct >= 50
                        ? "#10B981"
                        : "#3B82F6",
                  },
                  { value: 100 - occupation.pct, fill: "#F4F4F5" },
                ]}
                startAngle={180}
                endAngle={0}
                innerRadius={55}
                outerRadius={75}
                paddingAngle={0}
                dataKey="value"
                strokeWidth={0}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-end pointer-events-none pb-4">
            <span
              className={`text-3xl font-black ${
                occupation.pct >= 80
                  ? "text-red-500"
                  : occupation.pct >= 50
                  ? "text-emerald-600"
                  : "text-blue-500"
              }`}
            >
              {occupation.pct}%
            </span>
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mt-1 ${
                occupation.status === "SOBRECARGA"
                  ? "bg-red-50 text-red-500"
                  : occupation.status === "IDEAL"
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-blue-50 text-blue-500"
              }`}
            >
              {occupation.status}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-zinc-400 text-center mt-2">
          {Math.round(occupation.usedMinutes / 60)}h usadas de{" "}
          {Math.round(occupation.availableMinutes / 60)}h disponíveis
        </p>
      </div>

      {/* Aniversariantes do Mês */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-150 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-pink-500" />
            <h3 className="font-bold text-zinc-900 text-sm">
              Aniversários em {capitalizedMonth}
            </h3>
          </div>
          <span className="text-[10px] text-pink-500 font-bold bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
            {birthdaysThisMonth.length} cliente
            {birthdaysThisMonth.length !== 1 ? "s" : ""}
          </span>
        </div>
        {birthdaysThisMonth.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
            <Gift className="w-8 h-8 mb-2 text-zinc-200" />
            <p className="text-sm">Nenhum aniversário este mês</p>
            <p className="text-[11px] text-zinc-300 mt-1">
              Cadastre as datas de nascimento dos clientes
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-50 max-h-52 overflow-y-auto">
            {birthdaysThisMonth.map((c) => {
              const phone = c.phone?.replace(/\D/g, "");
              const msg = encodeURIComponent(
                `Parabéns, ${
                  c.name.split(" ")[0]
                }! 🎂 A equipe da barbearia deseja um feliz aniversário!`
              );
              return (
                <div
                  key={c.id}
                  className="px-5 py-3 flex items-center gap-4 hover:bg-zinc-50/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-pink-500">{c.day}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{c.name}</p>
                    <p className="text-[10px] text-zinc-400">
                      Dia {c.day} de {currentMonthName}
                    </p>
                  </div>
                  {phone && (
                    <a
                      href={`https://wa.me/55${phone}?text=${msg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-600 text-[11px] font-bold hover:bg-green-100 transition-colors border border-green-100 shrink-0"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Felicitar
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
