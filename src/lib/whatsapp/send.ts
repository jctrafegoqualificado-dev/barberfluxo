export async function sendTextMessage(
  phone: string,
  text: string,
  options?: { delay?: number }
): Promise<{ messageId: string } | { error: string }> {
  try {
    const apiUrl = process.env.EVOLUTION_API_URL || "";
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME || "";
    const globalApiKey = process.env.EVOLUTION_GLOBAL_API_KEY || "";

    if (!apiUrl || !instanceName || !globalApiKey) {
      return { error: "Evolution API environment variables are not properly configured." };
    }

    // 1. Normaliza phone (só dígitos, com DDI 55 se não tiver)
    let normalizedPhone = phone.replace(/\D/g, "");
    if (normalizedPhone.length <= 11 && !normalizedPhone.startsWith("55")) {
      normalizedPhone = `55${normalizedPhone}`;
    }

    // 2 & 3 & 4. POST request
    const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: {
        "apikey": globalApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number: normalizedPhone,
        text: text,
        delay: options?.delay || 1000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || `HTTP Error: ${response.status}` };
    }

    // A Evolution geralmente retorna o ID da mensagem no objeto key ou response
    const messageId = data.key?.id || data.messageId || "unknown_id";
    return { messageId };
  } catch (error) {
    // 5. Em caso de erro (network, etc), captura e retorna
    return { error: error instanceof Error ? error.message : "Unknown error sending message" };
  }
}
