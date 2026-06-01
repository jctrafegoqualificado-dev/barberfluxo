import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";

const WEBHOOK_URL = process.env.N8N_EVOLUTION_WEBHOOK_URL ?? "";
const PENDING_TOKEN = "__pending__";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId },
    });

    if (!instance) {
      return NextResponse.json(
        { error: "Instance not provisioned. Call POST /api/whatsapp/provision first" },
        { status: 404 }
      );
    }

    const instanceName = instance.evolutionInstanceName;

    // Se token ainda for o sentinel, a instância ainda não foi criada no Evolution.
    // Criamos aqui com orçamento próprio de 10s (separado do /provision).
    if (instance.evolutionToken === PENDING_TOKEN) {
      console.log(`[QrCode] Creating Evolution instance: ${instanceName}`);
      const createResult = await evolution.createInstance(instanceName, 7000);

      if ("error" in createResult) {
        console.error(`[QrCode] createInstance failed: ${createResult.error}`);
        return NextResponse.json(
          { error: `Falha ao criar instância WhatsApp: ${createResult.error}` },
          { status: 502 }
        );
      }

      // Persiste o token real no DB
      await prisma.whatsAppInstance
        .update({
          where: { id: instance.id },
          data: { evolutionToken: createResult.token },
        })
        .catch((err) => console.error("[QrCode] Failed to persist token:", err));

      // Configura webhook fire-and-forget
      if (WEBHOOK_URL) {
        evolution.setWebhook(instanceName, WEBHOOK_URL).catch(() => {});
      } else {
        console.warn("[QrCode] N8N_EVOLUTION_WEBHOOK_URL não configurada — webhook ignorado");
      }

      console.log(`[QrCode] Instance created, returning null QR — client will retry`);
      // Retorna null: a instância ainda está inicializando no Evolution.
      // O frontend (polling de 5s) vai tentar novamente e receberá o QR na próxima chamada.
      return NextResponse.json({ qrcode: null, count: 0 });
    }

    // Instância já criada — busca o QR code no Evolution
    const qrResult = await evolution.getQrCode(instanceName);
    if ("error" in qrResult) {
      return NextResponse.json(
        { error: `Failed to fetch QR code: ${qrResult.error}` },
        { status: 502 }
      );
    }

    // Salva QR no banco (fire-and-forget)
    prisma.whatsAppInstance
      .update({
        where: { id: instance.id },
        data: { lastQrCode: qrResult.base64 },
      })
      .catch((err) => console.error("Failed to save QR to DB:", err));

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
