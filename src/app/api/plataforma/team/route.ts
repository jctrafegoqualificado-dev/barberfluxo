import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";

// GET /api/plataforma/team — lista todos com acesso ao /plataforma
export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin(req);

    const admins = await prisma.user.findMany({
      where: {
        OR: [
          { role: "PLATFORM_ADMIN" },
          { isPlatformAdmin: true },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isPlatformAdmin: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ admins });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST /api/plataforma/team — dá acesso ao /plataforma por e-mail (sem mudar o role)
export async function POST(req: NextRequest) {
  try {
    const payload = await requirePlatformAdmin(req);
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, role: true, isPlatformAdmin: true },
    });

    if (!target) {
      return NextResponse.json(
        { error: "Usuário não encontrado. Peça para ele criar uma conta primeiro em /cadastro." },
        { status: 404 }
      );
    }

    if (target.role === "PLATFORM_ADMIN" || target.isPlatformAdmin) {
      return NextResponse.json({ error: "Este usuário já tem acesso à plataforma." }, { status: 409 });
    }

    if (target.id === payload.id) {
      return NextResponse.json({ error: "Você já tem acesso à plataforma." }, { status: 409 });
    }

    // Usa isPlatformAdmin: true — NÃO muda o role (barbeiro/dono continua com seu role original)
    await prisma.user.update({
      where: { id: target.id },
      data: { isPlatformAdmin: true },
    });

    return NextResponse.json({
      success: true,
      message: `${target.name || target.email} agora tem acesso ao /plataforma.`,
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
