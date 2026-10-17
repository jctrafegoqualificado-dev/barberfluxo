import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;

    // Barbeiro vê as tarefas dele e as da equipe (sem responsável)
    const me = payload.role === "BARBER"
      ? await prisma.barber.findUnique({ where: { userId: payload.id }, select: { id: true } })
      : null;

    const tasks = await prisma.task.findMany({
      where: { barbershopId, ...(payload.role === "BARBER" ? { OR: [{ barberId: null }, { barberId: me?.id ?? "-" }] } : {}) },
      include: { barber: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tasks });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { title, description, priority, barberId, dueDate } = await req.json();

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority: priority || "NORMAL",
        dueDate: dueDate ? new Date(dueDate) : null,
        barbershopId,
        barberId: barberId || null,
      },
      include: { barber: { include: { user: { select: { name: true } } } } },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
