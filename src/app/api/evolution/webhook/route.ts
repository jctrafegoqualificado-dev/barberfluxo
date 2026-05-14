import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { processIncomingMessage } from "@/lib/whatsapp/process-incoming";
import { EvolutionWebhookBody } from "@/lib/whatsapp/types";

const EVOLUTION_SERVER_URL = process.env.EVOLUTION_SERVER_URL || "";

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
    let body: EvolutionWebhookBody;
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

    // c. Extrair nome da instância do payload
    const instanceName = body?.instance || "";

    // d. Lookup da WhatsAppInstance no banco pelo nome
    const whatsappInstance = instanceName
      ? await prisma.whatsAppInstance.findUnique({
          where: { evolutionInstanceName: instanceName },
        })
      : null;

    if (!whatsappInstance) {
      console.warn(`⚠️ [Evolution Webhook] Webhook recebido de instância desconhecida: ${instanceName}`);
      return NextResponse.json({ received: false, reason: "unknown_instance" }, { status: 200 });
    }

    // e. Validar apikey contra evolutionToken do banco (timing-safe)
    if (!secureCompare(whatsappInstance.evolutionToken, receivedKey)) {
      console.warn(`⛔ [Evolution Webhook] Token da instância não confere para: ${instanceName}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // f. (Opcional) Validar server_url contra EVOLUTION_SERVER_URL
    const serverUrl = body?.server_url;
    if (EVOLUTION_SERVER_URL && serverUrl && EVOLUTION_SERVER_URL !== serverUrl) {
      console.warn(`⛔ [Evolution Webhook] Acesso negado. server_url incompatível: ${serverUrl}`);
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { event, data } = body;

    // g. Logar evento de forma legível
    console.log(`\n🟢 [Evolution Webhook] Novo Evento Recebido`);
    console.log(`➡️ Instância: ${instanceName}`);
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

        // Integração com banco de dados (salvar conversa - Multi-tenant)
        if (messageData.key && !messageData.key.fromMe) {
          try {
            const result = await processIncomingMessage(
              body, 
              whatsappInstance.barbershopId, 
              whatsappInstance.id
            );
            console.log(`💾 Salvo: contact ${result.contactId}, message ${result.messageId}, vinculado a user: ${result.linked ? 'sim' : 'não'}`);
          } catch (processError) {
            console.error("❌ [Evolution Webhook] Erro ao salvar mensagem no banco:", processError);
            // IMPORTANTE: Não lançar o erro adiante. 
            // Já recebemos, apenas falhou em salvar. Retornar 200 pra Evolution parar de enviar.
          }
        }
      } else {
        console.log(`💬 Detalhes da Mensagem: Sem dados`);
      }
    } else {
      // Para outros tipos de eventos, logar apenas um resumo curto
      const resumo = data ? JSON.stringify(data).slice(0, 200) : "sem dados";
      console.log(`ℹ️ Resumo do Payload: ${resumo}${resumo.length >= 200 ? "..." : ""}`);
    }

    console.log(`--------------------------------------------------\n`);

    // h. Retornar 200 para a Evolution parar de tentar reenviar
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    // Capturar erros gerais sem derrubar a aplicação
    console.error("❌ [Evolution Webhook] Erro crítico ao processar webhook:", error);
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
