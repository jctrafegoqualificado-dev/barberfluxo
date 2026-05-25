import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requirePlatformAdmin } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin(req);
    const { id: shopId } = await params;

    const shop = await prisma.barbershop.findUnique({
      where: { id: shopId },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        saasPayments: { orderBy: { createdAt: "desc" } },
        _count: {
          select: { appointments: true, barbers: true, products: true, services: true }
        }
      }
    });

    if (!shop) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    return NextResponse.json({ shop });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
