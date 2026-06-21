import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin, signToken } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const payload = await requirePlatformAdmin(req);
    const { barbershopId } = await req.json();

    if (!barbershopId) {
      return NextResponse.json({ error: "barbershopId é obrigatório" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { id: barbershopId } });
    if (!shop || !shop.ownerId) {
      return NextResponse.json({ error: "Barbearia ou Dono não encontrado" }, { status: 404 });
    }

    const owner = await prisma.user.findUnique({
      where: { id: shop.ownerId }
    });

    if (!owner) {
      return NextResponse.json({ error: "Nenhum Dono encontrado para esta barbearia" }, { status: 404 });
    }

    // Token de impersonação: vida curta (30min) e SEM privilégio de plataforma,
    // para impedir escalonamento caso o dono alvo também seja admin.
    const token = signToken({
      id: owner.id,
      email: owner.email,
      role: owner.role,
      barbershopId: barbershopId,
      isPlatformAdmin: false,
      impersonatedBy: payload.id,
    }, { expiresIn: "30m" });

    // Trilha de auditoria — quem impersonou quem, quando e de onde.
    void logAudit({
      barbershopId,
      userId: payload.id,
      userEmail: payload.email,
      userRole: payload.role,
      action: "IMPERSONATE",
      entity: "Barbershop",
      entityId: barbershopId,
      diff: { after: { impersonatedOwner: owner.email } },
      ip: getClientIp(req),
    });

    return NextResponse.json({ token, user: { name: owner.name, email: owner.email } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
