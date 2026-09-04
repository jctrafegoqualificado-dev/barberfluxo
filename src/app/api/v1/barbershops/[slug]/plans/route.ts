import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/barbershops/{slug}/plans
 *
 * Planos de assinatura da barbearia, com preço e serviços inclusos — o catálogo
 * que o assistente precisa para responder "quanto custa o plano?" e "o que vem
 * incluído?".
 *
 * Note que não existe um cadastro separado de "serviços de assinatura": são os
 * mesmos Service de /services, e o que os torna parte de um plano é o vínculo
 * PlanService, que carrega a quantidade de usos por ciclo (null = ilimitado).
 *
 * Autenticação: header `x-api-key` validado pelo middleware (PUBLIC_API_KEY).
 * Campos internos (comissão do barbeiro, contagem de assinantes) ficam de fora.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const shop = await prisma.barbershop.findUnique({
      where: { slug },
      select: { id: true, active: true },
    });
    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const plans = await prisma.plan.findMany({
      where: { barbershopId: shop.id, active: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        billingCycle: true,
        maxUses: true,
        extraDiscount: true,
        beneficiaryRules: true,
        planServices: {
          select: {
            quantity: true,
            service: { select: { id: true, name: true, price: true, duration: true } },
          },
        },
        allowedBarbers: { select: { id: true, user: { select: { name: true } } } },
      },
      orderBy: { price: "asc" },
    });

    return NextResponse.json({
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        billingCycle: p.billingCycle,
        // null = uso ilimitado no ciclo
        maxUses: p.maxUses,
        // % de desconto automático em serviços fora do plano (0 = sem desconto)
        extraDiscount: p.extraDiscount,
        // Regras de dependentes, quando o plano permite (ex.: titular + filho)
        beneficiaryRules: p.beneficiaryRules,
        services: p.planServices.map((ps) => ({
          id: ps.service.id,
          name: ps.service.name,
          // Preço avulso do serviço — útil para o assistente comparar com o plano
          price: ps.service.price,
          duration: ps.service.duration,
          // null = quantas vezes quiser dentro do ciclo
          quantity: ps.quantity,
        })),
        // Lista vazia = plano atendido por qualquer barbeiro
        allowedBarbers: p.allowedBarbers.map((b) => ({ id: b.id, name: b.user.name })),
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
