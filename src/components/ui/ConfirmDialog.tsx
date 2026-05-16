"use client";
import { AlertTriangle, Info, CheckCircle2, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: "danger" | "info" | "success";
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  type = "danger",
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar"
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const config = {
    danger: {
      icon: AlertTriangle,
      iconColor: "text-red-500",
      bgColor: "bg-red-50",
      btnColor: "text-red-600 hover:bg-red-50",
    },
    info: {
      icon: Info,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50",
      btnColor: "text-blue-600 hover:bg-blue-50",
    },
    success: {
      icon: CheckCircle2,
      iconColor: "text-green-500",
      bgColor: "bg-green-50",
      btnColor: "text-green-600 hover:bg-green-50",
    }
  };

  const { icon: Icon, iconColor, bgColor, btnColor } = config[type];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border border-zinc-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className={`w-12 h-12 ${bgColor} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          <h3 className="text-lg font-bold text-zinc-900 mb-2">{title}</h3>
          <p className="text-sm text-zinc-500 leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-zinc-100">
          <button 
            onClick={onCancel} 
            className="flex-1 px-4 py-4 text-sm font-semibold text-zinc-500 hover:bg-zinc-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button 
            onClick={onConfirm} 
            className={`flex-1 px-4 py-4 text-sm font-bold border-l border-zinc-100 transition-colors ${btnColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertDialog({
  isOpen,
  title,
  message,
  type = "info",
  onClose
}: {
  isOpen: boolean;
  title: string;
  message: string;
  type?: "info" | "danger" | "success";
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden border border-zinc-100 animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-zinc-900 mb-2">{title}</h3>
          <p className="text-sm text-zinc-500 leading-relaxed">{message}</p>
        </div>
        <button 
          onClick={onClose} 
          className="w-full px-4 py-4 text-sm font-bold text-amber-600 hover:bg-zinc-50 border-t border-zinc-100 transition-colors"
        >
          OK
        </button>
      </div>
    </div>
  );
}
