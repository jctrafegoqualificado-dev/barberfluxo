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

  const { fromMe, id: evolutionId, remoteJid: keyRemoteJid } = data.key;
  const remoteJid = keyRemoteJid || body.sender || "desconhecido";
  
  // LOG DE AUDITORIA SÊNIOR - Vamos ver tudo o que vem no payload
  const remoteJidAlt = (data.key as any).remoteJidAlt || (data as any).remoteJidAlt || (body as any).remoteJidAlt;
  
  // Se não achou no JidAlt, tenta no 'number' ou no próprio sender
  const fallbackPhone = (data as any).number || (body as any).sender;
  
  let realJid = remoteJid;
  if (remoteJid.includes("@lid")) {
    if (remoteJidAlt) {
      realJid = remoteJidAlt.includes("@") ? remoteJidAlt : `${remoteJidAlt}@s.whatsapp.net`;
    } else if (fallbackPhone && !fallbackPhone.includes("@lid")) {
      realJid = fallbackPhone.includes("@") ? fallbackPhone : `${fallbackPhone}@s.whatsapp.net`;
    }
  }

  console.log(`🔍 [AUDITORIA] JID: ${remoteJid} | REAL_JID_DETECTADO: ${realJid}`);
 
  const pushName = data.pushName || null;
  const messageType = data.messageType || "unknown";
  
  // Extrair texto da mensagem (fallback)
  const textContent = data.message?.conversation || 
                      data.message?.extendedTextMessage?.text || 
                      null;

  const timestampDate = new Date(data.messageTimestamp * 1000);

  // Extrair telefone (somente números) do realJid (que agora é o número verdadeiro se for @lid)
  const phoneDigits = realJid.split("@")[0].replace(/\D/g, "");
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
        const result = await handleWhatsAppBot(
          realJid, // Usamos o JID Real (com telefone) para a lógica e sessão
          textContent,
          barbershopId,
          instance.evolutionInstanceName,
          instance.evolutionToken
        );
        console.log(`🤖 [Bot Result]`, JSON.stringify(result, null, 2));
      } catch (err) {
        console.error("❌ [Bot Error]:", err);
      }
    }
  }

  return { contactId: contact.id, messageId: message.id, linked };
}
