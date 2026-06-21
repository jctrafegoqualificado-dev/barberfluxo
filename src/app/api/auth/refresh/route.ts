import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTokenFromRequest, verifyToken, signToken } from "@/lib/auth";

// POST /api/auth/refresh — renova o token sem precisar de senha
// Aceita o token atual (válido) e emite um novo com TTL de 24h
export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Verifica assinatura e expiração — rejeita token inválido ou já expirado
    const payload = verifyToken(token);

    // Sessão de impersonação NÃO pode ser renovada — o TTL curto (30min) é proposital.
    // Sem este bloqueio, o refresh transformaria a impersonação em acesso de 7 dias,
    // perderia o claim impersonatedBy e poderia reescalar isPlatformAdmin do dono real.
    if (payload.impersonatedBy) {
      return NextResponse.json(
        { error: "Sessão de impersonação não pode ser renovada. Faça login novamente." },
        { status: 403 }
      );
    }

    // Revalida o usuário no banco (pode ter sido desativado ou ter o role alterado)
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, role: true, isPlatformAdmin: true },
    });
    if (!user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Emite novo token com dados frescos do banco
    const newToken = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      barbershopId: payload.barbershopId,
      isPlatformAdmin: user.isPlatformAdmin,
    });

    const res = NextResponse.json({ token: newToken });
    res.cookies.set("token", newToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7d
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch {
    // verifyToken lança se o token estiver expirado ou inválido
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
}
