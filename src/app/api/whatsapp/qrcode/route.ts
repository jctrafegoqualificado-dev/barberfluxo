import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    // 1. Buscar instância
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not provisioned. Call POST /api/whatsapp/provision first" },
        { status: 404 }
      );
    }

    // 2. Buscar QR no Evolution
    const qrResult = await evolution.getQrCode(instance.evolutionInstanceName);
    if ("error" in qrResult) {
      return NextResponse.json(
        { error: `Failed to fetch QR code: ${qrResult.error}` },
        { status: 502 }
      );
    }

    // 3. Atualizar lastQrCode no banco (fire-and-forget com catch)
    prisma.whatsAppInstance
      .update({
        where: { id: instance.id },
        data: { lastQrCode: qrResult.base64 },
      })
      .catch((err) => console.error("Failed to save QR to DB:", err));

    // 4. Retornar
    return NextResponse.json({
      qrcode: qrResult.base64,
      count: qrResult.count,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
