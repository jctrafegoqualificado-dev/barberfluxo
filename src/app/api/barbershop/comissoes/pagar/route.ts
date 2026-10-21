import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { currentMonthSP } from "@/lib/monthResult";

const MONTH = /^\d{4}-\d{2}$/;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// POST — registrar um pagamento de comissão
// - STANDARD (avulsos, produtos e gorjetas): pago por semana, pode ter vários no mesmo mês.
// - SUBSCRIPTION (pote das assinaturas): só depois que o mês fecha.
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]); // só o dono marca comissão como paga
    if (!payload.barbershopId) return NextResponse.json({ error: "Sem barbearia" }, { status: 403 });

    const { barberId, month, amount, type = "STANDARD", notes } = await req.json();

    if (typeof month !== "string" || !MONTH.test(month)) {
      return NextResponse.json({ error: "Pagamentos são lançados no mês. Saia do período personalizado para pagar." }, { status: 400 });
    }
    if (type !== "STANDARD" && type !== "SUBSCRIPTION") {
      return NextResponse.json({ error: "Tipo de pagamento inválido" }, { status: 400 });
    }
    const value = Math.round(Number(amount) * 100) / 100;
    if (!(value > 0)) return NextResponse.json({ error: "Informe um valor maior que zero." }, { status: 400 });
    if (type === "SUBSCRIPTION" && month >= currentMonthSP()) {
      const m = Number(month.slice(5, 7));
      return NextResponse.json({ error: `As assinaturas de ${MONTHS[m - 1]} só são pagas depois que o mês fechar.` }, { status: 400 });
    }

    // Valida que o barbeiro pertence a esta barbearia antes de registrar pagamento (CVE-9)
    const barberOwned = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: payload.barbershopId },
      select: { id: true },
    });
    if (!barberOwned) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }

    // Clique duplo: o mesmo pagamento enviado de novo em poucos segundos não entra duas vezes
    const justPaid = await prisma.commissionPayment.findFirst({
      where: { barberId, month, type, amount: value, paidAt: { gte: new Date(Date.now() - 10_000) } },
    });
    if (justPaid) return NextResponse.json({ payment: justPaid });

    const payment = await prisma.commissionPayment.create({
      data: {
        barberId, month, type, amount: value, barbershopId: payload.barbershopId,
        notes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 120) : null,
      },
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// DELETE — desfazer um pagamento (pelo id; sem id, desfaz todos do mês e tipo, como antes)
export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    if (!payload.barbershopId) return NextResponse.json({ error: "Sem barbearia" }, { status: 403 });

    const { id, barberId, month, type = "STANDARD" } = await req.json();

    const where = id
      ? { id: String(id), barbershopId: payload.barbershopId }
      : { barberId, month, type, barbershopId: payload.barbershopId };
    const { count } = await prisma.commissionPayment.deleteMany({ where });
    if (count === 0) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
