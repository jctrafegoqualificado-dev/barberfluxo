"use client";

export function SkeletonLine({ w = "w-full", h = "h-4" }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} bg-zinc-200 rounded animate-pulse`} />;
}

export function SkeletonCard({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-zinc-100 shadow-sm p-5 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-200 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <SkeletonLine w="w-1/2" h="h-4" />
          <SkeletonLine w="w-1/3" h="h-3" />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonLine key={i} w={i % 2 === 0 ? "w-full" : "w-3/4"} h="h-3" />
      ))}
    </div>
  );
}

export function SkeletonKpi({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-zinc-100 shadow-sm p-5 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <SkeletonLine w="w-1/3" h="h-4" />
        <div className="w-8 h-8 rounded-lg bg-zinc-200 animate-pulse" />
      </div>
      <SkeletonLine w="w-1/2" h="h-8" />
      <SkeletonLine w="w-2/3" h="h-3" />
    </div>
  );
}

export function SkeletonRow({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 border-b border-zinc-50 ${className}`}>
      <div className="w-9 h-9 rounded-full bg-zinc-200 animate-pulse shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonLine w="w-1/3" h="h-4" />
        <SkeletonLine w="w-1/4" h="h-3" />
      </div>
      <SkeletonLine w="w-16" h="h-4" />
    </div>
  );
}
