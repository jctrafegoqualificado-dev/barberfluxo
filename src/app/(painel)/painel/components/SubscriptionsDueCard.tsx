"use client";
import Link from "next/link";
import { Check, MessageCircle } from "lucide-react";
import { formatCurrency, getInitials } from "@/lib/utils";
import type { SubscriptionsDueToday } from "./dashboard-types";
import { firstName, whatsappLink } from "./dashboard-types";

const METHOD_LABEL: Record<string, string> = {
  AUTO: "débito automático",
  PIX: "Pix",
  CASH: "paga no balcão",
  CARD: "cartão",
  CREDIT_CARD: "cartão de crédito",
  DEBIT_CARD: "cartão de débito",
};

const pct = (value: number, total: number) => (total > 0 ? `${(value / total) * 100}%` : "0%");

export function SubscriptionsDueCard({ data }: { data: SubscriptionsDueToday }) {
  const { total, paid, waiting, failed, items, overdue } = data;
  const pending = items.filter((i) => i.status !== "PAID");
  const count = (status: string) => items.filter((i) => i.status === status).length;

  if (items.length === 0 && overdue.count === 0) return null;

  return (
    <section aria-labelledby="subs-due-title" className="bg-white border border-line rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line-2">
        <div>
          <h2 id="subs-due-title" className="text-[15px] font-semibold text-ink">Assinaturas que vencem hoje</h2>
          <p className="text-[13px] text-ink-3">Cobranças dos planos com vencimento hoje</p>
        </div>
        <Link href="/painel/assinaturas" className="text-[13px] font-semibold text-ink-2 underline underline-offset-2">
          Ver todos os assinantes
        </Link>
      </div>

      <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-7">
            <div>
              <p className="text-[13px] text-ink-2">A receber hoje</p>
              <p className="font-display text-[38px] leading-[1.1] font-bold tracking-tight text-ink tabular-nums">
                {formatCurrency(total)}
              </p>
            </div>
            <div className="pb-1">
              <p className="text-[13px] text-ink-2">Já recebido</p>
              <p className="font-display text-2xl font-bold text-positive tabular-nums">{formatCurrency(paid)}</p>
            </div>
          </div>

          {total > 0 && (
            <div className="flex h-3.5 gap-0.5 rounded-full overflow-hidden" aria-hidden="true">
              <div className="bg-positive-strong" style={{ width: pct(paid, total) }} />
              <div className="bg-bar-soft" style={{ width: pct(waiting, total) }} />
              <div className="bg-danger-strong" style={{ width: pct(failed, total) }} />
            </div>
          )}

          <div className="flex flex-col">
            {[
              { label: "Pagas", n: count("PAID"), value: paid, swatch: "bg-positive-strong" },
              { label: "Aguardando pagamento", n: count("WAITING"), value: waiting, swatch: "bg-bar-soft" },
              { label: "Cobrança recusada", n: count("FAILED"), value: failed, swatch: "bg-danger-strong" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-2.5 min-h-9 border-t border-line-3">
                <span className={`w-2.5 h-2.5 rounded-[3px] ${r.swatch}`} />
                <span className="flex-1 text-sm text-ink">
                  {r.label} <span className="text-ink-3">· {r.n}</span>
                </span>
                <span className="text-sm font-semibold text-ink tabular-nums">{formatCurrency(r.value)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            {pending.length > 0 && (
              <Link
                href="/painel/assinaturas"
                className="flex items-center gap-2 h-10 px-3.5 rounded-[9px] bg-ink text-white text-[13px] font-semibold hover:bg-ink/90"
              >
                <MessageCircle className="w-4 h-4" />
                Cobrar {pending.length === 1 ? "a pendente" : `as ${pending.length} pendentes`}
              </Link>
            )}
            {overdue.count > 0 && (
              <Link href="/painel/assinaturas" className="text-[13px] font-semibold text-danger">
                + {overdue.count} vencida{overdue.count !== 1 ? "s" : ""} antes · {formatCurrency(overdue.total)}
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:pl-8 lg:border-l border-line-2 min-w-0">
          <span className="text-sm font-semibold text-ink">Assinantes</span>
          {items.length === 0 ? (
            <p className="py-6 text-sm text-ink-3">Nenhuma assinatura vence hoje.</p>
          ) : (
            <div className="grid gap-x-6 sm:grid-cols-2">
              {items.map((s) => {
                const link =
                  s.status !== "PAID"
                    ? whatsappLink(
                        s.clientPhone,
                        s.status === "FAILED"
                          ? `Olá, ${firstName(s.clientName)}! A cobrança do seu plano ${s.planName} não passou no cartão. Posso te mandar um novo link de pagamento?`
                          : `Olá, ${firstName(s.clientName)}! Hoje vence o seu plano ${s.planName} (${formatCurrency(s.amount)}). Quer que eu mande a chave Pix?`
                      )
                    : null;
                const note =
                  s.status === "FAILED" ? "cartão recusado" : s.status === "PAID" ? METHOD_LABEL[s.method ?? ""] ?? "pago" : METHOD_LABEL[s.method ?? ""] ?? "aguardando";
                return (
                  <div key={`${s.id}-${s.status}`} className="flex items-center gap-3 py-3 border-t border-line-3 min-h-11">
                    <div className="w-[34px] h-[34px] rounded-full bg-line-2 text-ink-2 text-xs font-bold flex items-center justify-center shrink-0">
                      {getInitials(s.clientName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{s.clientName}</p>
                      <p className="text-xs text-ink-3 truncate">
                        {s.planName} · {formatCurrency(s.amount)}
                      </p>
                      <p
                        className={`text-xs ${
                          s.status === "FAILED" ? "font-semibold text-danger" : s.status === "WAITING" ? "font-semibold text-warning" : "text-ink-3"
                        }`}
                      >
                        {note}
                      </p>
                    </div>
                    {s.status === "PAID" ? (
                      <span className="flex items-center gap-1 h-6 px-2 rounded-full bg-positive-soft text-positive text-[11px] font-semibold">
                        <Check className="w-3 h-3" />
                        Pago
                      </span>
                    ) : link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${s.status === "FAILED" ? "Enviar novo link para" : "Cobrar"} ${s.clientName} pelo WhatsApp`}
                        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-line text-xs font-semibold text-ink hover:bg-ground shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {s.status === "FAILED" ? "Novo link" : "Cobrar"}
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
