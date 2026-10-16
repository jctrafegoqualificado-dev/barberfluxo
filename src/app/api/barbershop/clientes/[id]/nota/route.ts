import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Observações da barbearia sobre o cliente ("gosta de degradê médio, prefere depois das 17h").
// Uma nota por cliente por barbearia — o cadastro do cliente é compartilhado entre barbearias.

const MAX_LENGTH = 1000;

/** O cliente precisa ter agendamento ou assinatura nesta barbearia (mesma regra do PUT do cliente). */
async function findClient(id: string, barbershopId: string) {
  return prisma.user.findFirst({
    where: {
      id,
      role: "CLIENT",
      OR: [
        { appointments: { some: { barbershopId } } },
        { subscriptions: { some: { barbershopId } } },
      ],
    },
    select: { id: true },
  });
}

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    if (!(await findClient(id, barbershopId))) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const note = await prisma.clientNote.findUnique({
      where: { clientId_barbershopId: { clientId: id, barbershopId } },
      select: { content: true, updatedAt: true, updatedBy: true },
    });
    return NextResponse.json({ note });
  } catch (e: unknown) {
    return errorResponse(e);
  }
}

// PUT — grava a nota; texto vazio apaga.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;
    const { content } = await req.json();

    if (typeof content !== "string") {
      return NextResponse.json({ error: "Observação inválida" }, { status: 400 });
    }
    const text = content.trim();
    if (text.length > MAX_LENGTH) {
      return NextResponse.json({ error: `Máximo de ${MAX_LENGTH} caracteres` }, { status: 400 });
    }

    if (!(await findClient(id, barbershopId))) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const where = { clientId_barbershopId: { clientId: id, barbershopId } };
    if (!text) {
      await prisma.clientNote.deleteMany({ where: { clientId: id, barbershopId } });
      return NextResponse.json({ note: null });
    }

    const author = await prisma.user.findUnique({ where: { id: payload.id }, select: { name: true } });
    const note = await prisma.clientNote.upsert({
      where,
      update: { content: text, updatedBy: author?.name ?? null },
      create: { clientId: id, barbershopId, content: text, updatedBy: author?.name ?? null },
      select: { content: true, updatedAt: true, updatedBy: true },
    });
    return NextResponse.json({ note });
  } catch (e: unknown) {
    return errorResponse(e);
  }
}
