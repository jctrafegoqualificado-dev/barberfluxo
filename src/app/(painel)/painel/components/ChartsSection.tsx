"use client";
import React from "react";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface ChartsSectionProps {
  dailyRevenue: Array<{ date: string; revenue: number }>;
  appointmentStatus: {
    DONE: number;
    PENDING: number;
    CANCELLED: number;
    NO_SHOW: number;
  };
}

export function ChartsSection({
  dailyRevenue,
  appointmentStatus,
}: ChartsSectionProps) {
  const donutData = [
    { name: "Finalizados", value: appointmentStatus.DONE, color: "#10B981" },
    { name: "Pendentes", value: appointmentStatus.PENDING, color: "#3B82F6" },
    { name: "Cancelados", value: appointmentStatus.CANCELLED, color: "#EF4444" },
    { name: "No-Show", value: appointmentStatus.NO_SHOW, color: "#F59E0B" },
  ];
  const totalAppointments = donutData.reduce((a, b) => a + b.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Faturamento Diário (Bar Chart) */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-150 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-zinc-900 text-sm">Faturamento Diário</h3>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyRevenue} barCategoryGap="30%">
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#A1A1AA" }}
                axisLine={false}
                tickLine={false}
                interval={Math.ceil(dailyRevenue.length / 10)}
              />
              <YAxis
                tickFormatter={(val) => `R$${val}`}
                tick={{ fontSize: 10, fill: "#A1A1AA" }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <RechartsTooltip
                formatter={(val: number) => [formatCurrency(val), "Faturamento"]}
                labelFormatter={(label) => `📅 ${label}`}
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #F3F4F6",
                  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                  padding: "8px 12px",
                }}
                labelStyle={{
                  fontWeight: "700",
                  color: "#18181B",
                  marginBottom: "2px",
                }}
                itemStyle={{ color: "#F59E0B", fontWeight: "600" }}
                cursor={{ fill: "#FEF3C7", radius: 4 }}
              />
              <Bar
                dataKey="revenue"
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status dos Agendamentos (Donut Chart) */}
      <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <PieChartIcon className="w-4 h-4 text-blue-500" />
          <h3 className="font-bold text-zinc-900 text-sm">Status dos Agendamentos</h3>
        </div>
        <div className="h-44 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                innerRadius={52}
                outerRadius={72}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
              >
                {donutData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(val: number, name: string) => [val, name]}
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #F3F4F6",
                  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
                  padding: "6px 10px",
                }}
                itemStyle={{ fontWeight: "600", fontSize: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-zinc-900">
              {totalAppointments}
            </span>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
              Total
            </span>
          </div>
        </div>
        {/* Legenda */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 pt-3 border-t border-zinc-100">
          {donutData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[10px] text-zinc-500 font-medium truncate">
                {item.name}
              </span>
              <span className="text-[10px] font-black text-zinc-800 ml-auto">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
