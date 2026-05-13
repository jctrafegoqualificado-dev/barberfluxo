import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Inicialização: Avisar se a chave da API não estiver configurada
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
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
    // 1. Validar autenticação via header
    const reqApiKey = req.headers.get("apikey") || "";
    
    if (!secureCompare(EVOLUTION_API_KEY, reqApiKey)) {
      console.warn("⛔ [Evolution Webhook] Acesso negado. API Key inválida ou ausente.");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parsear body
    const body = await req.json();
    const { event, instance, data } = body;

    // 3. Logar evento de forma legível
    console.log(`\n🟢 [Evolution Webhook] Novo Evento Recebido`);
    console.log(`➡️ Instância: ${instance}`);
    console.log(`➡️ Evento: ${event}`);

    // Extração específica para messages.upsert
    if (event === "messages.upsert") {
      const messageData = data.messages?.[0];
      if (messageData) {
        const remoteJid = messageData.key?.remoteJid || "desconhecido";
        const fromMe = messageData.key?.fromMe ? "Sim" : "Não";
        const messageType = Object.keys(messageData.message || {})[0] || "desconhecido";
        
        // Tenta extrair o texto se for uma mensagem de texto simples
        const text = messageData.message?.conversation || 
                     messageData.message?.extendedTextMessage?.text || 
                     "[Mídia ou formato não textual]";

        console.log(`💬 Detalhes da Mensagem:`);
        console.log(`   - De/Para: ${remoteJid}`);
        console.log(`   - Enviada por nós (fromMe): ${fromMe}`);
        console.log(`   - Tipo: ${messageType}`);
        console.log(`   - Texto: "${text}"`);
      } else {
        console.log(`💬 Detalhes da Mensagem: Sem dados na chave "messages"`);
      }
    } else {
      // Para outros tipos de eventos, logar apenas um resumo curto
      const resumo = data ? JSON.stringify(data).slice(0, 200) : "sem dados";
      console.log(`ℹ️ Resumo do Payload: ${resumo}${resumo.length >= 200 ? "..." : ""}`);
    }

    console.log(`--------------------------------------------------\n`);

    // 4. Retornar 200 para a Evolution parar de tentar reenviar
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    // 5. Capturar erros sem derrubar a aplicação
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
