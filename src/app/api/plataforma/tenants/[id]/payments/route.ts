import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

const VALID_METHODS = ["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH", "BOLETO", "TRANSFER"];
const VALID_STATUSES = ["PAID", "PENDING", "FAILED", "REFUNDED"];
const VALID_PLANS = ["BASIC", "PRO", "ELITE", "PREMIUM"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requirePlatformAdmin(req);
    const { id: shopId } = await params;
    const body = await req.json();
    const { amount, method, status = "PAID", notes, activatePlan } = body;

    // Validação de input — valores arbitrários quebram as métricas (filter por status === "PAID")
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Valor deve ser um número positivo" }, { status: 400 });
    }
    if (!method || !VALID_METHODS.includes(method)) {
      return NextResponse.json({ error: `Método inválido. Use: ${VALID_METHODS.join(", ")}` }, { status: 400 });
    }
    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: `Status inválido. Use: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
    }
    if (activatePlan !== undefined && !VALID_PLANS.includes(activatePlan)) {
      return NextResponse.json({ error: `Plano inválido. Use: ${VALID_PLANS.join(", ")}` }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { id: shopId } });
    if (!shop) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    // Pagamento + ativação numa única transação — evita pagamento sem ativação
    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          amount: amountNum,
          method,
          status,
          paidAt: status === "PAID" ? new Date() : null,
          barbershopId: shopId,
          ...(notes ? { externalId: `manual|${notes}` } : {}), // armazena nota no externalId com prefixo
        },
      });

      // Se o pagamento foi confirmado (PAID) → ativa o plano automaticamente
      if (status === "PAID") {
        const planUpdate: Record<string, any> = { saasStatus: "ACTIVE" };
        if (activatePlan) planUpdate.saasPlan = activatePlan;
        await tx.barbershop.update({ where: { id: shopId }, data: planUpdate });
      }

      return created;
    });

    void logAudit({
      barbershopId: shopId,
      userId: payload.id,
      userEmail: payload.email,
      userRole: payload.role,
      action: "MANUAL_PAYMENT",
      entity: "Payment",
      entityId: payment.id,
      diff: { after: { amount: amountNum, method, status, activatePlan: activatePlan ?? null } },
      ip: getClientIp(req),
    });

    return NextResponse.json({ payment });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
