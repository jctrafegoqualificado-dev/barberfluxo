import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/barbershops/{slug}/ai-config
 *
 * Endpoint consumido pelo N8N para obter a configuração do assistente IA
 * de uma barbearia específica. Aceita tanto o slug puro ("lord-of-barba")
 * quanto o instanceName completo da Evolution ("lord-of-barba-a1b2c3").
 *
 * Autenticação: header `x-api-key` validado pelo middleware (PUBLIC_API_KEY).
 * O N8N deve cachear esta resposta pelo valor de `meta.ttlSeconds` (300s).
 *
 * Protegida pelo middleware — não repete a validação de API key aqui.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Tenta encontrar pelo slug primeiro; se não achar, busca pelo instanceName
    // da Evolution (que pode ser "slug-XXXXXX") via WhatsAppInstance
    let shop = await prisma.barbershop.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        active: true,
        aiAssistantName: true,
        aiPersonality: true,
        aiGreetingDirective: true,
        openingHours: {
          select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
          orderBy: { dayOfWeek: "asc" },
        },
        whatsappInstance: {
          select: { evolutionInstanceName: true },
        },
      },
    });

    // Fallback: slug não bateu — pode ser um instanceName completo (ex: "lord-of-barba-a1b2c3")
    if (!shop) {
      const instance = await prisma.whatsAppInstance.findUnique({
        where: { evolutionInstanceName: slug },
        select: {
          evolutionInstanceName: true,
          barbershop: {
            select: {
              id: true,
              name: true,
              slug: true,
              phone: true,
              address: true,
              city: true,
              state: true,
              active: true,
              aiAssistantName: true,
              aiPersonality: true,
              aiGreetingDirective: true,
              openingHours: {
                select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
                orderBy: { dayOfWeek: "asc" },
              },
              whatsappInstance: {
                select: { evolutionInstanceName: true },
              },
            },
          },
        },
      });

      if (instance?.barbershop) {
        shop = instance.barbershop;
      }
    }

    if (!shop || !shop.active) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const instanceName = shop.whatsappInstance?.evolutionInstanceName ?? null;
    const bookingUrl = `${process.env.NEXTAUTH_URL}/agendar/${shop.slug}`;

    // Garante que os 7 dias da semana estejam presentes (fallback fechado para dias sem registro)
    const businessHours = Array.from({ length: 7 }, (_, day) => {
      const found = shop.openingHours.find((h) => h.dayOfWeek === day);
      if (found) {
        return {
          dayOfWeek: found.dayOfWeek,
          isOpen: found.isOpen,
          openTime: found.openTime,
          closeTime: found.closeTime,
        };
      }
      return { dayOfWeek: day, isOpen: false };
    });

    const address =
      [shop.address, shop.city, shop.state].filter(Boolean).join(" — ") || null;

    return NextResponse.json({
      barbershop: {
        name: shop.name,
        slug: shop.slug,
        phone: shop.phone ?? null,
        address,
        bookingUrl,
      },
      ai: {
        assistantName: shop.aiAssistantName ?? shop.name,
        personality: shop.aiPersonality ?? null,
        greetingDirective: shop.aiGreetingDirective ?? null,
        fallbackMessage:
          "Opa, não entendi direito. Você quer agendar um horário, ver nossos serviços ou falar sobre outro assunto?",
      },
      businessHours,
      meta: {
        instanceName,
        timezone: "America/Sao_Paulo",
        ttlSeconds: 300,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
