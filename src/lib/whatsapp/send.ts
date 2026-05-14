import { prisma } from "@/lib/prisma";

/**
 * Envia uma mensagem de texto via Evolution API para uma barbearia específica.
 * Busca as credenciais da instância dinamicamente no banco de dados.
 */
export async function sendTextMessage(
  barbershopId: string,
  phone: string,
  text: string,
  options?: { delay?: number }
): Promise<{ messageId: string } | { error: string }> {
  try {
    const apiUrl = process.env.EVOLUTION_API_URL || "";
    if (!apiUrl) {
      return { error: "EVOLUTION_API_URL not configured." };
    }

    // 1. Buscar a instância vinculada à barbearia
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId },
    });

    if (!instance) {
      return { error: "Nenhuma instância de WhatsApp encontrada para esta barbearia." };
    }

    if (instance.status !== "CONNECTED") {
      return { error: "WhatsApp da barbearia não está conectado." };
    }

    // 2. Normaliza phone (só dígitos, com DDI 55 se não tiver)
    let normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length <= 11 && !normalizedPhone.startsWith("55")) {
      normalizedPhone = `55${normalizedPhone}`;
    }

    // 3. POST request para a Evolution API
    // Usamos o token específico da instância (evolutionToken) como apikey
    const response = await fetch(`${apiUrl}/message/sendText/${instance.evolutionInstanceName}`, {
      method: "POST",
      headers: {
        "apikey": instance.evolutionToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: text,
        delay: options?.delay || 1000,
        linkPreview: true, // Habilitar preview de links por padrão
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || `HTTP Error: ${response.status}` };
    }

    // Retorna o ID da mensagem gerado pela Evolution
    const messageId = data.key?.id || data.messageId || "unknown_id";
    return { messageId };
  } catch (error) {
    console.error("❌ [WhatsApp Send] Erro fatal ao enviar:", error);
    return { error: error instanceof Error ? error.message : "Erro desconhecido ao enviar mensagem" };
  }
}
