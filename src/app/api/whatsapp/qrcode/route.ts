import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";
import { resolveWebhookUrl } from "@/lib/evolution/webhook-target";

// Sentinels de estado
const PENDING_TOKEN  = "__pending__";   // createInstance ainda não foi chamado
const CREATING_TOKEN = "__creating__";  // createInstance foi chamado mas não houve resposta (POST bloqueado/lento)

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

    // Webhook roteado por entitlement de IA (n8n se tem IA; senão CRM save-only).
    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { saasPlan: true, saasStatus: true, trialEndsAt: true, saasExpiresAt: true },
    });
    const webhookUrl = shop ? resolveWebhookUrl(shop) : "";

    if (instance.evolutionToken === PENDING_TOKEN) {
      // Primeira tentativa de criar a instância no Evolution.
      // Timeout curto (3s) para caber dentro do limite Vercel Hobby (10s - cold_start - DB).
      // Se a Evolution não responder em 3s, marcamos como __creating__ e retornamos null.
      // O frontend tenta de novo em 5s. Se a Evolution processou o POST mesmo após timeout,
      // na próxima chamada (token=__creating__) tentamos getQrCode diretamente.
      console.log(`[QrCode] Tentando criar instância Evolution: ${instanceName}`);
      const createResult = await evolution.createInstance(instanceName, 3000);

      if ("error" in createResult) {
        const isAbortOrTimeout =
          createResult.error.toLowerCase().includes("abort") ||
          createResult.error.toLowerCase().includes("timeout") ||
          createResult.error.toLowerCase().includes("network");

        console.error(`[QrCode] createInstance erro: ${createResult.error} (abort=${isAbortOrTimeout})`);

        // Marca como __creating__ — próxima chamada tenta getQrCode diretamente
        // (a Evolution pode ter processado o POST mesmo após o nosso timeout)
        await prisma.whatsAppInstance
          .update({ where: { id: instance.id }, data: { evolutionToken: CREATING_TOKEN } })
          .catch(() => {});

        return NextResponse.json({ qrcode: null, count: 0 });
      }

      // createInstance retornou com sucesso — salva token real
      await prisma.whatsAppInstance
        .update({ where: { id: instance.id }, data: { evolutionToken: createResult.token } })
        .catch((err) => console.error("[QrCode] Falha ao salvar token:", err));

      if (webhookUrl) {
        evolution.setWebhook(instanceName, webhookUrl).catch(() => {});
      }

      console.log(`[QrCode] Instância criada com sucesso, retornando null QR — cliente retentar em 5s`);
      return NextResponse.json({ qrcode: null, count: 0 });
    }

    if (instance.evolutionToken === CREATING_TOKEN) {
      // createInstance já foi disparado (pode ter sido processado pela Evolution mesmo após timeout).
      // Tenta buscar o QR diretamente — se a instância existe, funciona; senão, retorna null e retenta.
      console.log(`[QrCode] Verificando se instância foi criada: ${instanceName}`);
      // Usa timeout curto (5s) para caber no budget Vercel Hobby junto com cold start e DB overhead.
      const qrResult = await evolution.getQrCode(instanceName, 5000);

      if ("error" in qrResult || !qrResult.base64) {
        console.warn(`[QrCode] Instância ainda não disponível: ${"error" in qrResult ? qrResult.error : "base64 vazia"}`);
        // Retorna null sem erro — frontend retenta em 5s
        return NextResponse.json({ qrcode: null, count: 0 });
      }

      // Instância criada com sucesso após retry — atualiza token para indicar operacional
      await prisma.whatsAppInstance
        .update({ where: { id: instance.id }, data: { evolutionToken: "__global__", lastQrCode: qrResult.base64 } })
        .catch(() => {});

      return NextResponse.json({ qrcode: qrResult.base64, count: qrResult.count });
    }

    // Estado normal — instância já criada, busca QR
    // Reaplica o webhook (roteado por entitlement) para o Evolution não reverter
    // ao webhook global do servidor.
    if (webhookUrl) {
      evolution.setWebhook(instanceName, webhookUrl).catch((err) =>
        console.error(`[QrCode] Falha ao reaplicar webhook para ${instanceName}:`, err)
      );
    }

    const qrResult = await evolution.getQrCode(instanceName, 5000);
    if ("error" in qrResult) {
      return NextResponse.json(
        { error: `Failed to fetch QR code: ${qrResult.error}` },
        { status: 502 }
      );
    }

    if (!qrResult.base64) {
      // Evolution respondeu mas QR ainda não gerado (Baileys inicializando) — retenta em 5s
      console.warn(`[QrCode] Evolution retornou base64 vazia para ${instanceName} — retentando`);
      return NextResponse.json({ qrcode: null, count: 0 });
    }

    prisma.whatsAppInstance
      .update({ where: { id: instance.id }, data: { lastQrCode: qrResult.base64 } })
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
