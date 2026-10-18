import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { nowSP, occupancy, openDaysProgress, periodRange } from "@/lib/ocupacao";

/**
 * Metas do dono. Progresso no fuso de São Paulo, só do que já passou do período:
 * ATENDIMENTOS = comandas fechadas · RECEITA = valor dos serviços fechados (o mesmo número que
 * o Início do barbeiro usa) · ASSINANTES = planos ativos hoje · OCUPACAO = mesma conta da tela
 * de Ocupação (src/lib/ocupacao.ts).
 * "Ritmo": onde a meta deveria estar hoje, contando os dias com a barbearia aberta.
 */

const TIPOS = ["ATENDIMENTOS", "RECEITA", "ASSINANTES", "OCUPACAO"] as const;
const PERIODOS = ["MONTHLY", "WEEKLY"] as const;
const brl = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");
const num = (v: number) => Math.round(v).toLocaleString("pt-BR");
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

function fail(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { today } = nowSP();

    const metas = await prisma.meta.findMany({
      where: { barbershopId, active: true },
      include: { barber: { select: { id: true, nickname: true, user: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    });

    const ranges = { MONTHLY: periodRange("mes", today), WEEKLY: periodRange("semana", today) };
    const [progM, progW] = await Promise.all([
      openDaysProgress(barbershopId, ranges.MONTHLY.start, ranges.MONTHLY.end),
      openDaysProgress(barbershopId, ranges.WEEKLY.start, ranges.WEEKLY.end),
    ]);
    const prog = { MONTHLY: progM, WEEKLY: progW };
    const dayRange = (from: string, to: string) => ({ gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T23:59:59Z") });

    const out = await Promise.all(metas.map(async (m) => {
      const per = m.periodo === "WEEKLY" ? "WEEKLY" : "MONTHLY";
      const { start, end } = ranges[per];
      const p = prog[per];
      const where = { barbershopId, status: "DONE", date: dayRange(start, today), ...(m.barberId ? { barberId: m.barberId } : {}) };
      let atual = 0;
      let extra: string | null = null;
      if (m.tipo === "ATENDIMENTOS") atual = await prisma.appointment.count({ where });
      else if (m.tipo === "RECEITA") atual = (await prisma.appointment.aggregate({ where, _sum: { price: true } }))._sum.price ?? 0;
      else if (m.tipo === "ASSINANTES") {
        const [active, novos] = await Promise.all([
          prisma.subscription.count({ where: { barbershopId, status: "ACTIVE" } }),
          prisma.subscription.count({ where: { barbershopId, status: "ACTIVE", createdAt: { gte: new Date(start + "T03:00:00Z") } } }),
        ]);
        atual = active;
        extra = `+${novos} desde ${ddmm(start)}`;
      } else if (m.tipo === "OCUPACAO") atual = (await occupancy(barbershopId, start, end, m.barberId)).rate ?? 0;

      const alvo = m.valorAlvo;
      const pct = alvo > 0 ? Math.round((atual / alvo) * 100) : 0;
      const expectedPct = p.total > 0 ? Math.round((p.elapsed / p.total) * 100) : 0;
      const cumulative = m.tipo === "ATENDIMENTOS" || m.tipo === "RECEITA";
      const projected = cumulative && p.elapsed > 0 ? (atual / p.elapsed) * p.total : atual;
      const ratio = alvo > 0 ? projected / alvo : 0;
      const status = atual >= alvo ? "done" : ratio >= 1.08 ? "ahead" : ratio >= 1 ? "ok" : ratio >= 0.92 ? "slight" : "behind";

      const falta = Math.max(0, alvo - atual);
      const perDay = p.remaining > 0 ? falta / p.remaining : null;
      const avg = p.elapsed > 0 ? atual / p.elapsed : null;
      let note: string;
      let plan: string;
      if (status === "done") {
        note = `Batida: ${m.tipo === "RECEITA" ? brl(atual) : m.tipo === "OCUPACAO" ? atual + "%" : num(atual)} de ${m.tipo === "RECEITA" ? brl(alvo) : m.tipo === "OCUPACAO" ? alvo + "%" : num(alvo)}`;
        plan = per === "WEEKLY" ? "Meta da semana batida. Na segunda ela começa de novo." : "Meta do mês batida. No dia 1º ela começa de novo.";
      } else if (m.tipo === "ATENDIMENTOS") {
        note = `Faltam ${num(falta)}` + (perDay != null ? ` · ${Math.ceil(perDay)} por dia` : "") + (avg != null ? ` (média: ${num(avg)})` : "");
        plan = perDay != null ? `Precisa de ${Math.ceil(perDay)} atendimentos por dia aberto até ${ddmm(end)}.` + (avg != null ? ` A média até agora é ${num(avg)} por dia.` : "") : `Não há mais dias com a barbearia aberta até ${ddmm(end)}.`;
      } else if (m.tipo === "RECEITA") {
        note = `Faltam ${brl(falta)}` + (perDay != null ? ` · ${brl(perDay)} por dia` : "") + (cumulative && p.elapsed > 0 ? ` · deve fechar em ${brl(projected)}` : "");
        plan = perDay != null ? `Precisa de ${brl(perDay)} por dia aberto até ${ddmm(end)}.` + (avg != null ? ` A média até agora é ${brl(avg)} por dia.` : "") : `Não há mais dias com a barbearia aberta até ${ddmm(end)}.`;
      } else if (m.tipo === "OCUPACAO") {
        note = `${Math.round(falta)} pontos abaixo`;
        plan = "Veja na tela de Ocupação quais horários estão mais vazios e chame clientes para eles.";
      } else {
        note = `${extra} · faltam ${num(falta)}`;
        plan = `Precisa de mais ${num(falta)} assinantes até ${ddmm(end)}. Ofereça o plano para os clientes que vêm todo mês.`;
      }

      return {
        id: m.id, titulo: m.titulo, tipo: m.tipo, periodo: per, valorAlvo: alvo, createdAt: m.createdAt,
        barberId: m.barberId, barberName: m.barber ? m.barber.nickname || m.barber.user.name : null,
        atual, pct, expectedPct: cumulative ? expectedPct : null, status, note, plan,
      };
    }));

    const periodInfo = (per: "MONTHLY" | "WEEKLY") => {
      const { start, end } = ranges[per];
      const totalDays = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
      const day = Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1;
      return { start, end, day, totalDays, openTotal: prog[per].total, openRemaining: Math.ceil(prog[per].remaining) };
    };

    const res = NextResponse.json({ today, month: periodInfo("MONTHLY"), week: periodInfo("WEEKLY"), metas: out, updatedAt: new Date().toISOString() });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { titulo, tipo, periodo, valorAlvo, barberId } = await req.json();
    const alvo = Number(valorAlvo);
    if (!TIPOS.includes(tipo) || !PERIODOS.includes(periodo)) return NextResponse.json({ error: "Escolha o que medir e o período" }, { status: 400 });
    if (!Number.isFinite(alvo) || alvo <= 0) return NextResponse.json({ error: "Informe um valor maior que zero" }, { status: 400 });
    if (tipo === "OCUPACAO" && alvo > 100) return NextResponse.json({ error: "Ocupação vai até 100%" }, { status: 400 });
    if (barberId) {
      const ok = await prisma.barber.findFirst({ where: { id: barberId, barbershopId }, select: { id: true } });
      if (!ok) return NextResponse.json({ error: "Profissional não encontrado" }, { status: 400 });
    }
    const name = typeof titulo === "string" && titulo.trim() ? titulo.trim().slice(0, 80) : null;
    if (!name) return NextResponse.json({ error: "Dê um nome para a meta" }, { status: 400 });

    const meta = await prisma.meta.create({
      data: { titulo: name, tipo, periodo, valorAlvo: alvo, barbershopId, barberId: barberId || null },
    });
    return NextResponse.json({ meta }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
