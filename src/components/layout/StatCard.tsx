import { cn, formatCurrency } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  isCurrency?: boolean;
}

export function StatCard({ title, value, icon: Icon, color = "amber", isCurrency }: StatCardProps) {
  const colors: Record<string, string> = {
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-zinc-500">{title}</p>
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colors[color] || colors.amber)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-zinc-900">
        {isCurrency ? formatCurrency(Number(value)) : value}
      </p>
    </div>
  );
}
