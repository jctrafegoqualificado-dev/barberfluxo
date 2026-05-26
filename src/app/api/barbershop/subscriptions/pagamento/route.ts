import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { addMonths } from "date-fns";
import { decrypt } from "@/lib/encrypt";
import { pauseMpPreapproval } from "@/lib/mercadopago";

function clampDay(day: number, year: number, month: number): number {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

function advanceBillingDate(current: Date, billingDay: number | null): Date {
  const next = addMonths(current, 1);
  if (!billingDay) return next;
  return new Date(next.getFullYear(), next.getMonth(), clampDay(billingDay, next.getFullYear(), next.getMonth()));
}

function revertBillingDate(current: Date, billingDay: number | null): Date {
  const prev = addMonths(current, -1);
  if (!billingDay) return prev;
  return new Date(prev.getFullYear(), prev.getMonth(), clampDay(billingDay, prev.getFullYear(), prev.getMonth()));
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { subscriptionId, method } = await req.json();

    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, barbershopId },
      include: { plan: true },
    });
    if (!sub) return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });

    // ── Proteção contra dupla cobrança (Sprint MP) ──────────────────────────
    // Se a assinatura tem débito automático MP ativo, pausar antes de confirmar
    // pagamento manual — evita que o MP também cobre esse mesmo ciclo.
    const authStatus     = (sub as any).authorizationStatus as string;
    const mpPreapprovalId = (sub as any).mpPreapprovalId   as string | null;

    if (authStatus === "AUTHORIZED" && mpPreapprovalId) {
      try {
        const gatewayConfig = await (prisma as any).paymentGatewayConfig.findUnique({
          where:  { barbershopId },
          select: { accessToken: true, active: true },
        });
        if (gatewayConfig?.active) {
          const token = decrypt(gatewayConfig.accessToken);
          await pauseMpPreapproval(mpPreapprovalId, token);
          // Marca como PAUSED — dono decide depois se quer retomar o débito automático
          await prisma.subscription.update({
            where: { id: subscriptionId },
            data:  { authorizationStatus: "PAUSED" } as any,
          });
        }
      } catch (mpErr) {
        // Falha no MP não impede o registro manual — apenas loga
        console.error("[pagamento] Falha ao pausar preapproval MP:", mpErr);
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    // Busca cobrança pendente mais antiga
    const pendingPayment = await prisma.payment.findFirst({
      where: { subscriptionId, status: "PENDING" },
      orderBy: { createdAt: "asc" }
    });

    if (pendingPayment) {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: {
          method: method ?? "CASH",
          status: "PAID",
          paidAt: new Date()
        }
      });
    } else {
      // Cria novo pagamento se não houver pendência
      await prisma.payment.create({
        data: {
          amount: sub.plan.price,
          method: method ?? "CASH",
          status: "PAID",
          paidAt: new Date(),
          subscriptionId,
          barbershopId, // Adicionando barbershopId já que a tabela Payment suporta
        },
      });
    }

    // Avança próxima cobrança + reseta usos do ciclo
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        nextBillingDate: advanceBillingDate(new Date(sub.nextBillingDate), (sub as any).billingDay ?? null),
        usesThisCycle: 0,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const subscriptionId = searchParams.get("subscriptionId");

    if (!subscriptionId) return NextResponse.json({ error: "Assinatura não fornecida" }, { status: 400 });

    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, barbershopId },
      include: { payments: { orderBy: { createdAt: "desc" } } }
    });
    if (!sub) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    const latestPayment = sub.payments.find(p => p.status === "PAID");
    if (!latestPayment) return NextResponse.json({ error: "Nenhum pagamento confirmado encontrado para desfazer" }, { status: 400 });

    await prisma.$transaction([
      prisma.payment.delete({ where: { id: latestPayment.id } }),
      prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          nextBillingDate: revertBillingDate(new Date(sub.nextBillingDate), (sub as any).billingDay ?? null),
        }
      })
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao desfazer pagamento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
