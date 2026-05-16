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
  instanceName: string
) {
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
        return startScheduling(session, instanceName);
      }
      break;

    case "SELECTING_SERVICE":
      return handleServiceSelection(session, cleanText, instanceName);

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
      await evolution.sendMessage(instanceName, phoneNumber, "Ops! Me perdi um pouco. Vamos recomeçar? Digite *AGENDAR* para iniciar.");
  }
}

// ── Funções Auxiliares ──

async function startScheduling(session: any, instanceName: string) {
  const services = await prisma.service.findMany({
    where: { barbershopId: session.barbershopId, active: true },
    take: 10,
  });

  if (services.length === 0) {
    return evolution.sendMessage(instanceName, session.phoneNumber, "Desculpe, não encontrei serviços disponíveis no momento. Entre em contato com a barbearia.");
  }

  const sections = [
    {
      title: "Serviços Disponíveis",
      rows: services.map((s, idx) => ({
        title: s.name,
        description: `R$ ${s.price.toFixed(2)} · ${s.duration}min`,
        rowId: `svc_${s.id}`,
      })),
    },
  ];

  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: { state: "SELECTING_SERVICE" },
  });

  return evolution.sendList(
    instanceName,
    session.phoneNumber,
    "Escolha o Serviço",
    "Por favor, selecione o serviço que deseja realizar:",
    "Ver Serviços",
    sections
  );
}

async function handleServiceSelection(session: any, text: string, instanceName: string) {
  // A Evolution envia o rowId no payload, mas aqui estamos simplificando por texto por enquanto
  // Em uma implementação real, o webhook passaria o rowId extraído.
  // Vou simular buscando pelo nome se for texto.
  const service = await prisma.service.findFirst({
    where: { 
      barbershopId: session.barbershopId, 
      name: { mode: "insensitive", contains: text } 
    }
  });

  if (!service) {
    return evolution.sendMessage(instanceName, session.phoneNumber, "Não entendi qual serviço você escolheu. Por favor, clique na lista e selecione um.");
  }

  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: { 
      state: "SELECTING_DATE",
      data: { serviceId: service.id, serviceName: service.name }
    }
  });

  const buttons = [
    { buttonId: "date_0", buttonText: { displayText: "Hoje" }, type: 1 },
    { buttonId: "date_1", buttonText: { displayText: "Amanhã" }, type: 1 },
    { buttonId: "date_custom", buttonText: { displayText: "Outra Data" }, type: 1 },
  ];

  return evolution.sendButtons(
    instanceName,
    session.phoneNumber,
    "Para quando?",
    `Ótima escolha! Você selecionou: *${service.name}*.\nPara qual dia deseja agendar?`,
    buttons
  );
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
