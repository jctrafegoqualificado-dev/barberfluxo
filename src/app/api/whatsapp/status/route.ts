import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";

function mapEvolutionState(state: string): string {
  switch (state) {
    case "open":
      return "CONNECTED";
    case "connecting":
      return "CONNECTING";
    case "close":
      return "DISCONNECTED";
    default:
      return "PENDING";
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    // 1. Buscar instância
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId },
    });

    if (!instance) {
      return NextResponse.json({
        provisioned: false,
        status: null,
      });
    }

    // 2. Consultar Evolution
    const statusResult = await evolution.getInstanceStatus(
      instance.evolutionInstanceName
    );

    // Se Evolution estiver offline, retornar status do banco
    if ("error" in statusResult) {
      return NextResponse.json({
        provisioned: true,
        status: instance.status,
        evolutionInstanceName: instance.evolutionInstanceName,
        lastConnectedAt: instance.lastConnectedAt,
        evolutionUnreachable: true,
      });
    }

    // 3. Mapear estado
    const mappedStatus = mapEvolutionState(statusResult.state);

    // 4. Atualizar banco se status mudou
    if (mappedStatus !== instance.status) {
      const updateData: Record<string, unknown> = { status: mappedStatus };
      if (mappedStatus === "CONNECTED") {
        updateData.lastConnectedAt = new Date();
      }
      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: updateData,
      });
    }

    // ── NOVO: Auto-Fix de Webhook para Produção ──
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (mappedStatus === "CONNECTED" && appUrl) {
      const webhookUrl = `${appUrl}/api/evolution/webhook`;
      console.log(`🔗 [Webhook Sync] Verificando webhook para: ${webhookUrl}`);
      // Configuramos o webhook na Evolution para garantir que as mensagens cheguem
      await evolution.setWebhook(instance.evolutionInstanceName, webhookUrl).catch(err => {
        console.error("❌ [Webhook Sync] Falha ao configurar webhook:", err);
      });
    }

    // 5. Retornar
    return NextResponse.json({
      provisioned: true,
      status: mappedStatus,
      evolutionInstanceName: instance.evolutionInstanceName,
      lastConnectedAt:
        mappedStatus === "CONNECTED"
          ? new Date().toISOString()
          : instance.lastConnectedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
