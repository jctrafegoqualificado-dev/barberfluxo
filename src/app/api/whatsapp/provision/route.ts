import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";

const WEBHOOK_URL = "https://barberfluxo.vercel.app/api/evolution/webhook";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    // 0. Ler corpo da requisição (opcional para conexão manual)
    const body = await req.json().catch(() => ({}));
    const manualInstanceName = body.instanceName?.trim();
    const manualToken = body.token?.trim();

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
      // Se for a mesma instância manual que já está conectada, avisar
      if (existing.status === "CONNECTED" && (!manualInstanceName || existing.evolutionInstanceName === manualInstanceName)) {
        return NextResponse.json(
          { error: "Already connected. Disconnect first to re-provision" },
          { status: 409 }
        );
      }

      // Cleanup: logout da antiga (best effort) e deletar registro
      await evolution.logoutInstance(existing.evolutionInstanceName).catch(() => {});
      await prisma.whatsAppInstance.delete({ where: { id: existing.id } });
    }

    let instanceName = manualInstanceName;
    let token = manualToken;
    let qrcodeBase64 = null;

    if (manualInstanceName && manualToken) {
      // CONEXÃO MANUAL (Instância já criada no Evolution)
      console.log(`🔗 [Provision] Connecting manually to instance: ${instanceName}`);
    } else {
      // CRIAÇÃO AUTOMÁTICA (Fluxo padrão)
      instanceName = `${barbershop.slug}-${barbershop.id.slice(0, 6)}`;
      
      // Cleanup preventivo: tentar deletar da Evolution caso exista lá (mesmo que não esteja no nosso banco)
      await evolution.deleteInstance(instanceName).catch(() => {});

      // 5. Criar instância no Evolution
      const createResult = await evolution.createInstance(instanceName);
      if ("error" in createResult) {
        return NextResponse.json(
          { error: `Failed to create instance: ${createResult.error}` },
          { status: 502 }
        );
      }
      token = createResult.token;
      qrcodeBase64 = createResult.qrcodeBase64;
    }

    // 6. Configurar webhook (Sempre configurar para garantir que o bot ouça esta instância)
    const webhookResult = await evolution.setWebhook(instanceName, WEBHOOK_URL);
    if ("error" in webhookResult) {
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
        evolutionToken: token,
        status: "PENDING", // Começa como pending para o polling verificar o status real
        lastQrCode: qrcodeBase64 || null,
      },
    });

    // 8. Retornar sucesso
    return NextResponse.json({
      instanceName: instance.evolutionInstanceName,
      qrcode: qrcodeBase64,
      status: "PENDING",
      message: manualInstanceName ? "Manual connection successful" : "Scan QR code with WhatsApp to connect",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
