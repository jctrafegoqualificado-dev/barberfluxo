import { prisma } from "./prisma";
import * as evolution from "./evolution/client";

/**
 * Envia uma mensagem de WhatsApp para um cliente ou barbeiro.
 * Busca automaticamente a instância conectada da barbearia.
 */
export async function sendWhatsAppNotification(barbershopId: string, phone: string, text: string) {
  try {
    // 1. Busca instância conectada
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId },
    });

    if (!instance || instance.status !== "CONNECTED") {
      console.warn(`⚠️ [Notification] Skip: Instância não conectada para barbearia ${barbershopId}`);
      return { success: false, reason: "NOT_CONNECTED" };
    }

    // 2. Envia mensagem
    const result = await evolution.sendMessage(
      instance.evolutionInstanceName,
      phone,
      text
    );

    if ("error" in result) {
      console.error(`❌ [Notification] Erro ao enviar: ${result.error}`);
      return { success: false, reason: result.error };
    }

    console.log(`✅ [Notification] Mensagem enviada para ${phone}`);
    return { success: true, key: result.key };
  } catch (error) {
    console.error("❌ [Notification] Erro interno:", error);
    return { success: false, reason: "INTERNAL_ERROR" };
  }
}
