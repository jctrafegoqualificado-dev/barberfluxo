import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { workAlone, barberName, barberEmail, barberPassword, barberCommission } = await req.json();

    if (workAlone) {
      // Cria Barber vinculado ao próprio usuário dono
      const alreadyBarber = await prisma.barber.findFirst({
        where: { barbershopId, userId: payload.id },
      });

      if (!alreadyBarber) {
        await prisma.barber.create({
          data: {
            userId: payload.id,
            barbershopId,
            commission: 100,
          },
        });
      }
    } else if (barberName && barberEmail) {
      // Cria novo barbeiro com user próprio
      let user = await prisma.user.findUnique({ where: { email: barberEmail } });
      if (!user) {
        const hashed = await hashPassword(barberPassword || "barber123");
        user = await prisma.user.create({
          data: { name: barberName, email: barberEmail, password: hashed, role: "BARBER" },
        });
      }
      const existingBarber = await prisma.barber.findFirst({
        where: { barbershopId, userId: user.id },
      });
      if (!existingBarber) {
        await prisma.barber.create({
          data: {
            userId: user.id,
            barbershopId,
            commission: barberCommission ?? 50,
          },
        });
      }
    }

    await prisma.barbershop.update({
      where: { id: barbershopId },
      data: { onboardingCompleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
