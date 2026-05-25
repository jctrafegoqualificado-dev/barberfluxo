import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// DELETE /api/plataforma/team/[id] — remove acesso ao /plataforma
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = requireAuth(req, ["PLATFORM_ADMIN"]);
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
      select: { id: true, name: true, email: true, role: true },
    });

    if (!target) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    if (target.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Usuário não é administrador." }, { status: 400 });
    }

    // Reverte para OWNER (role padrão de quem gerencia estabelecimento)
    await prisma.user.update({
      where: { id },
      data: { role: "OWNER" },
    });

    return NextResponse.json({
      success: true,
      message: `Acesso de ${target.name || target.email} ao /plataforma foi removido.`,
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
