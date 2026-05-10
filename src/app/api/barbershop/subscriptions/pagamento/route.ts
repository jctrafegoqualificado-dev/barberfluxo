import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addMonths } from "date-fns";

export async function POST(req: NextRequest) {
  try {
    requireAuth(req, ["OWNER"]);
    const { subscriptionId, method } = await req.json();

    const sub = await prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    // Registra pagamento
    await prisma.payment.create({
      data: {
        amount: 0, // será preenchido pelo plano se necessário
        method: method ?? "CASH",
        status: "PAID",
        paidAt: new Date(),
        subscriptionId,
      },
    });

    // Avança próxima cobrança + reseta usos do ciclo
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        nextBillingDate: addMonths(new Date(sub.nextBillingDate), 1),
        usesThisCycle: 0,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
