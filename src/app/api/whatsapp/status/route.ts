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

    // 2. Se token for sentinela, a instância ainda está sendo criada — não consultar Evolution
    // (ela estaria em "close" e sobrescreveria PENDING com DISCONNECTED, quebrando o fluxo)
    const SENTINEL_TOKENS = ["__pending__", "__creating__"];
    if (SENTINEL_TOKENS.includes(instance.evolutionToken)) {
      return NextResponse.json({
        provisioned: true,
        status: instance.status,
        evolutionInstanceName: instance.evolutionInstanceName,
        lastConnectedAt: instance.lastConnectedAt,
      });
    }

    // 3. Consultar Evolution
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

    // 4. Mapear estado
    const mappedStatus = mapEvolutionState(statusResult.state);

    // Nunca regredir PENDING → DISCONNECTED ou PENDING → CONNECTING via status route.
    // "close" = aguardando QR ou desconectado; "connecting" = Evolution tentando restaurar sessão antiga.
    // Ambas as transições só devem ocorrer via ação explícita do usuário (/disconnect ou /provision).
    const effectiveStatus =
      instance.status === "PENDING" && (mappedStatus === "DISCONNECTED" || mappedStatus === "CONNECTING")
        ? "PENDING"
        : mappedStatus;

    // 5. Atualizar banco se status mudou
    if (effectiveStatus !== instance.status) {
      const updateData: Record<string, unknown> = { status: effectiveStatus };
      if (effectiveStatus === "CONNECTED") {
        updateData.lastConnectedAt = new Date();
      }
      await prisma.whatsAppInstance.update({
        where: { id: instance.id },
        data: updateData,
      });
    }

    // ── Auto-Fix de Webhook + Settings para Produção ──
    // O assistente de IA vive no N8N. O webhook da instância DEVE apontar para o N8N,
    // não para a nossa rota /api/evolution/webhook (que apenas salva a mensagem e tem o
    // bot desativado). Reaplicamos o webhook do N8N sempre que a instância está conectada
    // para o Evolution não reverter ao webhook global do servidor — e reaplicamos as
    // settings (groupsIgnore) para retrofitar instâncias criadas antes desta correção.
    const n8nWebhookUrl = process.env.N8N_EVOLUTION_WEBHOOK_URL ?? "";
    if (effectiveStatus === "CONNECTED" && n8nWebhookUrl) {
      console.log(`🔗 [Webhook Sync] Reaplicando webhook N8N para ${instance.evolutionInstanceName}: ${n8nWebhookUrl}`);
      await evolution.setWebhook(instance.evolutionInstanceName, n8nWebhookUrl).catch(err => {
        console.error("❌ [Webhook Sync] Falha ao configurar webhook N8N:", err);
      });
      evolution.setInstanceSettings(instance.evolutionInstanceName).catch(err => {
        console.error("❌ [Settings Sync] Falha ao aplicar settings (groupsIgnore):", err);
      });
    }

    // 6. Retornar
    return NextResponse.json({
      provisioned: true,
      status: effectiveStatus,
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
