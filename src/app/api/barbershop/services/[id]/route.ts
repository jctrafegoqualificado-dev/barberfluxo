import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(req, ["OWNER"]);
    const { id } = await params;
    const { name, description, price, duration, active } = await req.json();
    const service = await prisma.service.update({
      where: { id },
      data: { name, description, price: Number(price), duration: Number(duration), active },
    });
    return NextResponse.json({ service });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAuth(req, ["OWNER"]);
    const { id } = await params;
    await prisma.service.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
