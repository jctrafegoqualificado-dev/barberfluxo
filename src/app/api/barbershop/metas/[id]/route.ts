import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;
    const { titulo, valorAlvo } = await req.json();
    const alvo = Number(valorAlvo);
    const name = typeof titulo === "string" ? titulo.trim().slice(0, 80) : "";
    if (!name) return NextResponse.json({ error: "Dê um nome para a meta" }, { status: 400 });
    if (!Number.isFinite(alvo) || alvo <= 0) return NextResponse.json({ error: "Informe um valor maior que zero" }, { status: 400 });

    // 1. Valida posse
    const existing = await prisma.meta.findFirst({
      where: { id, barbershopId },
      select: { id: true, tipo: true }
    });
    if (!existing) {
      return NextResponse.json({ error: "Recurso não encontrado" }, { status: 404 });
    }

    if (existing.tipo === "OCUPACAO" && alvo > 100) return NextResponse.json({ error: "Ocupação vai até 100%" }, { status: 400 });

    // 2. Só nome e valor mudam (o que mede, período e profissional ficam)
    const meta = await prisma.meta.update({
      where: { id },
      data: { titulo: name, valorAlvo: alvo },
    });

    return NextResponse.json({ meta });
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

    const result = await prisma.meta.updateMany({
      where: { id, barbershopId },
      data: { active: false }
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
