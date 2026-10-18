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
    const name = typeof title === "string" ? title.trim().slice(0, 140) : "";
    if (!name) return NextResponse.json({ error: "Escreva o que precisa ser feito" }, { status: 400 });
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(dueDate).slice(0, 10))) return NextResponse.json({ error: "Prazo inválido" }, { status: 400 });
    if (barberId) {
      const b = await prisma.barber.findFirst({ where: { id: barberId, barbershopId }, select: { id: true } });
      if (!b) return NextResponse.json({ error: "Profissional não encontrado" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        title: name,
        description: typeof description === "string" && description.trim() ? description.trim().slice(0, 1000) : null,
        priority: ["LOW", "NORMAL", "HIGH"].includes(priority) ? priority : "NORMAL",
        // Prazo é um dia (sem hora): guarda à meia-noite UTC, como o painel do barbeiro lê (dueKey)
        dueDate: dueDate ? new Date(String(dueDate).slice(0, 10) + "T00:00:00Z") : null,
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
