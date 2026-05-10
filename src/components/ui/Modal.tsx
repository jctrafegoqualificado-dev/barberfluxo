"use client";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn("relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto", className)}>
        <div className="flex items-center justify-between mb-4">
          {title && <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>}
          <button onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-zinc-100">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
