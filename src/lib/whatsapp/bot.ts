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

async function handleDateSelection(session: any, text: string, instanceName: string, apiKey?: string) {
  const option = text.replace(/\D/g, "");
  let selectedDate = new Date();

  if (option === "1") {
    // Hoje - já está setado
  } else if (option === "2") {
    selectedDate = addDays(new Date(), 1);
  } else if (option === "3") {
    // Mostrar próximos 7 dias como lista
    let listMenu = "📅 *Escolha uma Data*\n\nDigite o número correspondente:\n\n";
    for (let i = 0; i < 7; i++) {
      const d = addDays(new Date(), i);
      listMenu += `*${i + 1}* - ${format(d, "EEEE, dd/MM", { locale: ptBR })}\n`;
    }
    listMenu += "\nOu digite a data no formato *DD/MM*.";
    
    // Mantemos no mesmo estado, mas enviamos a lista
    return evolution.sendMessage(instanceName, session.phoneNumber, listMenu, 1000, apiKey);
  } else if (text.includes("/")) {
    const [day, month] = text.split("/").map(Number);
    selectedDate.setMonth(month - 1);
    selectedDate.setDate(day);
  } else {
    // Tentar interpretar número da lista do "Ver outros dias"
    const idx = parseInt(option) - 1;
    if (idx >= 0 && idx < 7) {
      selectedDate = addDays(new Date(), idx);
    } else {
      return evolution.sendMessage(instanceName, session.phoneNumber, "Opção inválida. Escolha 1 para Hoje, 2 para Amanhã ou digite a data (DD/MM).", 1000, apiKey);
    }
  }

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  
  // Buscar barbeiros disponíveis para essa unidade
  const barbers = await prisma.barber.findMany({
    where: { barbershopId: session.barbershopId, active: true },
    include: { user: { select: { name: true } } }
  });

  if (barbers.length === 0) {
    return evolution.sendMessage(instanceName, session.phoneNumber, "Não há barbeiros disponíveis nesta unidade.", 1000, apiKey);
  }

  // Se houver apenas 1 barbeiro, já seleciona ele automaticamente e vai para horários
  if (barbers.length === 1) {
    const barber = barbers[0];
    await prisma.whatsAppSession.update({
      where: { id: session.id },
      data: {
        state: "SELECTING_TIME",
        data: { 
          ...session.data as any, 
          date: dateStr, 
          barberId: barber.id,
          barberName: barber.user.name 
        }
      }
    });
    return showAvailableTimes(session.phoneNumber, dateStr, barber.id, session.data.serviceId, instanceName, apiKey);
  }

  // Se houver mais de um, pede para escolher
  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: {
      state: "SELECTING_BARBER",
      data: { ...session.data as any, date: dateStr }
    }
  });

  let barberMenu = `📅 Data: *${format(selectedDate, "dd/MM", { locale: ptBR })}*\n\n💈 *Escolha o Barbeiro*\n\n`;
  barbers.forEach((b, idx) => {
    barberMenu += `*${idx + 1}* - ${b.user.name} ${b.nickname ? `(${b.nickname})` : ""}\n`;
  });
  barberMenu += "\nDigite o número do barbeiro.";

  return evolution.sendMessage(instanceName, session.phoneNumber, barberMenu, 1000, apiKey);
}

async function handleBarberSelection(session: any, text: string, instanceName: string, apiKey?: string) {
  const barbers = await prisma.barber.findMany({
    where: { barbershopId: session.barbershopId, active: true },
    include: { user: { select: { name: true } } }
  });

  const index = parseInt(text.replace(/\D/g, "")) - 1;
  const barber = barbers[index];

  if (!barber) {
    return evolution.sendMessage(instanceName, session.phoneNumber, "Opção inválida. Digite o número do barbeiro da lista.", 1000, apiKey);
  }

  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: {
      state: "SELECTING_TIME",
      data: { 
        ...session.data as any, 
        barberId: barber.id,
        barberName: barber.user.name 
      }
    }
  });

  return showAvailableTimes(session.phoneNumber, (session.data as any).date, barber.id, (session.data as any).serviceId, instanceName, apiKey);
}

async function showAvailableTimes(phoneNumber: string, dateStr: string, barberId: string, serviceId: string, instanceName: string, apiKey?: string) {
  const slots = await getAvailableSlots(barberId, serviceId, dateStr);

  if (slots.length === 0) {
    return evolution.sendMessage(instanceName, phoneNumber, "Desculpe, não há horários disponíveis para este barbeiro nesta data. Por favor, escolha outra data ou outro barbeiro. Digite *AGENDAR* para recomeçar.", 1000, apiKey);
  }

  let timeMenu = `⏰ *Escolha o Horário*\nData: ${format(new Date(dateStr + "T12:00:00"), "dd/MM")}\n\n`;
  
  // Dividir em colunas ou lista simples
  slots.forEach((s, idx) => {
    timeMenu += `*${idx + 1}* - ${s}\n`;
  });
  timeMenu += "\nDigite o número do horário desejado.";

  return evolution.sendMessage(instanceName, phoneNumber, timeMenu, 1000, apiKey);
}

async function handleTimeSelection(session: any, text: string, instanceName: string, apiKey?: string) {
  const data = session.data as any;
  const slots = await getAvailableSlots(data.barberId, data.serviceId, data.date);

  const index = parseInt(text.replace(/\D/g, "")) - 1;
  const slot = slots[index];

  if (!slot) {
    return evolution.sendMessage(instanceName, session.phoneNumber, "Horário inválido. Escolha um número da lista.", 1000, apiKey);
  }

  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: {
      state: "CONFIRMING",
      data: { ...data, startTime: slot }
    }
  });

  const summary = `📝 *Confirmação de Agendamento*\n\n` +
    `✂️ Serviço: *${data.serviceName}*\n` +
    `💈 Barbeiro: *${data.barberName}*\n` +
    `📅 Data: *${format(new Date(data.date + "T12:00:00"), "dd/MM/yyyy")}*\n` +
    `⏰ Horário: *${slot}*\n\n` +
    `Podemos confirmar? Digite *1* para SIM ou *2* para CANCELAR.`;

  return evolution.sendMessage(instanceName, session.phoneNumber, summary, 1000, apiKey);
}

async function handleConfirmation(session: any, text: string, instanceName: string, apiKey?: string) {
  const option = text.replace(/\D/g, "");

  if (option === "2") {
    await resetSession(session);
    return evolution.sendMessage(instanceName, session.phoneNumber, "Agendamento cancelado. Se precisar de algo, é só chamar! 👋", 1000, apiKey);
  }

  if (option !== "1") {
    return evolution.sendMessage(instanceName, session.phoneNumber, "Por favor, digite *1* para Confirmar ou *2* para Cancelar.", 1000, apiKey);
  }

  const data = session.data as any;

  try {
    // 1. Encontrar ou criar o cliente
    let contact = await prisma.whatsAppContact.findUnique({
      where: { remoteJid_barbershopId: { remoteJid: session.phoneNumber, barbershopId: session.barbershopId } }
    });

    let clientId = contact?.userId;

    if (!clientId) {
      // Se não tem usuário vinculado, procura por telefone ou cria um
      const phoneDigits = session.phoneNumber.split("@")[0];
      let user = await prisma.user.findFirst({
        where: { phone: phoneDigits }
      });

      if (!user) {
        // Criar usuário cliente básico
        user = await prisma.user.create({
          data: {
            name: contact?.pushName || "Cliente WhatsApp",
            phone: phoneDigits,
            email: `${phoneDigits}@whatsapp.com`,
            password: Math.random().toString(36).slice(-8), // Senha aleatória
            role: "CLIENT"
          }
        });
      }
      clientId = user.id;

      // Vincular contato ao usuário
      if (contact) {
        await prisma.whatsAppContact.update({
          where: { id: contact.id },
          data: { userId: clientId }
        });
      }
    }

    // 2. Calcular endTime baseado na duração do serviço
    const service = await prisma.service.findUnique({ where: { id: data.serviceId } });
    if (!service) throw new Error("Serviço não encontrado");

    const [h, m] = data.startTime.split(":").map(Number);
    const startMinutes = h * 60 + m;
    const endMinutes = startMinutes + service.duration;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    // 3. Criar agendamento
    const appointment = await prisma.appointment.create({
      data: {
        barbershopId: session.barbershopId,
        barberId: data.barberId,
        serviceId: data.serviceId,
        clientId: clientId!,
        date: new Date(data.date + "T12:00:00"),
        startTime: data.startTime,
        endTime: endTime,
        price: service.price,
        status: "PENDING"
      }
    });

    await resetSession(session);

    const successMsg = `✅ *AGENDADO COM SUCESSO!* ✂️\n\n` +
      `Tudo pronto, agendamento confirmado para o dia ${format(appointment.date, "dd/MM")} às ${appointment.startTime}.\n\n` +
      `Esperamos você! 👋`;

    return evolution.sendMessage(instanceName, session.phoneNumber, successMsg, 1000, apiKey);

  } catch (error) {
    console.error("❌ [Bot] Error booking:", error);
    return evolution.sendMessage(instanceName, session.phoneNumber, "Puxa, tive um erro ao finalizar seu agendamento. Por favor, tente novamente em instantes ou ligue para a barbearia.", 1000, apiKey);
  }
}

async function getAvailableSlots(barberId: string, serviceId: string, date: string) {
  // Reimplementação da lógica da API de Slots
  const [service, barber] = await Promise.all([
    prisma.service.findUnique({ where: { id: serviceId } }),
    prisma.barber.findUnique({ where: { id: barberId, active: true }, include: { barbershop: true } }),
  ]);

  if (!service || !barber) return [];

  const d = new Date(date + "T12:00:00");
  const dayOfWeek = d.getDay();

  if (barber.dayOff !== null && barber.dayOff === dayOfWeek) return [];

  const openingHour = await prisma.openingHour.findFirst({
    where: { barbershopId: barber.barbershopId, dayOfWeek, isOpen: true },
  });
  if (!openingHour) return [];

  const [openH, openM] = openingHour.openTime.split(":").map(Number);
  const [closeH, closeM] = openingHour.closeTime.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  const brNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const todayBR = `${brNow.getFullYear()}-${String(brNow.getMonth() + 1).padStart(2, "0")}-${String(brNow.getDate()).padStart(2, "0")}`;
  const isToday = date === todayBR;
  const nowMinutes = isToday ? brNow.getHours() * 60 + brNow.getMinutes() + 15 : 0;

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

  const [existing, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: { barberId, date: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
    }),
    prisma.scheduleBlock.findMany({
      where: { barberId, date: { gte: dayStart, lte: dayEnd } },
    }),
  ]);

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const slots: string[] = [];
  for (let m = openMinutes; m + service.duration <= closeMinutes; m += 15) {
    if (isToday && m < nowMinutes) continue;

    const slotEnd = m + service.duration;
    const apptConflict = existing.some((a) => {
      const aStart = toMin(a.startTime);
      const aEnd = toMin(a.endTime);
      return m < aEnd && slotEnd > aStart;
    });

    const blockConflict = blocks.some((b) => {
      const bStart = toMin(b.startTime);
      const bEnd = toMin(b.endTime);
      return m < bEnd && slotEnd > bStart;
    });

    if (!apptConflict && !blockConflict) {
      const hh = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }

  return slots;
}

async function resetSession(session: any) {
  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: { state: "IDLE", data: {} }
  });
}

