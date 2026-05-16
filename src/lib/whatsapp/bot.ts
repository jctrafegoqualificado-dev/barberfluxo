import { prisma } from "@/lib/prisma";
import * as evolution from "@/lib/evolution/client";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Lógica central do Chatbot de Agendamento (Multi-tenant)
 */
export async function handleWhatsAppBot(
  phoneNumber: string,
  text: string,
  barbershopId: string,
  instanceName: string,
  apiKey?: string
) {
  console.log(`🤖 [Bot] Handling for JID: ${phoneNumber}`);
  const cleanText = text.toLowerCase().trim();


  // 1. Buscar ou Criar Sessão
  let session = await prisma.whatsAppSession.findUnique({
    where: { phoneNumber_barbershopId: { phoneNumber, barbershopId } },
  });

  if (!session) {
    session = await prisma.whatsAppSession.create({
      data: { phoneNumber, barbershopId, state: "IDLE" },
    });
  }

  // 2. Máquina de Estados
  switch (session.state) {
    case "IDLE":
      if (cleanText.includes("agendar") || cleanText.includes("corte") || cleanText.includes("oi") || cleanText.includes("ola")) {
        return startScheduling(session, instanceName, apiKey);
      }
      break;

    case "SELECTING_SERVICE":
      return handleServiceSelection(session, cleanText, instanceName, apiKey);

    case "SELECTING_DATE":
      return handleDateSelection(session, cleanText, instanceName);

    case "SELECTING_BARBER":
      return handleBarberSelection(session, cleanText, instanceName);

    case "SELECTING_TIME":
      return handleTimeSelection(session, cleanText, instanceName);

    case "CONFIRMING":
      return handleConfirmation(session, cleanText, instanceName);

    default:
      await resetSession(session);
      await evolution.sendMessage(instanceName, phoneNumber, "Ops! Me perdi um pouco. Vamos recomeçar? Digite *AGENDAR* para iniciar.", 1000, apiKey);
  }
}

// ── Funções Auxiliares ──

async function startScheduling(session: any, instanceName: string, apiKey?: string) {
  const services = await prisma.service.findMany({
    where: { barbershopId: session.barbershopId, active: true },
    orderBy: { price: "asc" },
    take: 10,
  });

  if (services.length === 0) {
    return evolution.sendMessage(instanceName, session.phoneNumber, "Desculpe, não encontrei serviços disponíveis no momento. Entre em contato com a barbearia.", 1000, apiKey);
  }

  let menu = "✂️ *Escolha o Serviço*\n\nPor favor, digite o *NÚMERO* do serviço que deseja:\n\n";
  services.forEach((s, idx) => {
    menu += `*${idx + 1}* - ${s.name} (R$ ${s.price.toFixed(2)})\n`;
  });
  menu += "\nDigite apenas o número.";

  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: { state: "SELECTING_SERVICE" },
  });

  return evolution.sendMessage(instanceName, session.phoneNumber, menu, 1000, apiKey);
}

async function handleServiceSelection(session: any, text: string, instanceName: string, apiKey?: string) {
  const services = await prisma.service.findMany({
    where: { barbershopId: session.barbershopId, active: true },
    orderBy: { price: "asc" },
    take: 10,
  });

  // Tentar encontrar por número (índice 1-based) ou por nome
  let service = null;
  const index = parseInt(text) - 1;

  if (!isNaN(index) && services[index]) {
    service = services[index];
  } else {
    service = services.find(s => s.name.toLowerCase().includes(text));
  }

  if (!service) {
    return evolution.sendMessage(instanceName, session.phoneNumber, "Não entendi qual serviço você escolheu. Por favor, digite o *número* correspondente ao serviço.", 1000, apiKey);
  }

  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: { 
      state: "SELECTING_DATE",
      data: { serviceId: service.id, serviceName: service.name }
    }
  });

  let dateMenu = `✅ *${service.name}* selecionado!\n\nAgora, para *QUAL DIA* você deseja agendar?\n\n`;
  dateMenu += "*1* - Hoje\n";
  dateMenu += "*2* - Amanhã\n";
  dateMenu += "*3* - Outra data\n\n";
  dateMenu += "Digite o número da opção.";

  return evolution.sendMessage(instanceName, session.phoneNumber, dateMenu, 1000, apiKey);
}

// ... Outros handlers serão implementados conforme o fluxo avança

async function handleDateSelection(session: any, text: string, instanceName: string) {
  return evolution.sendMessage(instanceName, session.phoneNumber, "Funcionalidade em desenvolvimento (Data).");
}

async function handleBarberSelection(session: any, text: string, instanceName: string) {
  return evolution.sendMessage(instanceName, session.phoneNumber, "Funcionalidade em desenvolvimento (Barbeiro).");
}

async function handleTimeSelection(session: any, text: string, instanceName: string) {
  return evolution.sendMessage(instanceName, session.phoneNumber, "Funcionalidade em desenvolvimento (Horário).");
}

async function handleConfirmation(session: any, text: string, instanceName: string) {
  return evolution.sendMessage(instanceName, session.phoneNumber, "Funcionalidade em desenvolvimento (Confirmação).");
}
async function resetSession(session: any) {
  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: { state: "IDLE", data: {} }
  });
}
