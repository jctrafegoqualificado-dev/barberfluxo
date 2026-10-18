import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;
    const body = await req.json();

    // 1. Valida posse (barbeiro: só a tarefa dele ou a da equipe)
    const existing = await prisma.task.findFirst({
      where: { id, barbershopId },
      select: { id: true, barberId: true }
    });
    if (!existing) {
      return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    // 2. Só os campos permitidos (antes gravava qualquer campo que viesse, até barbershopId)
    const data: Record<string, unknown> = {};
    if (["TODO", "DOING", "DONE"].includes(body.status)) data.status = body.status;
    if (payload.role === "BARBER") {
      const me = await prisma.barber.findUnique({ where: { userId: payload.id }, select: { id: true } });
      if (existing.barberId && existing.barberId !== me?.id) {
        return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
      }
    } else {
      if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
      if (body.description !== undefined) data.description = body.description || null;
      if (["LOW", "NORMAL", "HIGH"].includes(body.priority)) data.priority = body.priority;
      if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (body.barberId !== undefined) {
        if (body.barberId) {
          const b = await prisma.barber.findFirst({ where: { id: body.barberId, barbershopId }, select: { id: true } });
          if (!b) return NextResponse.json({ error: "Profissional não encontrado" }, { status: 404 });
        }
        data.barberId = body.barberId || null;
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data,
      include: { barber: { include: { user: { select: { name: true } } } } },
    });

    return NextResponse.json({ task });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    const result = await prisma.task.deleteMany({
      where: { id, barbershopId }
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
