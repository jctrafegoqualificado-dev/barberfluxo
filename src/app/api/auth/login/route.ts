import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

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

    const token = signToken({ id: user.id, email: user.email, role: user.role, barbershopId });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, barbershopId, barbershopSlug, isBarber },
      token,
    });

    res.cookies.set("token", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (err) {
    console.error("[login] erro:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
