import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    // 1. Buscar instância
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not provisioned" },
        { status: 404 }
      );
    }

    // 2. Logout no Evolution (best effort)
    const logoutResult = await evolution.logoutInstance(
      instance.evolutionInstanceName
    );
    if ("error" in logoutResult) {
      console.warn(
        `⚠️ [Disconnect] Evolution logout failed for ${instance.evolutionInstanceName}: ${logoutResult.error}`
      );
    }

    // 3. Marcar como DISCONNECTED no banco
    await prisma.whatsAppInstance.update({
      where: { id: instance.id },
      data: { status: "DISCONNECTED" },
    });

    // 4. Retornar
    return NextResponse.json({ disconnected: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
