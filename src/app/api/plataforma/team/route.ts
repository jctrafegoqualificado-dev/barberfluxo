import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

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
    const msg = e?.message ?? "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Erro interno" : msg }, { status });
  }
}

// POST /api/plataforma/team — dá acesso ao /plataforma por e-mail (sem mudar o role)
export async function POST(req: NextRequest) {
  try {
    const payload = await requirePlatformAdmin(req);
    const { email } = await req.json();

    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

    void logAudit({
      userId: payload.id,
      userEmail: payload.email,
      userRole: payload.role,
      action: "GRANT_ACCESS",
      entity: "User",
      entityId: target.id,
      diff: { after: { isPlatformAdmin: true, grantedTo: target.email } },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: `${target.name || target.email} agora tem acesso ao /plataforma.`,
    });
  } catch (e: any) {
    const msg = e?.message ?? "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 500 ? "Erro interno" : msg }, { status });
  }
}
