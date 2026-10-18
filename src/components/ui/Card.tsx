import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

// Visual do redesign: superfície branca, borda #E7E2D8, raio 14px, sem sombra.
// `highlight` = card de destaque (raio 18px), como a previsão do dia no Início.
export function Card({ className, children, highlight, ...props }: HTMLAttributes<HTMLDivElement> & { highlight?: boolean }) {
  return (
    <div
      className={cn(
        "bg-surface border border-line p-5",
        highlight ? "rounded-[18px]" : "rounded-[14px]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 flex items-start justify-between gap-3", className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-[17px] font-semibold text-ink", className)} {...props}>{children}</h3>;
}

export function CardDescription({ className, children, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] text-ink-3 mt-0.5", className)} {...props}>{children}</p>;
}
