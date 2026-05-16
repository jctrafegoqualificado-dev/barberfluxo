import { prisma } from "@/lib/prisma";
import { EvolutionWebhookBody } from "./types";
import { handleWhatsAppBot } from "./bot";

export async function processIncomingMessage(
  body: EvolutionWebhookBody,
  barbershopId: string,
  whatsappInstanceId: string
) {
  const { data } = body;
  if (!data || !data.key) throw new Error("Invalid message data");

  const { remoteJid, fromMe, id: evolutionId } = data.key;
  const pushName = data.pushName || null;
  const messageType = data.messageType || "unknown";
  
  // Extrair texto da mensagem (fallback)
  const textContent = data.message?.conversation || 
                      data.message?.extendedTextMessage?.text || 
                      null;

  const timestampDate = new Date(data.messageTimestamp * 1000);

  // Extrair telefone (somente números) do remoteJid
  const phoneDigits = remoteJid.split("@")[0].replace(/\D/g, "");
  const last9Digits = phoneDigits.slice(-9);

  // 2. Upsert do WhatsAppContact
  let contact = await prisma.whatsAppContact.upsert({
    where: { remoteJid_barbershopId: { remoteJid, barbershopId } },
    update: {
      lastSeenAt: timestampDate,
      ...(pushName ? { pushName } : {}),
      ...(phoneDigits ? { phone: phoneDigits } : {}),
      instanceId: whatsappInstanceId
    },
    create: {
      remoteJid,
      barbershopId,
      instanceId: whatsappInstanceId,
      phone: phoneDigits || null,
      pushName,
      firstSeenAt: timestampDate,
      lastSeenAt: timestampDate,
    }
  });

  // 4. Se não tem usuário vinculado, tentar achar
  let linked = false;
  if (!contact.userId && last9Digits.length === 9) {
    const user = await prisma.user.findFirst({
      where: {
        phone: { endsWith: last9Digits },
        // NOTA: O modelo User no schema.prisma é global e não possui o campo barbershopId.
        // Se quisermos restringir apenas a clientes que já agendaram ou são clientes da barbearia específica,
        // podemos adicionar uma checagem em appointments ou subscriptions no futuro.
      }
    });

    if (user) {
      contact = await prisma.whatsAppContact.update({
        where: { id: contact.id },
        data: { userId: user.id }
      });
      linked = true;
    }
  } else if (contact.userId) {
    linked = true;
  }

  // 3. Criar a WhatsAppMessage
  const message = await prisma.whatsAppMessage.upsert({
    where: { evolutionId },
    update: {}, // se já existe (reenvio), não altera nada importante
    create: {
      evolutionId,
      contactId: contact.id,
      barbershopId,
      instanceId: whatsappInstanceId,
      fromMe,
      messageType,
      textContent,
      rawPayload: body as any,
      timestamp: timestampDate
    }
  });

  // 5. Acionar lógica do Bot (se não for mensagem enviada por nós)
  if (!fromMe && textContent && !remoteJid.includes("g.us")) {
    const instance = await prisma.whatsAppInstance.findUnique({ where: { id: whatsappInstanceId } });
    if (instance) {
      try {
        await handleWhatsAppBot(
          remoteJid.split("@")[0],
          textContent,
          barbershopId,
          instance.evolutionInstanceName
        );
      } catch (err) {
        console.error("❌ [Bot Error]:", err);
      }
    }
  }

  return { contactId: contact.id, messageId: message.id, linked };
}
