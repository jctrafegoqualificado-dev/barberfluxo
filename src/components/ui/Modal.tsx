"use client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

// Visual do redesign: superfície branca, raio 18px. No celular sobe de baixo (folha).
export function Modal({ open, onClose, title, description, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative bg-surface w-full sm:max-w-md sm:mx-4 rounded-t-[18px] sm:rounded-[18px] p-5 sm:p-6 max-h-[90vh] overflow-y-auto",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          {(title || description) && (
            <div>
              {title && <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>}
              {description && <p className="text-[13px] text-ink-3 mt-0.5">{description}</p>}
            </div>
          )}
          <button onClick={onClose} aria-label="Fechar" className="ml-auto -mr-1 -mt-1 w-9 h-9 inline-flex items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
