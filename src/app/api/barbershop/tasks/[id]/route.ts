import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(req, ["OWNER", "BARBER"]);
    const { id } = await params;
    const data = await req.json();
    const task = await prisma.task.update({
      where: { id },
      data,
      include: { barber: { include: { user: { select: { name: true } } } } },
    });
    return NextResponse.json({ task });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(req, ["OWNER"]);
    const { id } = await params;
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
