"use client";
import { cn, getInitials } from "@/lib/utils";

/** *negrito* como no WhatsApp. */
function wa(text: string) {
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    /^\*[^*\n]+\*$/.test(part) ? <strong key={i} className="font-semibold">{part.slice(1, -1)}</strong> : part);
}

export interface Bubble { from: "client" | "shop"; text: string }

/** Celular com uma conversa de exemplo (prévias do Atendente de IA e dos Lembretes). */
export default function PhonePreview({ name, status = "online", bubbles }: { name: string; status?: string; bubbles: Bubble[] }) {
  return (
    <div className="rounded-[28px] bg-night p-2.5">
      <div className="rounded-[20px] overflow-hidden bg-[#EFE9DF] flex flex-col">
        <div className="flex items-center gap-2.5 px-3.5 py-3 bg-white">
          <span className="w-[34px] h-[34px] rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">{getInitials(name)}</span>
          <span className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-[#1B1916] truncate">{name}</span>
            <span className="text-[11px] text-[#1D6B40]">{status}</span>
          </span>
        </div>
        <div className="flex flex-col gap-2 px-3 pt-4 pb-5 text-sm leading-[1.45] text-[#1B1916]">
          {bubbles.map((b, i) => (
            <span key={i} className={cn("max-w-[84%] px-3 py-2 whitespace-pre-line shadow-sm",
              b.from === "client" ? "self-end bg-[#DCF7C5] rounded-[12px_12px_3px_12px]" : "self-start bg-white rounded-[12px_12px_12px_3px]")}>
              {wa(b.text)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
