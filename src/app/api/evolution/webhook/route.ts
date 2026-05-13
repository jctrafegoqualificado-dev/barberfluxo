import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Inicialização: Avisar se a chave da API não estiver configurada
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const EVOLUTION_SERVER_URL = process.env.EVOLUTION_SERVER_URL || "";

if (!EVOLUTION_API_KEY) {
  console.warn("⚠️ [Evolution Webhook] ATENÇÃO: Variável EVOLUTION_API_KEY não definida no .env!");
}

// Função para comparação segura de strings (evita timing attacks)
function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    // a. Parsear body (em try-catch — se falhar, 400 Bad Request)
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.warn("⛔ [Evolution Webhook] Bad Request. Body JSON inválido.");
      return NextResponse.json({ error: "Bad Request" }, { status: 400 });
    }

    // b. Extrair apikey de header OU body
    const apiKeyFromHeader = req.headers.get("apikey");
    const apiKeyFromBody = body?.apikey;
    const receivedKey = apiKeyFromHeader || apiKeyFromBody || "";

    // c. Validar apikey contra EVOLUTION_API_KEY (timing-safe)
    if (!secureCompare(EVOLUTION_API_KEY, receivedKey)) {
      console.warn("⛔ [Evolution Webhook] Acesso negado. API Key inválida ou ausente.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // d. (Opcional) Validar server_url contra EVOLUTION_SERVER_URL
    const serverUrl = body?.server_url;
    if (EVOLUTION_SERVER_URL && serverUrl && EVOLUTION_SERVER_URL !== serverUrl) {
      console.warn(`⛔ [Evolution Webhook] Acesso negado. server_url incompatível: ${serverUrl}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event, instance, data } = body;

    // e. Logar evento de forma legível
    console.log(`\n🟢 [Evolution Webhook] Novo Evento Recebido`);
    console.log(`➡️ Instância: ${instance}`);
    console.log(`➡️ Evento: ${event}`);

    // Extração específica para messages.upsert
    if (event === "messages.upsert") {
      const messageData = data;
      if (messageData) {
        const remoteJid = messageData.key?.remoteJid || "desconhecido";
        const fromMe = messageData.key?.fromMe ? "Sim" : "Não";
        const messageType = messageData.messageType || "desconhecido";
        const pushName = messageData.pushName || "Desconhecido";
        
        // Tenta extrair o texto se for uma mensagem de texto simples
        const text = messageData.message?.conversation || 
                     messageData.message?.extendedTextMessage?.text || 
                     "[Mídia ou formato não textual]";

        console.log(`💬 Detalhes da Mensagem:`);
        console.log(`   - De/Para: ${remoteJid}`);
        console.log(`   - Nome: ${pushName}`);
        console.log(`   - Enviada por nós (fromMe): ${fromMe}`);
        console.log(`   - Tipo: ${messageType}`);
        console.log(`   - Texto: "${text}"`);
      } else {
        console.log(`💬 Detalhes da Mensagem: Sem dados`);
      }
    } else {
      // Para outros tipos de eventos, logar apenas um resumo curto
      const resumo = data ? JSON.stringify(data).slice(0, 200) : "sem dados";
      console.log(`ℹ️ Resumo do Payload: ${resumo}${resumo.length >= 200 ? "..." : ""}`);
    }

    console.log(`--------------------------------------------------\n`);

    // f. Retornar 200 para a Evolution parar de tentar reenviar
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    // Capturar erros sem derrubar a aplicação
    console.error("❌ [Evolution Webhook] Erro ao processar webhook:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: error instanceof Error ? error.message : "Erro desconhecido" },
      { status: 500 }
    );
  }
}

// Rejeitar outros métodos conforme a especificação
export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
