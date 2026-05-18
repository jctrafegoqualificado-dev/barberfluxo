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
        id: true,
        name: true,
        description: true,
        primaryColor: true,
        secondaryColor: true,
        logoUrl: true,
        favIconUrl: true,
      }
    });

    return NextResponse.json(barbershop);
  } catch (e: unknown) {
    console.error("❌ [Settings GET Error]:", e);
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();

    console.log("🎨 [Settings PATCH] Updating branding:", body);

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        name: body.name,
        description: body.description,
        primaryColor: body.primaryColor,
        secondaryColor: body.secondaryColor,
        logoUrl: body.logoUrl,
        favIconUrl: body.favIconUrl,
      }
    });

    console.log("✅ [Settings PATCH] Success");
    return NextResponse.json(updated);
  } catch (e: unknown) {
    console.error("❌ [Settings PATCH Error]:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao atualizar" }, { status: 500 });
  }
}
