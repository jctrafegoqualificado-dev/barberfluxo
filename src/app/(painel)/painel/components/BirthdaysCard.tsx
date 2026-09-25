"use client";
import { MessageCircle } from "lucide-react";
import type { DashboardData } from "./dashboard-types";
import { firstName, whatsappLink } from "./dashboard-types";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function BirthdaysCard({ birthdays, today }: { birthdays: DashboardData["birthdaysThisMonth"]; today: Date }) {
  const month = MONTHS[today.getMonth()];
  const upcoming = birthdays.filter((b) => b.day >= today.getDate());

  return (
    <section aria-labelledby="birthdays-title" className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="birthdays-title" className="text-[15px] font-semibold text-ink">Aniversariantes do mês</h2>
        <span className="text-[13px] text-ink-3">
          {upcoming.length > 0 ? `${upcoming.length} ainda este mês` : `${birthdays.length} no mês`}
        </span>
      </div>

      {birthdays.length === 0 ? (
        <p className="text-sm text-ink-3">Nenhum aniversário este mês. Cadastre a data de nascimento na ficha dos clientes.</p>
      ) : (
        <ul className="flex flex-col gap-3 max-h-72 overflow-y-auto">
          {(upcoming.length > 0 ? upcoming : birthdays).map((c) => {
            const link = whatsappLink(
              c.phone,
              `Parabéns, ${firstName(c.name)}! A equipe da barbearia deseja um feliz aniversário!`
            );
            return (
              <li key={c.id} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-[10px] bg-ground flex flex-col items-center justify-center shrink-0">
                  <span className="text-[15px] font-bold leading-none text-ink tabular-nums">{c.day}</span>
                  <span className="text-[10px] font-semibold uppercase text-ink-3">{month}</span>
                </div>
                <p className="flex-1 min-w-0 text-sm font-semibold text-ink truncate">{c.name}</p>
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Enviar parabéns para ${c.name} pelo WhatsApp`}
                    className="w-10 h-10 rounded-[9px] border border-line flex items-center justify-center text-ink hover:bg-ground shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
