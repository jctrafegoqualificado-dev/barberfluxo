import { prisma } from "./prisma";
import * as evolution from "./evolution/client";

/**
 * Normaliza número de telefone para formato internacional brasileiro.
 * Remove não-dígitos e adiciona código do país +55 se necessário.
 *
 * Exemplos:
 *   "41998861196"      → "5541998861196"   (11 dígitos → adiciona 55)
 *   "5541998861196"    → "5541998861196"   (13 dígitos → já tem 55)
 *   "+55 (41) 99886-1196" → "5541998861196" (formatos com máscara)
 */
function normalizeBrPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Já tem código do país 55: 12 dígitos (fixo) ou 13 dígitos (celular)
  if (digits.length >= 12 && digits.startsWith("55")) return digits;
  // Adiciona código do Brasil
  return `55${digits}`;
}

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

    // 2. Normaliza número para formato internacional (+55 Brasil)
    const normalizedPhone = normalizeBrPhone(phone);

    // 3. Envia mensagem
    const result = await evolution.sendMessage(
      instance.evolutionInstanceName,
      normalizedPhone,
      text
    );

    if ("error" in result) {
      console.error(`❌ [Notification] Erro ao enviar: ${result.error}`);
      return { success: false, reason: result.error };
    }

    console.log(`✅ [Notification] Mensagem enviada para ${normalizedPhone} (original: ${phone})`);
    return { success: true, key: result.key };
  } catch (error) {
    console.error("❌ [Notification] Erro interno:", error);
    return { success: false, reason: "INTERNAL_ERROR" };
  }
}
