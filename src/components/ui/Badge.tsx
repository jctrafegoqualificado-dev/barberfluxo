import { cn, STATUS_COLORS, STATUS_LABELS } from "@/lib/utils";

interface BadgeProps {
  status: string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[status] || "bg-zinc-100 text-zinc-700", className)}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
