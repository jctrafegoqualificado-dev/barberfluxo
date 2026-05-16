const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "";
const EVOLUTION_GLOBAL_API_KEY = process.env.EVOLUTION_GLOBAL_API_KEY || "";

const TIMEOUT_MS = 15000;

function headers(customApiKey?: string): Record<string, string> {
  return {
    "apikey": customApiKey || EVOLUTION_GLOBAL_API_KEY,
    "Content-Type": "application/json",
  };
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// 1. Criar instância no Evolution
export async function createInstance(
  instanceName: string
): Promise<{ instanceName: string; token: string; qrcodeBase64: string } | { error: string }> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_API_KEY) {
      return { error: "Evolution API environment variables not configured" };
    }

    console.log(`🔧 [Evolution] Creating instance: ${instanceName}`);

    const res = await fetchWithTimeout(`${EVOLUTION_API_URL}/instance/create`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { error: data.message || data.error || `HTTP ${res.status}` };
    }

    // Evolution v2.2.3 retorna o token em data.hash (string).
    // Versões mais antigas retornavam em data.hash.apikey (objeto). Cobrimos ambos.
    const token: string =
      (typeof data.hash === "string" ? data.hash : data.hash?.apikey) ||
      data.token ||
      data.apikey ||
      "";

    if (!token) {
      throw new Error(
        `Evolution não retornou token na criação da instância "${instanceName}". ` +
        `Response keys: ${Object.keys(data).join(", ")}`
      );
    }

    const qrcodeBase64 = data.qrcode?.base64 || data.base64 || "";

    console.log(
      `✅ [Evolution] Instância criada: ${instanceName}, ` +
      `token len: ${token.length}, prefix: ${token.slice(0, 8)}`
    );
    return { instanceName, token, qrcodeBase64 };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ [Evolution] createInstance failed: ${msg}`);
    return { error: msg };
  }
}

// 2. Consultar status de conexão da instância
export async function getInstanceStatus(
  instanceName: string
): Promise<{ state: string } | { error: string }> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_API_KEY) {
      return { error: "Evolution API environment variables not configured" };
    }

    const res = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { method: "GET", headers: headers() }
    );

    const data = await res.json();

    if (!res.ok) {
      return { error: data.message || data.error || `HTTP ${res.status}` };
    }

    const state = data.instance?.state || data.state || "unknown";
    return { state };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ [Evolution] getInstanceStatus failed: ${msg}`);
    return { error: msg };
  }
}

// 3. Buscar QR code atualizado
export async function getQrCode(
  instanceName: string
): Promise<{ base64: string; count: number } | { error: string }> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_API_KEY) {
      return { error: "Evolution API environment variables not configured" };
    }

    const res = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
      { method: "GET", headers: headers() }
    );

    const data = await res.json();

    if (!res.ok) {
      return { error: data.message || data.error || `HTTP ${res.status}` };
    }

    const base64 = data.base64 || data.qrcode?.base64 || "";
    const count = data.count ?? data.pairingCode ?? 0;
    return { base64, count };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ [Evolution] getQrCode failed: ${msg}`);
    return { error: msg };
  }
}

// 4. Desconectar instância (logout)
export async function logoutInstance(
  instanceName: string
): Promise<{ success: true } | { error: string }> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_API_KEY) {
      return { error: "Evolution API environment variables not configured" };
    }

    console.log(`🔌 [Evolution] Logging out instance: ${instanceName}`);

    const res = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/instance/logout/${instanceName}`,
      { method: "DELETE", headers: headers() }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as any).message || `HTTP ${res.status}` };
    }

    console.log(`✅ [Evolution] Instance logged out: ${instanceName}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ [Evolution] logoutInstance failed: ${msg}`);
    return { error: msg };
  }
}

// 4.1. Deletar instância completamente (limpeza de sistema)
export async function deleteInstance(
  instanceName: string
): Promise<{ success: true } | { error: string }> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_API_KEY) {
      return { error: "Evolution API environment variables not configured" };
    }

    console.log(`🗑️ [Evolution] Deleting instance: ${instanceName}`);

    const res = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/instance/delete/${instanceName}`,
      { method: "DELETE", headers: headers() }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as any).message || `HTTP ${res.status}` };
    }

    console.log(`✅ [Evolution] Instance deleted: ${instanceName}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ [Evolution] deleteInstance failed: ${msg}`);
    return { error: msg };
  }
}

// 5. Configurar webhook na instância
export async function setWebhook(
  instanceName: string,
  webhookUrl: string
): Promise<{ success: true } | { error: string }> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_API_KEY) {
      return { error: "Evolution API environment variables not configured" };
    }

    console.log(`🔗 [Evolution] Setting webhook for ${instanceName}: ${webhookUrl}`);

    const res = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/webhook/set/${instanceName}`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            events: [
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "CONNECTION_UPDATE",
            ],
            webhookByEvents: false,
            webhookBase64: false,
          },
        }),
      }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as any).message || `HTTP ${res.status}` };
    }

    console.log(`✅ [Evolution] Webhook configured for ${instanceName}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ [Evolution] setWebhook failed: ${msg}`);
    return { error: msg };
  }
}

// 6. Enviar mensagem de texto
export async function sendMessage(
  instanceName: string,
  number: string,
  text: string,
  delay: number = 1200,
  customApiKey?: string
): Promise<{ key: { id: string } } | { error: string }> {
  try {
    if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_API_KEY) {
      return { error: "Evolution API environment variables not configured" };
    }

    // Formato Completo da v2.2.3
    // PULO DO GATO: Se for @lid, vamos tentar converter para @s.whatsapp.net pois muitas versões da Evolution
    // não lidam bem com o sufixo @lid no envio, mesmo que recebam bem.
    let jid = number.includes("@") ? number : `${number.replace(/\D/g, "")}@s.whatsapp.net`;
    if (jid.includes("@lid")) {
      jid = jid.replace("@lid", "@s.whatsapp.net");
    }
    
    console.log(`✉️ [Evolution] Sending message to ${jid} via ${instanceName} (v2.2.3 Full Schema)`);

    const res = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: headers(customApiKey),
        body: JSON.stringify({
          number: jid,
          text: text.trim(),
          options: {
            delay: 1200,
            presence: "composing",
            linkPreview: false,
            checkContact: false // <--- O PULO DO GATO! Desativa a checagem que está falhando
          }
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error(`❌ [Evolution Error Details]:`, JSON.stringify(data, null, 2));
      return { error: data.message || data.error || `HTTP ${res.status}` };
    }

    return data;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ [Evolution] sendMessage failed: ${msg}`);
    return { error: msg };
  }
}

// 7. Enviar Lista Interativa
export async function sendList(
  instanceName: string,
  number: string,
  title: string,
  description: string,
  buttonText: string,
  sections: any[]
): Promise<any> {
  try {
    let jid = number;
    if (!jid.includes("@")) {
      const cleanNumber = number.replace(/\D/g, "");
      jid = `${cleanNumber}@s.whatsapp.net`;
    }
    console.log(`✉️ [Evolution] Sending list to ${jid} via ${instanceName}`);

    const res = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/message/sendList/${instanceName}`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          number: jid,
          title,
          description,
          buttonText,
          footerText: "",
          sections,
        }),
      }
    );

    return await res.json();
  } catch (error) {
    console.error(`❌ [Evolution] sendList failed:`, error);
    return { error: "Failed to send list" };
  }
}

// 8. Enviar Botões
export async function sendButtons(
  instanceName: string,
  number: string,
  title: string,
  description: string,
  buttons: any[]
): Promise<any> {
  try {
    let jid = number;
    if (!jid.includes("@")) {
      const cleanNumber = number.replace(/\D/g, "");
      jid = `${cleanNumber}@s.whatsapp.net`;
    }
    console.log(`✉️ [Evolution] Sending buttons to ${jid} via ${instanceName}`);

    const res = await fetchWithTimeout(
      `${EVOLUTION_API_URL}/message/sendButtons/${instanceName}`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          number: jid,
          title,
          description,
          footer: "",
          buttons,
        }),
      }
    );

    return await res.json();
  } catch (error) {
    console.error(`❌ [Evolution] sendButtons failed:`, error);
    return { error: "Failed to send buttons" };
  }
}
