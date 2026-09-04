import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { onlyDigits, phoneVariants } from "@/lib/phone";

/**
 * GET /api/v1/barbershops/{slug}/subscriber?phone=...
 *
 * Situação de assinatura do cliente na barbearia — a versão autenticada da rota
 * pública usada pela página de agendamento. É esta que integrações (n8n/bot)
 * devem consumir: a pública é enxuta de propósito e tem cota apertada para
 * requisições que não vêm do navegador.
 *
 * Autenticação: header `x-api-key` validado pelo middleware (PUBLIC_API_KEY).
 *
 * Sempre responde 200: `isSubscriber: false` para quem não tem assinatura ativa,
 * para o bot não precisar tratar 404 como erro.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const phone = req.nextUrl.searchParams.get("phone");
    if (!phone) {
      return NextResponse.json({ error: "Parâmetro phone obrigatório" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({
      where: { slug },
      select: { id: true, active: true },
    });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const cleanPhone = onlyDigits(phone);
    const notSubscriber = NextResponse.json({ isSubscriber: false, subscription: null });

    // Casa variações do mesmo número (com/sem DDI 55, com/sem 9º dígito) e os
    // domínios de e-mail sintético usados historicamente no cadastro por telefone
    const user = await prisma.user.findFirst({
      where: {
        role: "CLIENT",
        OR: [
          { phone: { in: phoneVariants(phone) } },
          { email: `${cleanPhone}@cliente.iadebarbearia.com` },
          { email: `${cleanPhone}@cliente.barberfluxo` },
          { email: `${cleanPhone}@cliente.barberfluxo.com` },
          { email: `${cleanPhone}@cliente.barberapp` },
        ],
      },
      select: { id: true, name: true },
    });
    if (!user) return notSubscriber;

    const sub = await prisma.subscription.findFirst({
      where: { clientId: user.id, barbershopId: shop.id, status: "ACTIVE" },
      select: {
        id: true,
        status: true,
        usesThisCycle: true,
        nextBillingDate: true,
        beneficiaries: true,
        plan: {
          select: {
            id: true,
            name: true,
            price: true,
            billingCycle: true,
            maxUses: true,
            extraDiscount: true,
            planServices: {
              select: {
                quantity: true,
                service: { select: { id: true, name: true, price: true, duration: true } },
              },
            },
            allowedBarbers: { select: { id: true, user: { select: { name: true } } } },
          },
        },
      },
    });
    if (!sub) return notSubscriber;

    return NextResponse.json({
      isSubscriber: true,
      clientName: user.name,
      subscription: {
        id: sub.id,
        status: sub.status,
        nextBillingDate: sub.nextBillingDate.toISOString().slice(0, 10),
        usesThisCycle: sub.usesThisCycle,
        // null quando o plano é ilimitado
        maxUses: sub.plan.maxUses,
        remainingUses: sub.plan.maxUses != null
          ? Math.max(0, sub.plan.maxUses - sub.usesThisCycle)
          : null,
        // Controle de uso por dependente, quando o plano tem beneficiários
        beneficiaries: sub.beneficiaries,
        plan: {
          id: sub.plan.id,
          name: sub.plan.name,
          price: sub.plan.price,
          billingCycle: sub.plan.billingCycle,
          extraDiscount: sub.plan.extraDiscount,
          services: sub.plan.planServices.map((ps) => ({
            id: ps.service.id,
            name: ps.service.name,
            price: ps.service.price,
            duration: ps.service.duration,
            quantity: ps.quantity,
          })),
          // Lista vazia = qualquer barbeiro atende pelo plano
          allowedBarbers: sub.plan.allowedBarbers.map((b) => ({ id: b.id, name: b.user.name })),
        },
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
