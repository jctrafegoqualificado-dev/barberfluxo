import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/booking/{slug}/subscriber?phone=...
 *
 * Detecta a assinatura ativa do cliente na página pública de agendamento, para
 * aplicar o benefício do plano. Público por natureza — quem chama é o navegador
 * do cliente, antes de qualquer login. Não é possível exigir API key aqui: a
 * chave teria que ir no bundle JS e abriria todos os endpoints /api/v1/.
 *
 * O retorno traz apenas o que a UI de agendamento consome. Integrações (n8n/bot)
 * devem usar GET /api/v1/barbershops/{slug}/subscriber, protegida por API key,
 * que devolve os dados completos de uso do plano.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const email = req.nextUrl.searchParams.get("email");
  const phone = req.nextUrl.searchParams.get("phone");
  if (!email && !phone) return NextResponse.json({ subscriptionId: null });

  // Telefone BR completo (>= 10 dígitos) — prefixos curtos barateiam varredura
  const cleanPhone = phone ? phone.replace(/\D/g, "") : null;
  if (!email && (!cleanPhone || cleanPhone.length < 10)) {
    return NextResponse.json({ subscriptionId: null });
  }

  const shop = await prisma.barbershop.findUnique({ where: { slug }, select: { id: true } });
  if (!shop) return NextResponse.json({ subscriptionId: null });

  // Busca compatível com e-mail direto OU com múltiplos domínios sintéticos históricos
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst({
        where: {
          role: "CLIENT",
          OR: [
            { phone: cleanPhone! },
            { email: `${cleanPhone}@cliente.iadebarbearia.com` },
            { email: `${cleanPhone}@cliente.barberfluxo` },
            { email: `${cleanPhone}@cliente.barberfluxo.com` },
            { email: `${cleanPhone}@cliente.barberapp` },
          ],
        },
      });
  if (!user) return NextResponse.json({ subscriptionId: null });

  const sub = await prisma.subscription.findFirst({
    where: { clientId: user.id, barbershopId: shop.id, status: "ACTIVE" },
    include: { plan: { select: { name: true, allowedBarbers: { select: { id: true } } } } },
  });

  if (!sub) return NextResponse.json({ subscriptionId: null });

  // usesThisCycle/maxUses ficaram de fora de propósito: a UI não usa e são o dado
  // mais sensível a vazar numa rota sem autenticação. Estão na versão /api/v1/.
  return NextResponse.json({
    subscriptionId: sub.id,
    planName: sub.plan.name,
    allowedBarberIds: sub.plan.allowedBarbers.map((b: { id: string }) => b.id),
  });
}
