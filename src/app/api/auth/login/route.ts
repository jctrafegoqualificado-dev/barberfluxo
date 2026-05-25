import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { loginRatelimit } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    // Rate limiting: máximo 5 tentativas por email a cada 15 minutos (CVE-15)
    const { success, limit, remaining, reset } = await loginRatelimit.limit(
      email?.toLowerCase?.() ?? "unknown"
    );
    if (!success) {
      const retryAfterSec = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Muitas tentativas de login. Tente novamente em alguns minutos." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
          },
        }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
    }

    let barbershopId: string | undefined;
    let barbershopSlug: string | undefined;
    let isBarber = false;

    if (user.role === "OWNER") {
      const [shop, barberProfile] = await Promise.all([
        prisma.barbershop.findUnique({ where: { ownerId: user.id } }),
        prisma.barber.findUnique({ where: { userId: user.id } }),
      ]);
      barbershopId = shop?.id;
      barbershopSlug = shop?.slug;
      isBarber = !!barberProfile;
    } else if (user.role === "BARBER") {
      const barber = await prisma.barber.findUnique({
        where: { userId: user.id },
        include: { barbershop: { select: { slug: true } } },
      });
      barbershopId = barber?.barbershopId;
      barbershopSlug = barber?.barbershop?.slug;
      isBarber = true;
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, barbershopId, isPlatformAdmin: user.isPlatformAdmin });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, barbershopId, barbershopSlug, isBarber, isPlatformAdmin: user.isPlatformAdmin },
      token,
    });

    res.cookies.set("token", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (err) {
    console.error("[login] erro:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
