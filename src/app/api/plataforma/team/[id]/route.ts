import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

// DELETE /api/plataforma/team/[id] — remove acesso ao /plataforma
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await requirePlatformAdmin(req);
    const { id } = await params;

    // Não pode remover a si mesmo
    if (id === payload.id) {
      return NextResponse.json(
        { error: "Você não pode remover seu próprio acesso." },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isPlatformAdmin: true },
    });

    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    if (target.role !== "PLATFORM_ADMIN" && !target.isPlatformAdmin) {
      return NextResponse.json({ error: "Usuário não tem acesso à plataforma." }, { status: 400 });
    }

    // Se tem role PLATFORM_ADMIN → reverte para OWNER
    // Se tem isPlatformAdmin: true → apenas remove a flag (mantém o role original)
    await prisma.user.update({
      where: { id },
      data: {
        isPlatformAdmin: false,
        ...(target.role === "PLATFORM_ADMIN" ? { role: "OWNER" } : {}),
      },
    });

    void logAudit({
      userId: payload.id,
      userEmail: payload.email,
      userRole: payload.role,
      action: "REVOKE_ACCESS",
      entity: "User",
      entityId: target.id,
      diff: { before: { isPlatformAdmin: true, role: target.role }, after: { isPlatformAdmin: false } },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `Acesso de ${target.name || target.email} ao /plataforma foi removido.`,
    });
  } catch (e: any) {
    const msg = e?.message ?? "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Erro interno" : msg }, { status });
  }
}
