"use client";
import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: number;
  change: number | null;
  prevValue?: number;
  isCurrency?: boolean;
  icon: React.ElementType;
  color: string;
}

export function KpiCard({
  title,
  value,
  change,
  prevValue,
  isCurrency,
  icon: Icon,
  color,
}: KpiCardProps) {
  const positive = change !== null && change >= 0;
  const formatVal = (v: number) =>
    isCurrency ? formatCurrency(v) : v.toLocaleString("pt-BR");

  return (
    <div className="bg-white rounded-2xl border border-zinc-150 shadow-sm p-5 hover:shadow-md transition-all hover:-translate-y-0.5 group">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {change !== null ? (
          <div
            className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full transition-all ${
              positive
                ? "bg-green-50 text-green-600 border border-green-100"
                : "bg-red-50 text-red-500 border border-red-100"
            }`}
          >
            {positive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            {positive ? "+" : ""}
            {change}%
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-zinc-50 text-zinc-400 border border-zinc-100">
            <span>Novo período</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-black text-zinc-900 tracking-tight">
        {formatVal(value)}
      </p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-zinc-500 font-medium">{title}</p>
        {prevValue !== undefined && prevValue > 0 && (
          <p className="text-[10px] text-zinc-400">
            vs <span className="font-bold text-zinc-500">{formatVal(prevValue)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
