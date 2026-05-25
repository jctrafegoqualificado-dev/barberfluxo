import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET /api/plataforma/team — lista todos os PLATFORM_ADMIN
export async function GET(req: NextRequest) {
  try {
    requireAuth(req, ["PLATFORM_ADMIN"]);

    const admins = await prisma.user.findMany({
      where: { role: "PLATFORM_ADMIN" },
      select: {
        id: true,
        name: true,
        email: true,
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

// POST /api/plataforma/team — promove usuário por e-mail para PLATFORM_ADMIN
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["PLATFORM_ADMIN"]);
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!target) {
      return NextResponse.json(
        { error: "Usuário não encontrado. Peça para ele criar uma conta primeiro em /cadastro." },
        { status: 404 }
      );
    }

    if (target.role === "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "Este usuário já é administrador." }, { status: 409 });
    }

    // Não pode promover a si mesmo (já é admin)
    if (target.id === payload.id) {
      return NextResponse.json({ error: "Você já é administrador." }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: target.id },
      data: { role: "PLATFORM_ADMIN" },
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
