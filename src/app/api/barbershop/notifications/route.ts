import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const notifications: { id: string; type: string; severity: string; title: string; message: string; link: string }[] = [];

    // Assinaturas com cobrança vencida (nextBillingDate <= hoje e ainda ACTIVE)
    const overdueSubscriptions = await prisma.subscription.findMany({
      where: {
        barbershopId,
        status: "ACTIVE",
        nextBillingDate: { lte: today },
      },
      include: {
        client: { select: { name: true } },
        plan: { select: { name: true, price: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    for (const sub of overdueSubscriptions) {
      const lastPayment = sub.payments[0];
      const alreadyPaid = lastPayment?.status === "PAID" &&
        new Date(lastPayment.createdAt ?? 0) >= new Date(sub.nextBillingDate);

      if (!alreadyPaid) {
        const daysOverdue = Math.floor((Date.now() - new Date(sub.nextBillingDate).getTime()) / 86400000);
        notifications.push({
          id: `sub-${sub.id}`,
          type: "SUBSCRIPTION_DUE",
          severity: daysOverdue > 3 ? "high" : "medium",
          title: `Assinatura vencida — ${sub.client.name}`,
          message: `${sub.plan.name} · R$${sub.plan.price.toFixed(2).replace(".", ",")} · venceu há ${daysOverdue === 0 ? "hoje" : `${daysOverdue} dia${daysOverdue > 1 ? "s" : ""}`}`,
          link: "/painel/assinaturas",
        });
      }
    }

    // Produtos com estoque baixo (≤ 5 unidades)
    const lowStockProducts = await prisma.product.findMany({
      where: { barbershopId, active: true, stock: { lte: 5 } },
      select: { id: true, name: true, stock: true },
    });

    for (const p of lowStockProducts) {
      notifications.push({
        id: `stock-${p.id}`,
        type: "LOW_STOCK",
        severity: p.stock === 0 ? "high" : "medium",
        title: `Estoque baixo — ${p.name}`,
        message: p.stock === 0 ? "Produto sem estoque" : `Apenas ${p.stock} unidade${p.stock > 1 ? "s" : ""} restante${p.stock > 1 ? "s" : ""}`,
        link: "/painel/produtos",
      });
    }

    // Ordena: high primeiro
    notifications.sort((a, b) => (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1));

    return NextResponse.json({ notifications, count: notifications.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
