import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/booking/{slug}/cliente?phone=...
 *
 * Autocompleta o nome na página pública de agendamento. Público por natureza —
 * é o navegador do cliente que chama, antes de qualquer login.
 *
 * Por isso o retorno é deliberadamente mínimo e escopado:
 *  - só responde para telefone BR completo (>= 10 dígitos), para não facilitar
 *    varredura por prefixos curtos;
 *  - só reconhece quem já tem vínculo COM ESTA barbearia (agendamento ou
 *    assinatura). Antes o slug era ignorado, e a rota funcionava como consulta
 *    global telefone -> nome sobre a base inteira da plataforma.
 *
 * Cliente novo simplesmente não é encontrado e digita o nome normalmente.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    const cleanPhone = (phone ?? "").replace(/\D/g, "");
    if (cleanPhone.length < 10) return NextResponse.json({ found: false });

    const shop = await prisma.barbershop.findUnique({
      where: { slug },
      select: { id: true, active: true },
    });
    if (!shop || !shop.active) return NextResponse.json({ found: false });

    const user = await prisma.user.findFirst({
      where: {
        role: "CLIENT",
        AND: [
          {
            // Identidade: telefone limpo ou os domínios sintéticos históricos
            OR: [
              { phone: cleanPhone },
              { email: `${cleanPhone}@cliente.iadebarbearia.com` },
              { email: `${cleanPhone}@cliente.barberfluxo` },
              { email: `${cleanPhone}@cliente.barberfluxo.com` },
              { email: `${cleanPhone}@cliente.barberapp` },
            ],
          },
          {
            // Vínculo com esta barbearia
            OR: [
              { appointments: { some: { barbershopId: shop.id } } },
              { subscriptions: { some: { barbershopId: shop.id } } },
            ],
          },
        ],
      },
      select: { name: true },
    });

    if (!user) return NextResponse.json({ found: false });

    // Separa nome e sobrenome
    const parts = user.name.trim().split(" ");
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ");

    return NextResponse.json({ found: true, firstName, lastName });
  } catch {
    return NextResponse.json({ found: false });
  }
}
