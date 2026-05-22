import { SkeletonKpi } from "@/components/ui/SkeletonCard";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="h-7 w-36 bg-zinc-100 rounded-lg animate-pulse" />
          <div className="h-4 w-24 bg-zinc-100 rounded animate-pulse" />
        </div>
        <div className="h-9 w-64 bg-zinc-100 rounded-xl animate-pulse" />
      </div>

      <div className="h-32 rounded-2xl bg-zinc-100 animate-pulse" />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonKpi key={i} />)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-zinc-100 animate-pulse" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 rounded-2xl bg-zinc-100 animate-pulse" />
        <div className="h-48 rounded-2xl bg-zinc-100 animate-pulse" />
      </div>
    </div>
  );
}
