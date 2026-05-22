import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const barbers = await prisma.barber.findMany({
      where: { barbershopId, ...(includeInactive ? {} : { active: true }) },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { user: { name: "asc" } },
    });
    return NextResponse.json({ barbers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    requireAuth(req, ["OWNER"]);
    const { barberId } = await req.json();
    await prisma.barber.update({ where: { id: barberId }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    requireAuth(req, ["OWNER"]);
    const { barberId, name, phone, nickname, commission, password, dayOff, active } = await req.json();

    // ── Toggle ativo/inativo ──
    if (typeof active === "boolean") {
      await prisma.barber.update({ where: { id: barberId }, data: { active } });
      return NextResponse.json({ ok: true });
    }

    const barber = await prisma.barber.findUnique({ where: { id: barberId }, select: { userId: true } });
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    await prisma.user.update({
      where: { id: barber.userId },
      data: {
        name,
        phone: phone || null,
        ...(password ? { password: await hashPassword(password) } : {}),
      },
    });

    await prisma.barber.update({
      where: { id: barberId },
      data: {
        commission: Number(commission),
        nickname: nickname || null,
        dayOff: dayOff !== undefined && dayOff !== "" ? Number(dayOff) : null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { name, email, phone, password, commission, nickname, dayOff } = await req.json();

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const hashed = await hashPassword(password || "barber123");
      user = await prisma.user.create({
        data: { name, email, phone, password: hashed, role: "BARBER" },
      });
    }

    const barber = await prisma.barber.create({
      data: {
        userId: user.id, barbershopId,
        commission: Number(commission) || 50,
        nickname,
        dayOff: dayOff !== undefined && dayOff !== "" ? Number(dayOff) : null,
      },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    });

    return NextResponse.json({ barber }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
