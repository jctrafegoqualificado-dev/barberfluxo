/**
 * Seed de HOMOLOGAÇÃO — dados fictícios para avaliar o redesign com todas as telas cheias.
 *
 *   npm run homolog:seed
 *
 * APAGA tudo do banco antes de popular. Por isso só roda via scripts/homolog.mjs,
 * que garante que o DATABASE_URL não é o de produção (e define HOMOLOG=1).
 *
 * IDs da barbearia, do dono e dos barbeiros são fixos: o login (token) continua valendo
 * depois de rodar o seed de novo.
 *
 * Gera ~3 meses de histórico + 2 semanas de agenda futura de uma barbearia principal,
 * mais duas barbearias secundárias para as telas da plataforma. Determinístico:
 * rodar de novo gera os mesmos dados (relativos à data de hoje).
 *
 * Logins (senha 123456):
 *   dono@barberapp.com       → dono da Barbearia Demo
 *   barbeiro@barberapp.com   → barbeiro (Pedro)
 *   admin@barberapp.com      → admin da plataforma
 */
import { PrismaClient, type Barber, type Product } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.HOMOLOG !== "1") {
  console.error("❌ Este seed apaga o banco inteiro. Rode com: npm run homolog:seed");
  process.exit(1);
}

const prisma = new PrismaClient();

// ── Utilitários ──────────────────────────────────────────────────────────────

// PRNG determinístico (mulberry32) — mesmos dados a cada execução.
let seed = 20261015;
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const TZ = "America/Sao_Paulo";
const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const fmtHour = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

const now = new Date();
const TODAY = fmtDay.format(now); // "2026-10-15"
const NOW_MIN = (() => { const [h, m] = fmtHour.format(now).split(":").map(Number); return h * 60 + m; })();

/** "YYYY-MM-DD" deslocado N dias a partir de hoje (fuso de São Paulo). */
function day(offset: number) {
  const d = new Date(TODAY + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
/** Mesmo formato que o app grava em Appointment.date. */
const apptDate = (dayStr: string) => new Date(dayStr + "T12:00:00Z");
/** Timestamp no horário local de SP (UTC-3). */
const at = (dayStr: string, hhmm = "12:00") => new Date(`${dayStr}T${hhmm}:00-03:00`);
const month = (dayStr: string) => dayStr.slice(0, 7);
const weekday = (dayStr: string) => new Date(dayStr + "T12:00:00Z").getUTCDay();
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
function addMonths(dayStr: string, n: number) {
  const d = new Date(dayStr + "T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

// ── Reset ────────────────────────────────────────────────────────────────────

async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);
}

// ── Dados base ───────────────────────────────────────────────────────────────

const FIRST = ["Lucas", "Gabriel", "Matheus", "Rafael", "Gustavo", "Felipe", "Bruno", "Thiago", "Diego", "André",
  "Vinícius", "Rodrigo", "Leonardo", "Eduardo", "Marcelo", "Caio", "Henrique", "Igor", "João", "Daniel",
  "Fernando", "Otávio", "Renan", "Samuel", "Murilo", "Arthur", "Enzo", "Davi", "Paulo", "Ricardo",
  "Vitor", "Alexandre", "Fábio", "Leandro", "Wesley", "Kaique", "Nicolas", "Heitor", "Bernardo", "Pietro"];
const LAST = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento",
  "Lima", "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha", "Ribeiro", "Barbosa", "Cardoso", "Teixeira"];

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, ".");

async function main() {
  console.log(`🧹 Limpando banco de homologação…`);
  await resetDatabase();

  const hash = await bcrypt.hash("123456", 12);
  const PASSWORD = hash;

  // ── Plataforma ─────────────────────────────────────────────────────────────
  await prisma.user.create({
    data: { id: "hm_user_admin", name: "Admin Plataforma", email: "admin@barberapp.com", password: PASSWORD, role: "PLATFORM_ADMIN", isPlatformAdmin: true },
  });

  // ── Barbearia principal ────────────────────────────────────────────────────
  const owner = await prisma.user.create({
    data: { id: "hm_user_dono", name: "João Dono", email: "dono@barberapp.com", password: PASSWORD, role: "OWNER", phone: "41999990001" },
  });

  const shop = await prisma.barbershop.create({
    data: {
      id: "hm_shop_demo",
      name: "Barbearia Demo",
      slug: "barbearia-demo",
      ownerId: owner.id,
      description: "Corte clássico, barba na navalha e atendimento sem pressa.",
      phone: "41999990000",
      contactEmail: "contato@barbeariademo.com.br",
      instagram: "@barbeariademo",
      cnpj: "12.345.678/0001-90",
      zipCode: "80010-000",
      address: "Rua das Tesouras",
      streetNumber: "123",
      neighborhood: "Centro",
      city: "Curitiba",
      state: "PR",
      primaryColor: "#C94F0C",
      secondaryColor: "#1B1916",
      onboardingCompleted: true,
      saasPlan: "ELITE",
      saasStatus: "ACTIVE",
      saasExpiresAt: at(day(24)),
      debitFee: 1.99,
      creditFee: 3.49,
      reminderEnabled: true,
      reminderMinutes: 120,
      reminderMessage: "Olá {{nome}}, lembrete do seu horário de {{servico}} às {{hora}}. Até já!",
      retentionEnabled: true,
      retentionDays: 45,
      retentionMessage: "Fala {{nome}}! Já faz {{dias}} dias desde seu último corte na {{empresa}}. Bora agendar?",
      blockOverdueEnabled: true,
      discountServicesEnabled: true,
      discountProductsEnabled: true,
      aiAssistantName: "Zé da Navalha",
      aiPersonality: "Simpático, direto e informal. Usa no máximo um emoji por mensagem.",
      aiIdioma: "pt-BR",
      aiMensagemBoasVindas: "Fala! Aqui é o Zé, assistente da Barbearia Demo. Quer agendar um horário?",
      aiMensagemAusencia: "Estamos fechados agora, mas já deixo seu horário reservado. Qual dia fica bom?",
      openingHours: {
        create: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
          dayOfWeek: d,
          openTime: d === 6 ? "08:00" : "09:00",
          closeTime: d === 6 ? "18:00" : "20:00",
          isOpen: d !== 0,
        })),
      },
      specialDays: {
        create: [
          { date: `${TODAY.slice(0, 4)}-12-25`, isClosed: true, reason: "Natal" },
          { date: day(9), isClosed: false, openTime: "09:00", closeTime: "14:00", reason: "Meio período — treinamento da equipe" },
        ],
      },
      whatsappInstance: {
        create: {
          evolutionInstanceName: "homolog-barbearia-demo",
          evolutionToken: "homolog-token-ficticio",
          status: "CONNECTED",
          lastConnectedAt: at(day(-2), "08:30"),
        },
      },
    },
    include: { whatsappInstance: true, openingHours: true },
  });

  // ── Barbeiros ──────────────────────────────────────────────────────────────
  const barberDefs = [
    { name: "Pedro Almeida", email: "barbeiro@barberapp.com", nickname: "Pedrão", commission: 50, dayOff: 1, workStart: null, workEnd: null, active: true, onVacation: false },
    { name: "Lucas Ferreira", email: "lucas@barberapp.com", nickname: "Lucas", commission: 45, dayOff: 2, workStart: null, workEnd: null, active: true, onVacation: false },
    { name: "Rafael Moreira", email: "rafael@barberapp.com", nickname: "Rafa", commission: 40, dayOff: 3, workStart: "11:00", workEnd: "20:00", active: true, onVacation: false },
    { name: "Mateus Lima", email: "mateus@barberapp.com", nickname: "Teteu", commission: 40, dayOff: null, workStart: null, workEnd: null, active: false, onVacation: true },
  ];
  const barbers: (Barber & { def: (typeof barberDefs)[number] })[] = [];
  for (const b of barberDefs) {
    const user = await prisma.user.create({
      data: { id: `hm_user_barber_${barbers.length}`, name: b.name, email: b.email, password: PASSWORD, role: "BARBER", phone: `4198888${String(barbers.length).padStart(4, "0")}` },
    });
    const barber = await prisma.barber.create({
      data: {
        id: `hm_barber_${barbers.length}`,
        userId: user.id, barbershopId: shop.id, nickname: b.nickname, commission: b.commission,
        dayOff: b.dayOff, workStart: b.workStart, workEnd: b.workEnd, active: b.active, onVacation: b.onVacation,
        bio: "Especialista em degradê e barba.", productCommission: 10,
      },
    });
    barbers.push({ ...barber, def: b });
  }

  // ── Serviços ───────────────────────────────────────────────────────────────
  const serviceDefs = [
    { name: "Corte de Cabelo", price: 45, duration: 30, materialCost: 2 },
    { name: "Barba", price: 35, duration: 30, materialCost: 3 },
    { name: "Corte + Barba", price: 70, duration: 60, materialCost: 5 },
    { name: "Pigmentação", price: 40, duration: 30, materialCost: 8, onlineBooking: false }, // só pelo balcão
    { name: "Sobrancelha", price: 15, duration: 15, materialCost: 0 },
    { name: "Hidratação", price: 30, duration: 30, materialCost: 6 },
  ];
  const services = [];
  for (const s of serviceDefs) services.push(await prisma.service.create({ data: { ...s, barbershopId: shop.id } }));
  const [svCorte, svBarba, svCombo, svPigm, svSobr, svHidr] = services;
  // Peso de cada serviço na escolha aleatória de agendamentos avulsos.
  const serviceWeights: [typeof services[number], number][] = [[svCorte, 40], [svCombo, 25], [svBarba, 15], [svPigm, 7], [svSobr, 8], [svHidr, 5]];
  const pickService = () => {
    let r = rand() * 100;
    for (const [s, w] of serviceWeights) { if ((r -= w) < 0) return s; }
    return svCorte;
  };

  // ── Produtos ───────────────────────────────────────────────────────────────
  const productDefs = [
    { name: "Pomada Modeladora", price: 45, costPrice: 18, stock: 24, category: "CABELO" },
    { name: "Óleo para Barba", price: 39, costPrice: 15, stock: 12, category: "BARBA" },
    { name: "Shampoo Anticaspa", price: 35, costPrice: 14, stock: 3, category: "CABELO" },
    { name: "Balm Pós-Barba", price: 42, costPrice: 17, stock: 9, category: "BARBA" },
    { name: "Minoxidil 5%", price: 89, costPrice: 40, stock: 2, category: "SKINCARE" },
    { name: "Pente de Madeira", price: 25, costPrice: 8, stock: 30, category: "GERAL" },
  ];
  const products: Product[] = [];
  for (const p of productDefs) products.push(await prisma.product.create({ data: { ...p, barbershopId: shop.id } }));

  // ── Planos ─────────────────────────────────────────────────────────────────
  const planCorte = await prisma.plan.create({
    data: {
      name: "Clube do Corte", description: "4 cortes por mês", price: 120, maxUses: 4, barbershopId: shop.id, extraDiscount: 10,
      planServices: { create: [{ serviceId: svCorte.id, quantity: 4 }] },
    },
  });
  const planCombo = await prisma.plan.create({
    data: {
      name: "Corte + Barba Ilimitado", description: "Corte e barba sem limite (1x por semana)", price: 189, maxUses: null, barbershopId: shop.id,
      commissionPercentage: 35, extraDiscount: 15,
      planServices: { create: [{ serviceId: svCorte.id }, { serviceId: svBarba.id }] },
    },
  });
  const planFamilia = await prisma.plan.create({
    data: {
      name: "Plano Família", description: "Pai + filho, 4 cortes cada", price: 199, maxUses: 8, barbershopId: shop.id,
      beneficiaryRules: [{ name: "Titular", maxUses: 4 }, { name: "Dependente", maxUses: 4 }],
      planServices: { create: [{ serviceId: svCorte.id, quantity: 8 }] },
    },
  });
  const plans = [planCorte, planCombo, planFamilia];

  // ── Clientes ───────────────────────────────────────────────────────────────
  // Cada cliente tem um "ritmo" (dias entre visitas) e pode ter sumido (churn),
  // para alimentar as telas de retenção, frequência e ficha do cliente.
  type Client = { id: string; name: string; phone: string; every: number; lastActive: number; favBarber: number };
  const clients: Client[] = [];
  for (let i = 0; i < 48; i++) {
    const name = `${FIRST[i % FIRST.length]} ${pick(LAST)}`;
    const phone = `4199${String(1000000 + i * 7919).slice(-7)}`;
    const birthday = i % 6 === 0
      ? new Date(`${1985 + (i % 20)}-${TODAY.slice(5, 7)}-${String(int(1, 28)).padStart(2, "0")}T12:00:00Z`) // aniversariante do mês
      : new Date(`${1980 + (i % 25)}-${String(int(1, 12)).padStart(2, "0")}-${String(int(1, 28)).padStart(2, "0")}T12:00:00Z`);
    const user = await prisma.user.create({
      data: {
        name, phone, birthday, role: "CLIENT", password: PASSWORD,
        email: `${slug(name)}.${i}@cliente.homolog`,
        createdAt: at(day(-int(95, 400))),
      },
    });
    const churned = i % 7 === 3; // ~14% sumiram há mais de 45 dias
    clients.push({
      id: user.id, name, phone,
      every: pick([7, 14, 14, 21, 21, 30, 30, 45]),
      lastActive: churned ? -int(50, 80) : 0,
      favBarber: int(0, 2),
    });
  }

  // ── Observações da barbearia sobre alguns clientes ────────────────────────
  const notes = [
    "Gosta de degradê médio. Prefere horário depois das 17h.",
    "Alergia a pomada com álcool — usar a linha sem álcool.",
    "Sempre pede a máquina 2 nas laterais e tesoura em cima.",
    "Chega uns 10 min antes. Gosta de café sem açúcar.",
    "Barba desenhada, sem marcar muito o pescoço.",
    "Indicou 3 amigos. Tratar com carinho!",
  ];
  await prisma.clientNote.createMany({
    data: notes.map((content, i) => ({ clientId: clients[i * 3].id, barbershopId: shop.id, content, updatedBy: owner.name })),
  });

  // ── Assinaturas ────────────────────────────────────────────────────────────
  type Sub = { id: string; clientIdx: number; planId: string; status: string; cycleStart: string; family: boolean };
  const subs: Sub[] = [];
  const subDefs = [
    // [cliente, plano, status, dia de início (offset)]
    [0, 0, "ACTIVE", -70], [1, 0, "ACTIVE", -40], [2, 1, "ACTIVE", -85], [3, 1, "ACTIVE", -20],
    [4, 0, "ACTIVE", -55], [5, 2, "ACTIVE", -60], [6, 1, "ACTIVE", -12], [8, 0, "ACTIVE", -30],
    [9, 1, "OVERDUE", -75], [11, 0, "OVERDUE", -50], [12, 2, "ACTIVE", -33], [13, 0, "CANCELLED", -90],
    [14, 0, "PAUSED", -65],
  ] as const;
  for (const [ci, pi, status, startOffset] of subDefs) {
    const plan = plans[pi];
    const start = day(startOffset);
    // Ciclo atual: último aniversário mensal do início que já passou.
    let cycleStart = start;
    while (addMonths(cycleStart, 1) <= TODAY) cycleStart = addMonths(cycleStart, 1);
    const nextBilling = status === "OVERDUE" ? day(-int(3, 9)) : addMonths(cycleStart, 1);
    const family = plan.id === planFamilia.id;
    const auto = ci % 3 === 0;
    const sub = await prisma.subscription.create({
      data: {
        clientId: clients[ci].id, barbershopId: shop.id, planId: plan.id, status,
        startDate: at(start), createdAt: at(start), nextBillingDate: at(nextBilling),
        billingDay: Number(start.slice(8, 10)),
        authorizationStatus: auto && status === "ACTIVE" ? "AUTHORIZED" : status === "OVERDUE" && auto ? "FAILED" : "MANUAL",
        paymentMethod: pick(["PIX", "PIX", "CASH", "CARD"]),
        beneficiaries: family
          ? [{ name: `${clients[ci].name.split(" ")[0]} (Titular)`, uses: 0, maxUses: 4 }, { name: "Miguel (Filho)", uses: 0, maxUses: 4 }]
          : undefined,
      },
    });
    subs.push({ id: sub.id, clientIdx: ci, planId: plan.id, status, cycleStart, family });

    // Pagamentos de cada ciclo (o atual fica pendente se inadimplente).
    for (let c = start; c <= TODAY; c = addMonths(c, 1)) {
      const isCurrent = addMonths(c, 1) > TODAY;
      if (status === "CANCELLED" && c > day(-60)) break;
      if (status === "OVERDUE" && isCurrent) {
        await prisma.payment.create({ data: { amount: plan.price, method: "PIX", status: "PENDING", subscriptionId: sub.id, barbershopId: shop.id, createdAt: at(c) } });
        break;
      }
      await prisma.payment.create({
        data: {
          amount: plan.price, method: auto ? "CREDIT_CARD" : pick(["PIX", "CASH"]), status: "PAID",
          paidAt: at(c, "10:00"), createdAt: at(c), subscriptionId: sub.id, barbershopId: shop.id,
          gatewayType: auto ? "mercadopago" : null,
        },
      });
    }
  }
  const subByClient = new Map(subs.filter((s) => s.status === "ACTIVE" || s.status === "OVERDUE").map((s) => [s.clientIdx, s]));

  // ── Agenda: 90 dias atrás até 14 dias à frente ─────────────────────────────
  const hours = new Map(shop.openingHours.map((h) => [h.dayOfWeek, h]));
  const appts: any[] = [];
  const apptServices: any[] = [];
  const doneAppts: { id: string; day: string; clientIdx: number; barberIdx: number; price: number; avulso: boolean }[] = [];
  const lastVisit = new Map<number, number>(); // cliente → offset da última visita agendada
  let seq = 0;

  for (let offset = -90; offset <= 14; offset++) {
    const d = day(offset);
    const oh = hours.get(weekday(d));
    if (!oh?.isOpen) continue;
    const special = offset === 9 ? { open: "09:00", close: "14:00" } : null;

    // Ocupação: passado ~65%, hoje ~75%, futuro cai com a distância.
    const occupancy = offset < 0 ? 0.62 + rand() * 0.12 : offset === 0 ? 0.75 : Math.max(0.12, 0.6 - offset * 0.035);

    barbers.forEach((barber, bIdx) => {
      const def = barber.def;
      if (def.dayOff === weekday(d)) return;
      if (def.onVacation && offset > -20) return; // de férias nas últimas 3 semanas
      const open = Math.max(toMin(special?.open ?? oh.openTime), def.workStart ? toMin(def.workStart) : 0);
      const close = Math.min(toMin(special?.close ?? oh.closeTime), def.workEnd ? toMin(def.workEnd) : 24 * 60);

      for (let t = open; t + 30 <= close; ) {
        if (t >= 12 * 60 && t < 13 * 60 && chance(0.7)) { t += 30; continue; } // almoço
        if (!chance(occupancy)) { t += 30; continue; }

        // Escolhe cliente: preferência por quem "está na hora" de voltar.
        let ci = int(0, clients.length - 1);
        for (let k = 0; k < 6; k++) {
          const c = clients[ci];
          const due = (lastVisit.get(ci) ?? -999) + c.every <= offset;
          const alive = c.lastActive === 0 || offset <= c.lastActive;
          if (due && alive) break;
          ci = int(0, clients.length - 1);
        }
        const client = clients[ci];
        if (client.lastActive !== 0 && offset > client.lastActive) { t += 30; continue; }

        const sub = subByClient.get(ci);
        const useSub = sub && offset >= -60 && chance(0.85);
        let svcList = useSub
          ? sub!.planId === planCombo.id ? [svCorte, svBarba] : [svCorte]
          : [pickService()];
        if (!useSub && svcList[0] === svCorte && chance(0.15)) svcList = [svCorte, svSobr];
        const duration = svcList.reduce((s, x) => s + x.duration, 0);
        if (t + duration > close) break;

        const start = toHHMM(t);
        const end = toHHMM(t + duration);
        const price = svcList.reduce((s, x) => s + x.price, 0);

        let status: string;
        if (offset < 0) status = chance(0.86) ? "DONE" : chance(0.5) ? "NO_SHOW" : "CANCELLED";
        else if (offset === 0) status = t + duration <= NOW_MIN ? (chance(0.92) ? "DONE" : "NO_SHOW") : chance(0.8) ? "CONFIRMED" : "PENDING";
        else status = chance(0.7) ? "CONFIRMED" : "PENDING";

        const id = `hm_appt_${++seq}`;
        const hasExtra = useSub && status === "DONE" && chance(0.15);
        const tip = status === "DONE" && chance(0.08) ? pick([5, 10, 10, 15, 20]) : 0;
        // Check-in: quem foi atendido chegou um pouco antes; hoje, quem está prestes a ser atendido também.
        const arrived = status === "DONE" || status === "NO_SHOW" ? status === "DONE"
          : offset === 0 && t - NOW_MIN <= 15 && t - NOW_MIN > -60;
        appts.push({
          id, date: apptDate(d), startTime: start, endTime: end, status, price,
          paymentMethod: status === "DONE" && !useSub ? pick(["PIX", "PIX", "PIX", "CASH", "DEBIT", "CREDIT"]) : useSub ? null : "CASH",
          extraPrice: hasExtra ? svSobr.price : 0,
          tipAmount: tip,
          tipPaymentMethod: tip > 0 ? pick(["PIX", "CASH"]) : null,
          arrivedAt: arrived ? at(d, toHHMM(Math.max(0, t - int(2, 12)))) : null,
          extraPaymentMethod: hasExtra ? "PIX" : null,
          discountPercent: !useSub && status === "DONE" && chance(0.05) ? 10 : 0,
          clientId: client.id, barbershopId: shop.id, barberId: barber.id, serviceId: svcList[0].id,
          subscriptionId: useSub ? sub!.id : null,
          beneficiaryName: useSub && sub!.family ? (chance(0.5) ? `${client.name.split(" ")[0]} (Titular)` : "Miguel (Filho)") : null,
          reminderSent: offset < 0 || (offset === 0 && status !== "PENDING"),
          notes: chance(0.06) ? pick(["Prefere máquina 2 nas laterais", "Alergia a pomada com álcool", "Chega sempre 10 min antes"]) : null,
          createdAt: at(day(offset - int(0, 6)), toHHMM(int(8 * 60, 21 * 60))),
        });
        for (const s of svcList) apptServices.push({ appointmentId: id, serviceId: s.id, price: s.price, duration: s.duration });
        if (status !== "CANCELLED") lastVisit.set(ci, offset);
        if (status === "DONE") doneAppts.push({ id, day: d, clientIdx: ci, barberIdx: bIdx, price, avulso: !useSub });

        t += duration;
      }
    });
  }

  console.log(`📅 Gravando ${appts.length} agendamentos…`);
  for (let i = 0; i < appts.length; i += 500) await prisma.appointment.createMany({ data: appts.slice(i, i + 500) });
  for (let i = 0; i < apptServices.length; i += 1000) await prisma.appointmentService.createMany({ data: apptServices.slice(i, i + 1000) });

  // Usos do ciclo atual de cada assinatura (o app incrementa ao concluir).
  for (const s of subs) {
    const used = appts.filter((a) => a.subscriptionId === s.id && a.status === "DONE" && a.date >= apptDate(s.cycleStart));
    if (s.family) {
      const titular = used.filter((a) => a.beneficiaryName?.includes("Titular")).length;
      const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: s.id } });
      const benef = (sub.beneficiaries as any[]).map((b) => ({ ...b, uses: Math.min(b.maxUses, b.name.includes("Titular") ? titular : used.length - titular) }));
      await prisma.subscription.update({ where: { id: s.id }, data: { usesThisCycle: used.length, beneficiaries: benef } });
    } else {
      await prisma.subscription.update({ where: { id: s.id }, data: { usesThisCycle: used.length } });
    }
  }

  // ── Avaliações (NPS) e fidelidade ──────────────────────────────────────────
  const reviews = doneAppts.filter(() => chance(0.18)).map((a) => ({
    rating: pick([10, 10, 10, 9, 9, 9, 8, 8, 7, 6, 4]),
    comment: chance(0.5) ? pick(["Atendimento top!", "Corte ficou perfeito.", "Atrasou um pouco, mas o corte foi bom.", "Melhor barbearia da região.", "Ambiente muito agradável."]) : null,
    clientId: clients[a.clientIdx].id, barbershopId: shop.id, barberId: barbers[a.barberIdx].id, appointmentId: a.id,
    createdAt: at(a.day, "20:00"),
  }));
  await prisma.review.createMany({ data: reviews });

  // Igual ao app (api/reviews): cada avaliação enviada vale +10 pontos.
  const loyalty = reviews.map((r) => ({
    points: 10, action: "EARNED", description: `Avaliação do agendamento #${r.appointmentId.slice(-6).toUpperCase()}`,
    clientId: r.clientId, barbershopId: shop.id, createdAt: r.createdAt,
  }));
  for (const ci of [7, 10, 15]) {
    loyalty.push({ points: -50, action: "REDEEMED", description: "Resgate: 10% de desconto", clientId: clients[ci].id, barbershopId: shop.id, createdAt: at(day(-int(5, 40))) });
  }
  await prisma.loyaltyPoint.createMany({ data: loyalty });

  // ── Vendas de produtos ─────────────────────────────────────────────────────
  const sales = doneAppts.filter(() => chance(0.12)).map((a) => {
    const p = pick(products);
    const quantity = chance(0.85) ? 1 : 2;
    return {
      productId: p.id, quantity, unitPrice: p.price, total: p.price * quantity,
      barbershopId: shop.id, barberId: barbers[a.barberIdx].id, clientId: clients[a.clientIdx].id,
      createdAt: at(a.day, "18:00"),
    };
  });
  await prisma.productSale.createMany({ data: sales });

  // ── Comissões: meses anteriores pagos, vales no mês atual ──────────────────
  const prevMonths = [month(addMonths(TODAY, -2)), month(addMonths(TODAY, -1))];
  for (const b of barbers.slice(0, 3)) {
    for (const m of prevMonths) {
      const revenue = doneAppts.filter((a) => a.avulso && month(a.day) === m && barbers[a.barberIdx].id === b.id).reduce((s, a) => s + a.price, 0);
      if (revenue === 0) continue;
      await prisma.commissionPayment.create({
        data: { barberId: b.id, barbershopId: shop.id, month: m, amount: Math.round(revenue * (b.commission / 100)), type: "STANDARD", paidAt: at(addMonths(m + "-05", 1)) },
      });
    }
  }
  await prisma.commissionVale.createMany({
    data: [
      { barberId: barbers[0].id, barbershopId: shop.id, month: month(TODAY), amount: 200, description: "Adiantamento", createdAt: at(day(-6)) },
      { barberId: barbers[1].id, barbershopId: shop.id, month: month(TODAY), amount: 150, description: "Vale transporte", createdAt: at(day(-3)) },
    ],
  });

  // ── Metas ──────────────────────────────────────────────────────────────────
  await prisma.meta.createMany({
    data: [
      { titulo: "Faturamento do mês", tipo: "RECEITA", valorAlvo: 28000, barbershopId: shop.id },
      { titulo: "Atendimentos do mês", tipo: "ATENDIMENTOS", valorAlvo: 420, barbershopId: shop.id },
      { titulo: "Assinantes ativos", tipo: "ASSINANTES", valorAlvo: 15, barbershopId: shop.id },
      { titulo: "Ocupação da agenda", tipo: "OCUPACAO", valorAlvo: 75, barbershopId: shop.id },
      { titulo: "Atendimentos — Pedrão", tipo: "ATENDIMENTOS", valorAlvo: 160, barbershopId: shop.id, barberId: barbers[0].id },
      { titulo: "Atendimentos — Lucas", tipo: "ATENDIMENTOS", valorAlvo: 140, barbershopId: shop.id, barberId: barbers[1].id },
      { titulo: "Atendimentos da semana", tipo: "ATENDIMENTOS", periodo: "WEEKLY", valorAlvo: 100, barbershopId: shop.id },
    ],
  });

  // ── Kanban ─────────────────────────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      { title: "Comprar lâminas descartáveis", status: "TODO", priority: "HIGH", dueDate: at(day(2)), barbershopId: shop.id },
      { title: "Postar foto do degradê no Instagram", status: "TODO", priority: "NORMAL", barbershopId: shop.id, barberId: barbers[0].id },
      { title: "Revisar preços dos combos", status: "TODO", priority: "LOW", barbershopId: shop.id },
      { title: "Manutenção da cadeira 2", status: "DOING", priority: "HIGH", dueDate: at(day(1)), barbershopId: shop.id },
      { title: "Treinar Rafa na pigmentação", status: "DOING", priority: "NORMAL", barbershopId: shop.id, barberId: barbers[2].id },
      { title: "Renovar alvará", status: "DONE", priority: "HIGH", barbershopId: shop.id },
      { title: "Trocar toalhas", status: "DONE", priority: "LOW", barbershopId: shop.id, barberId: barbers[1].id },
    ],
  });

  // ── Recados do dono para a equipe ──────────────────────────────────────────
  const noticeDefs = [
    { content: "Sábado abrimos às 7h. Quem puder começar mais cedo, libera a agenda até sexta.", hoursAgo: 2, readBy: [1] },
    { content: "Chegou a pomada efeito seco. Comissão de 15% em cada venda.", hoursAgo: 26, readBy: [1, 2] },
    { content: "Reunião rápida da equipe na segunda às 8h30, antes de abrir.", hoursAgo: 24 * 6, readBy: [0, 1, 2] },
  ];
  for (const n of noticeDefs) {
    await prisma.teamNotice.create({
      data: {
        barbershopId: shop.id, content: n.content, authorId: owner.id, authorName: owner.name,
        createdAt: new Date(now.getTime() - n.hoursAgo * 3600_000),
        reads: { create: n.readBy.map((i) => ({ barberId: barbers[i].id })) },
      },
    });
  }

  // ── Lista de espera (amanhã e depois) ──────────────────────────────────────
  // Para testar: cancele um horário do Pedro amanhã — os da fila passam para "Avisado".
  // Offset do próximo dia aberto a partir de `from` (pula domingo).
  const nextOpenOffset = (from: number) => { let o = from; while (!hours.get(weekday(day(o)))?.isOpen) o++; return o; };
  const wlOffset1 = nextOpenOffset(1);
  const wlDay1 = day(wlOffset1);
  const wlDay2 = day(nextOpenOffset(wlOffset1 + 1));
  await prisma.waitlistEntry.createMany({
    data: [
      { barbershopId: shop.id, date: wlDay1, clientName: "Rodrigo Teixeira", clientPhone: "41998887766", barberId: barbers[0].id, serviceIds: [svCorte.id], createdAt: at(day(-1), "19:20") },
      { barbershopId: shop.id, date: wlDay1, clientName: "Caio Martins", clientPhone: "41997776655", barberId: barbers[1].id, anyBarber: true, serviceIds: [svCombo.id], createdAt: at(day(0), "07:40") },
      { barbershopId: shop.id, date: wlDay1, clientName: "Igor Ribeiro", clientPhone: "41996665544", barberId: barbers[0].id, serviceIds: [svBarba.id], status: "BOOKED", createdAt: at(day(-2), "12:00") },
      { barbershopId: shop.id, date: wlDay2, clientName: "Murilo Costa", clientPhone: "41995554433", barberId: barbers[2].id, serviceIds: [svCorte.id], createdAt: at(day(0), "08:10") },
    ],
  });

  // ── Bloqueios de agenda ────────────────────────────────────────────────────
  await prisma.scheduleBlock.createMany({
    data: [
      { barberId: barbers[1].id, date: apptDate(day(3)), startTime: "14:00", endTime: "16:00", reason: "Consulta médica" },
      { barberId: barbers[0].id, date: apptDate(day(6)), startTime: "09:00", endTime: "11:00", reason: "Curso de visagismo" },
    ],
  });

  // ── Despesas: mês atual e dois anteriores ──────────────────────────────────
  const expenseDefs = [
    { name: "Aluguel", amount: 3500, category: "ESTRUTURA", dueDay: 5, paymentMethod: "BOLETO" },
    { name: "Energia elétrica", amount: 480, category: "UTILIDADES", dueDay: 10, paymentMethod: "BOLETO" },
    { name: "Água", amount: 120, category: "UTILIDADES", dueDay: 12, paymentMethod: "BOLETO" },
    { name: "Internet", amount: 150, category: "UTILIDADES", dueDay: 15, paymentMethod: "PIX" },
    { name: "Contador", amount: 450, category: "PESSOAS", dueDay: 20, paymentMethod: "PIX" },
    { name: "Sistema IA de Barbearia", amount: 197, category: "TAXAS", dueDay: 22, paymentMethod: "CREDIT" },
    { name: "Reposição de produtos", amount: 900, category: "PRODUTOS", dueDay: 25, paymentMethod: "PIX" },
  ];
  for (const m of [...prevMonths, month(TODAY)]) {
    for (const e of expenseDefs) {
      const due = `${m}-${String(e.dueDay).padStart(2, "0")}`;
      const status = due < TODAY ? (m === month(TODAY) && e.dueDay > 9 && chance(0.5) ? "OVERDUE" : "PAID") : "PENDING";
      await prisma.expense.create({
        data: {
          ...e, type: "FIXED", isRecurring: true, month: m, status, dueDate: at(due),
          paidAt: status === "PAID" ? at(due, "10:00") : null, barbershopId: shop.id,
        },
      });
    }
  }
  await prisma.expense.create({
    data: { name: "Conserto do ar-condicionado", amount: 650, category: "EQUIPAMENTOS", type: "EXTRAORDINARY", month: month(TODAY), status: "PAID", paidAt: at(day(-4)), barbershopId: shop.id },
  });
  await prisma.expense.create({
    data: { name: "Impulsionamento Instagram", amount: 300, category: "MARKETING", type: "VARIABLE", month: month(TODAY), status: "PAID", paidAt: at(day(-8)), paymentMethod: "CREDIT", barbershopId: shop.id },
  });

  // ── Caixa: dias anteriores fechados, hoje aberto ───────────────────────────
  for (let offset = -6; offset <= 0; offset++) {
    const d = day(offset);
    if (!hours.get(weekday(d))?.isOpen) continue;
    const cash = doneAppts.filter((a) => a.day === d && a.avulso);
    const income = cash.slice(0, 8).map((a) => ({
      type: "INCOME", description: "Atendimento", amount: a.price, category: "SERVICO",
      paymentMethod: pick(["CASH", "PIX", "DEBIT"]), createdAt: at(d, toHHMM(int(9 * 60, 19 * 60))),
    }));
    const out = chance(0.5) ? [{ type: "EXPENSE", description: "Café e água", amount: 28, category: "MANUAL", paymentMethod: "CASH", createdAt: at(d, "15:00") }] : [];
    const total = 200 + income.reduce((s, e) => s + e.amount, 0) - out.reduce((s, e) => s + e.amount, 0);
    await prisma.cashFlowSession.create({
      data: {
        barbershopId: shop.id, openingBalance: 200, openedAt: at(d, "08:50"), createdAt: at(d, "08:50"),
        status: offset === 0 ? "OPEN" : "CLOSED",
        closedAt: offset === 0 ? null : at(d, "20:15"),
        closingBalance: offset === 0 ? null : total,
        entries: { create: [...income, ...out] },
      },
    });
  }

  // ── WhatsApp: conversas recentes ───────────────────────────────────────────
  const instanceId = shop.whatsappInstance!.id;
  const conversations: [number, [boolean, string][]][] = [
    [16, [[false, "Opa, tem horário amanhã à tarde?"], [true, "Fala! Tenho às 15h e às 16h30 com o Pedrão. Qual prefere?"], [false, "15h fechado"], [true, "Agendado ✅ Amanhã às 15h, Corte de Cabelo com Pedrão."]]],
    [17, [[false, "Quanto tá a barba?"], [true, "A barba sai R$ 35, e o combo corte + barba R$ 70. Quer agendar?"]]],
    [18, [[false, "Preciso desmarcar o de sábado"], [true, "Sem problema! Cancelei seu horário de sábado às 10h. Quer remarcar?"], [false, "Semana que vem eu vejo"]]],
    [19, [[true, "Fala Kaique! Já faz 52 dias desde seu último corte na Barbearia Demo. Bora agendar?"]]],
  ];
  for (const [ci, msgs] of conversations) {
    const c = clients[ci];
    const contact = await prisma.whatsAppContact.create({
      data: {
        remoteJid: `55${c.phone}@s.whatsapp.net`, phone: `55${c.phone}`, pushName: c.name.split(" ")[0],
        barbershopId: shop.id, instanceId, userId: c.id, lastSeenAt: at(day(-1), "18:00"),
      },
    });
    let minute = 17 * 60;
    for (const [fromMe, text] of msgs) {
      minute += int(1, 6);
      await prisma.whatsAppMessage.create({
        data: {
          evolutionId: `hm_msg_${ci}_${minute}`, fromMe, messageType: "conversation", textContent: text,
          rawPayload: { homolog: true }, timestamp: at(day(-1), toHHMM(minute)),
          contactId: contact.id, barbershopId: shop.id, instanceId,
        },
      });
    }
  }

  // ── Retenção: clientes que já receberam o lembrete ─────────────────────────
  for (const ci of [3, 10]) await prisma.clientRetention.create({ data: { clientId: clients[ci].id, barbershopId: shop.id, lastSentAt: at(day(-int(2, 20))) } });

  // ── Auditoria ──────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { barbershopId: shop.id, userId: owner.id, userEmail: owner.email, userRole: "OWNER", action: "UPDATE", entity: "Plan", entityId: planCorte.id, diff: { before: { price: 110 }, after: { price: 120 } }, createdAt: at(day(-20)) },
      { barbershopId: shop.id, userId: owner.id, userEmail: owner.email, userRole: "OWNER", action: "DEACTIVATE", entity: "Barber", entityId: barbers[3].id, diff: { before: { active: true }, after: { active: false, onVacation: true } }, createdAt: at(day(-20)) },
    ],
  });

  // ── Pagamentos do SaaS (mensalidade da barbearia para a plataforma) ────────
  for (let m = -3; m <= 0; m++) {
    await prisma.payment.create({
      data: { amount: 197, method: "CREDIT_CARD", status: "PAID", paidAt: at(addMonths(day(-6), m)), createdAt: at(addMonths(day(-6), m)), barbershopId: shop.id, gatewayType: "mercadopago" },
    });
  }

  // ── Barbearias secundárias (telas da plataforma) ───────────────────────────
  const others = [
    { name: "Navalha de Ouro", slug: "navalha-de-ouro", city: "São Paulo", state: "SP", saasPlan: "PRO" as const, saasStatus: "TRIAL", trialEndsAt: at(day(5)) },
    { name: "Barbearia do Zé", slug: "barbearia-do-ze", city: "Belo Horizonte", state: "MG", saasPlan: "BASIC" as const, saasStatus: "OVERDUE", saasExpiresAt: at(day(-4)) },
  ];
  for (const [i, o] of others.entries()) {
    const ow = await prisma.user.create({ data: { name: `Dono ${o.name}`, email: `dono${i + 2}@barberapp.com`, password: PASSWORD, role: "OWNER" } });
    const s = await prisma.barbershop.create({ data: { ...o, ownerId: ow.id, onboardingCompleted: true, createdAt: at(day(-int(10, 120))) } });
    await prisma.service.create({ data: { name: "Corte", price: 40, duration: 30, barbershopId: s.id } });
  }

  const count = (s: string) => appts.filter((a) => a.status === s).length;
  console.log("\n✅ Seed de homologação concluído!");
  console.log(`   ${clients.length} clientes · ${subs.length} assinaturas · ${appts.length} agendamentos (${count("DONE")} concluídos, ${count("CONFIRMED") + count("PENDING")} futuros/hoje)`);
  console.log(`   ${sales.length} vendas de produtos · ${reviews.length} avaliações`);
  console.log("\n   Logins (senha 123456):");
  console.log("   dono@barberapp.com · barbeiro@barberapp.com · admin@barberapp.com");
  console.log("   Agendamento online: /agendar/barbearia-demo\n");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
