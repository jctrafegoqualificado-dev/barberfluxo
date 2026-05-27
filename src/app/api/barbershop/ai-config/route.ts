import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        aiAssistantName: true,
        aiPersonality: true,
        aiGreetingDirective: true,
      },
    });

    return NextResponse.json(barbershop);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();

    // Limites de caracteres alinhados com o schema (VarChar(50) e Text)
    const aiAssistantName = typeof body.aiAssistantName === "string"
      ? body.aiAssistantName.trim().slice(0, 50) || null
      : null;

    const aiPersonality = typeof body.aiPersonality === "string"
      ? body.aiPersonality.trim().slice(0, 500) || null
      : null;

    const aiGreetingDirective = typeof body.aiGreetingDirective === "string"
      ? body.aiGreetingDirective.trim().slice(0, 200) || null
      : null;

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: { aiAssistantName, aiPersonality, aiGreetingDirective },
      select: { aiAssistantName: true, aiPersonality: true, aiGreetingDirective: true },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
