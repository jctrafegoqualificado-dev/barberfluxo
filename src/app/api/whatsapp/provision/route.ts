import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";

const WEBHOOK_URL = "https://barberfluxo.vercel.app/api/evolution/webhook";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    // 1. Buscar barbershop
    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
    });

    if (!barbershop) {
      return NextResponse.json({ error: "Barbershop not found" }, { status: 404 });
    }

    // 2. Validar plano Premium
    if (barbershop.saasPlan !== "PREMIUM") {
      return NextResponse.json(
        { error: "WhatsApp requires Premium plan" },
        { status: 403 }
      );
    }

    // 3. Checar instância existente
    const existing = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId },
    });

    if (existing) {
      if (existing.status === "CONNECTED") {
        return NextResponse.json(
          { error: "Already connected. Disconnect first to re-provision" },
          { status: 409 }
        );
      }

      // Cleanup: logout da antiga (best effort) e deletar registro
      await evolution.logoutInstance(existing.evolutionInstanceName).catch(() => {});
      await prisma.whatsAppInstance.delete({ where: { id: existing.id } });
    }

    // 4. Gerar nome da instância
    const instanceName = `${barbershop.slug}-${barbershop.id.slice(0, 6)}`;

    // 5. Criar instância no Evolution
    const createResult = await evolution.createInstance(instanceName);
    if ("error" in createResult) {
      return NextResponse.json(
        { error: `Failed to create instance: ${createResult.error}` },
        { status: 502 }
      );
    }

    // 6. Configurar webhook
    const webhookResult = await evolution.setWebhook(instanceName, WEBHOOK_URL);
    if ("error" in webhookResult) {
      // Rollback: tentar remover instância criada
      await evolution.logoutInstance(instanceName).catch(() => {});
      return NextResponse.json(
        { error: `Failed to configure webhook: ${webhookResult.error}` },
        { status: 502 }
      );
    }

    // 7. Salvar no banco
    const instance = await prisma.whatsAppInstance.create({
      data: {
        barbershopId,
        evolutionInstanceName: instanceName,
        evolutionToken: createResult.token,
        status: "PENDING",
        lastQrCode: createResult.qrcodeBase64 || null,
      },
    });

    // 8. Retornar sucesso
    return NextResponse.json({
      instanceName: instance.evolutionInstanceName,
      qrcode: createResult.qrcodeBase64,
      status: "PENDING",
      message: "Scan QR code with WhatsApp to connect",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
