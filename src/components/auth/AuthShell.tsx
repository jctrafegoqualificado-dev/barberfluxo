"use client";
import { useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Check, Eye, EyeOff, Scissors } from "lucide-react";

const POINTS = [
  "Agenda em tempo real, no computador e no celular",
  "Comissões e vales calculados sozinhos",
  "Caixa do dia e resultado do mês",
  "Atendente de IA marcando horário no WhatsApp",
];

function Logo({ dark }: { dark?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-3 w-fit">
      <span className="w-10 h-10 rounded-[10px] bg-primary text-white flex items-center justify-center"><Scissors className="w-5 h-5" aria-hidden /></span>
      <span className={`font-display text-lg sm:text-xl font-bold whitespace-nowrap ${dark ? "text-white" : "text-ink"}`}>IA de Barbearia</span>
    </Link>
  );
}

/** Moldura das telas de acesso (docs/design/Login-desktop.dc.html): marca à esquerda, formulário à direita. */
export default function AuthShell({ children, top }: { children: ReactNode; top?: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-ground text-ink">
      <section aria-label="Sobre o IA de Barbearia" className="hidden lg:flex w-[min(640px,45vw)] shrink-0 flex-col bg-[#1B1916] text-white px-14 py-10">
        <Logo dark />
        <div className="flex-1 flex flex-col justify-center gap-7">
          <h2 className="font-display text-[42px] leading-[1.1] font-bold tracking-[-0.02em] max-w-[500px]">
            A barbearia organizada. O WhatsApp respondendo por você.
          </h2>
          <p className="text-[17px] leading-[1.55] text-[#C9C2B6] max-w-[470px]">
            Agenda, comissões, caixa e clientes num lugar só, com um atendente que marca horário enquanto você está na cadeira.
          </p>
          <ul className="flex flex-col gap-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[15px] text-[#E9E4DA]">
                <span className="w-6 h-6 rounded-full bg-night-3 text-primary flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden /></span>
                {p}
              </li>
            ))}
          </ul>
          <div aria-hidden className="max-w-[440px] rounded-2xl bg-night-2 border border-[#2E2A25] p-4 flex flex-col gap-2 text-sm leading-[1.45]">
            <span className="text-xs font-semibold tracking-[0.06em] uppercase text-[#8A8378]">Atendente de IA · WhatsApp</span>
            <span className="self-end max-w-[80%] px-3 py-2 rounded-[12px_12px_3px_12px] bg-[#2E3B2F] text-[#E9E4DA]">boa tarde, tem horário hoje à tarde pra degradê?</span>
            <span className="self-start max-w-[84%] px-3 py-2 rounded-[12px_12px_12px_3px] bg-[#2E2A25]">Fala, Gustavo! Tem sim: com o Diego às 15:45 ou 16:00. Qual fica melhor?</span>
          </div>
        </div>
        <div className="flex justify-between text-[13px] text-[#8A8378]">
          <span>© IA de Barbearia</span>
          <Link href="/" className="text-[#C9C2B6] font-semibold hover:text-white">Conhecer os planos</Link>
        </div>
      </section>

      <main className="flex-1 min-w-0 flex flex-col px-4 sm:px-10 lg:px-14 py-6 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <span className="lg:hidden"><Logo /></span>
          <div className="ml-auto flex items-center gap-3 text-sm text-ink-2">{top}</div>
        </div>
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </main>
    </div>
  );
}

export const authInputCls =
  "w-full h-[50px] rounded-xl border border-control bg-surface px-3.5 text-base text-ink placeholder:text-ink-4 " +
  "focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink";

export function AuthAlert({ tone = "danger", children }: { tone?: "danger" | "positive"; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"}
      className={`px-3.5 py-3 rounded-xl text-sm ${tone === "danger" ? "bg-danger-soft text-danger" : "bg-positive-soft text-positive"}`}>
      {children}
    </div>
  );
}

/** Senha com "Mostrar / Ocultar". */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);
  return (
    <div className="flex items-center h-[50px] rounded-xl border border-control bg-surface pl-3.5 pr-1 focus-within:border-ink focus-within:ring-1 focus-within:ring-ink">
      <input {...props} type={shown ? "text" : "password"} className="flex-1 min-w-0 bg-transparent outline-none text-base text-ink placeholder:text-ink-4" />
      <button type="button" onClick={() => setShown(!shown)} aria-label={shown ? "Ocultar senha" : "Mostrar senha"} aria-pressed={shown}
        className="h-10 px-2.5 rounded-lg text-[13px] font-semibold text-ink-2 flex items-center gap-1.5 hover:bg-surface-2">
        {shown ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
        {shown ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}
