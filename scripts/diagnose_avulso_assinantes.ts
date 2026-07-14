/**
 * DIAGNÓSTICO (somente leitura) — Assinantes fechados como "avulso"
 *
 * Investiga agendamentos concluídos (status DONE) que ficaram SEM assinatura
 * vinculada (subscriptionId = null) e classifica a causa provável de terem
 * caído no fluxo avulso. NÃO altera nada no banco.
 *
 * Causas classificadas:
 *   1. DUPLICADO      — o cliente do agendamento não tem assinatura, mas EXISTE
 *                       outro cliente com telefone equivalente (mesmo número a
 *                       menos de 55/9º dígito) que TEM assinatura ativa.
 *   2. SEM_TELEFONE   — cliente sem telefone (ou < 10 dígitos): a detecção de
 *                       assinatura no fechamento nem chega a rodar.
 *   3. VENCIDA        — o próprio cliente tem assinatura, mas estava vencida
 *                       (nextBillingDate < data do atendimento) ou status != ACTIVE.
 *   4. NAO_APLICADA   — o próprio cliente tem assinatura ATIVA e válida na data:
 *                       o sistema detectaria, mas fechou avulso mesmo assim
 *                       (não foi vinculada na criação e/ou barbeiro não clicou
 *                       em "Usar assinatura").
 *   -  (sem causa)    — cliente realmente não é assinante: avulso legítimo.
 *
 * Uso:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/diagnose_avulso_assinantes.ts
 *
 * Filtros opcionais:
 *   --barber="Matheus,Adrian"   só agendamentos desses barbeiros (match parcial, case-insensitive)
 *   --from=2026-06-01           data inicial (inclusive)
 *   --to=2026-06-30             data final (inclusive)
 *   --details                   lista cada agendamento problemático (não só o resumo)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}
const hasFlag = (flag: string) => process.argv.includes(flag);

/**
 * Chave canônica de telefone BR para detectar números equivalentes:
 * remove não-dígitos, tira o DDI 55, e reduz a DDD(2) + últimos 8 dígitos —
 * o que unifica variações com/sem 9º dígito. Ex.:
 *   5544999887766 → 44 99887766? Não: DDD=44, últimos 8 = 99887766 → "4499887766"?
 * Na prática: pega DDD (2 primeiros após remover 55) + os últimos 8 dígitos.
 */
function canonicalPhone(raw: string | null | undefined): string | null {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  // remove DDI 55 quando o comprimento indica número BR completo (12 ou 13 dígitos)
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length < 10) return null; // curto demais para ser confiável
  const ddd = d.slice(0, 2);
  const last8 = d.slice(-8); // ignora o 9º dígito inserido após o DDD
  return ddd + last8;
}

type Cause = "DUPLICADO" | "SEM_TELEFONE" | "VENCIDA" | "ASSINOU_DEPOIS" | "NAO_APLICADA_COBERTO" | "NAO_APLICADA_EXTRA";

async function main() {
  const barberFilter = (argValue("--barber") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const from = argValue("--from");
  const to = argValue("--to");
  const details = hasFlag("--details");

  const dateWhere: any = {};
  if (from) dateWhere.gte = new Date(from + "T00:00:00Z");
  if (to) dateWhere.lte = new Date(to + "T23:59:59.999Z");

  // ── 1. Carrega TODAS as assinaturas (para cruzar por cliente e por telefone) ──
  const subs = await prisma.subscription.findMany({
    select: {
      id: true, status: true, nextBillingDate: true, clientId: true,
      startDate: true, createdAt: true,
      client: { select: { id: true, name: true, phone: true } },
      plan: { select: { name: true, planServices: { select: { serviceId: true } } } },
    },
  });

  // Índice: clientId → assinaturas desse cliente
  const subsByClient = new Map<string, typeof subs>();
  // Índice: telefone canônico → assinaturas ATIVAS de qualquer cliente com esse telefone
  const activeSubsByPhone = new Map<string, typeof subs>();
  for (const s of subs) {
    if (!subsByClient.has(s.clientId)) subsByClient.set(s.clientId, []);
    subsByClient.get(s.clientId)!.push(s);
    if (s.status === "ACTIVE") {
      const key = canonicalPhone(s.client.phone);
      if (key) {
        if (!activeSubsByPhone.has(key)) activeSubsByPhone.set(key, []);
        activeSubsByPhone.get(key)!.push(s);
      }
    }
  }

  // ── 2. Agendamentos DONE fechados como avulso (sem assinatura vinculada) ──
  const appts = await prisma.appointment.findMany({
    where: {
      status: "DONE",
      subscriptionId: null,
      ...(Object.keys(dateWhere).length ? { date: dateWhere } : {}),
    },
    select: {
      id: true, date: true, createdAt: true, price: true, paymentMethod: true, extraPrice: true,
      client: { select: { id: true, name: true, phone: true } },
      barber: { select: { user: { select: { name: true } } } },
      services: { select: { service: { select: { id: true, name: true } } } },
      service: { select: { id: true, name: true } },
    },
    orderBy: { date: "asc" },
  });

  const rows: {
    date: Date; client: string; phone: string | null; barber: string;
    services: string; cause: Cause; detail: string;
  }[] = [];

  for (const a of appts) {
    const barberName = a.barber?.user?.name ?? "—";
    if (barberFilter.length && !barberFilter.some((f) => barberName.toLowerCase().includes(f))) continue;

    const ownSubs = subsByClient.get(a.client.id) ?? [];
    const canon = canonicalPhone(a.client.phone);

    let cause: Cause | null = null;
    let detail = "";

    const d = (x: Date) => new Date(x).toISOString().slice(0, 10);
    const atendDate = new Date(a.date);

    // Assinatura VIGENTE na data do atendimento (qualquer status): janela [início, vencimento].
    // Melhor proxy para "o cliente ERA assinante naquele dia".
    const subAtDate = ownSubs.find(
      (s) => new Date(s.startDate) <= atendDate && new Date(s.nextBillingDate) >= atendDate
    );
    // Assinatura que começou DEPOIS do atendimento → na época o avulso estava correto.
    const subLater = ownSubs.find((s) => new Date(s.startDate) > atendDate);
    // Assinatura que já tinha vencido ANTES do atendimento.
    const subExpiredBefore = ownSubs.find((s) => new Date(s.nextBillingDate) < atendDate);

    if (subAtDate) {
      // Era assinante na data. O plano cobre algum dos serviços deste agendamento?
      const covered = new Set(subAtDate.plan.planServices.map((ps) => ps.serviceId));
      const apptServiceIds = a.services.length
        ? a.services.map((s) => s.service.id)
        : a.service?.id ? [a.service.id] : [];
      const anyCovered = apptServiceIds.some((id) => covered.has(id));
      if (anyCovered) {
        cause = "NAO_APLICADA_COBERTO";
        detail = `ERA assinante na data (${subAtDate.plan.name}, ${subAtDate.status}); plano COBRE o serviço — deveria ter sido assinatura`;
      } else {
        cause = "NAO_APLICADA_EXTRA";
        detail = `plano ${subAtDate.plan.name} NÃO cobre este serviço — avulso/extra correto`;
      }
    } else if (subLater) {
      cause = "ASSINOU_DEPOIS";
      detail = `atend=${d(a.date)}; assinou só em ${d(subLater.startDate)} (${subLater.plan.name}) — avulso estava correto na época`;
    } else if (subExpiredBefore) {
      cause = "VENCIDA";
      detail = `assinatura ${subExpiredBefore.status}, venceu ${d(subExpiredBefore.nextBillingDate)} antes do atendimento`;
    } else if (!canon) {
      // Sem telefone utilizável → nem tenta cruzar por número
      // Só marca como problema se existir algum indício? Não: sem telefone e sem sub própria = avulso legítimo,
      // MAS a detecção estaria cega. Reportamos como SEM_TELEFONE apenas se houver homônimo assinante.
      const nameMatch = subs.find(
        (s) => s.status === "ACTIVE" && s.client.name.trim().toLowerCase() === a.client.name.trim().toLowerCase()
      );
      if (nameMatch) {
        cause = "SEM_TELEFONE";
        detail = `sem telefone; existe assinante homônimo (${nameMatch.plan.name})`;
      }
    } else {
      // (1) Cliente duplicado: telefone equivalente com assinatura ativa em OUTRO cadastro
      const phoneMatches = (activeSubsByPhone.get(canon) ?? []).filter((s) => s.clientId !== a.client.id);
      if (phoneMatches.length) {
        cause = "DUPLICADO";
        const s = phoneMatches[0];
        detail = `assinante "${s.client.name}" (tel ${s.client.phone}) tem mesmo número; agendamento usa outro cadastro`;
      }
    }

    if (cause) {
      const services = a.services.length
        ? a.services.map((s) => s.service.name).join(" + ")
        : a.service?.name ?? "—";
      rows.push({
        date: a.date, client: a.client.name, phone: a.client.phone, barber: barberName,
        services, cause, detail,
      });
    }
  }

  // ── 3. Resumo ──
  const scope = [
    barberFilter.length ? `barbeiros=${barberFilter.join("/")}` : "todos os barbeiros",
    from ? `de ${from}` : null,
    to ? `até ${to}` : null,
  ].filter(Boolean).join(", ");

  console.log(`\n📊 Diagnóstico: assinantes fechados como avulso  (${scope})`);
  console.log(`   Agendamentos DONE avulso analisados: ${appts.length}`);
  console.log(`   Suspeitos (assinante que virou avulso): ${rows.length}\n`);

  const byCause: Record<Cause, number> = { DUPLICADO: 0, SEM_TELEFONE: 0, VENCIDA: 0, ASSINOU_DEPOIS: 0, NAO_APLICADA_COBERTO: 0, NAO_APLICADA_EXTRA: 0 };
  for (const r of rows) byCause[r.cause]++;

  const label: Record<Cause, string> = {
    NAO_APLICADA_COBERTO: "★ ERRO REAL: ERA assinante na data + plano cobre o serviço, mas fechou avulso",
    DUPLICADO:    "★ ERRO REAL: cliente DUPLICADO (telefone 55/9º dígito divergente) — assinatura em outro cadastro",
    SEM_TELEFONE: "2. SEM telefone no agendamento (detecção cega)",
    ASSINOU_DEPOIS: "○ NÃO É BUG: cliente assinou DEPOIS deste atendimento — avulso correto na época (sub registrada tarde no sistema)",
    VENCIDA:      "○ Assinatura VENCIDA antes do atendimento (decisão de produto)",
    NAO_APLICADA_EXTRA: "○ NÃO É BUG: serviço NÃO coberto pelo plano — avulso/extra é o correto (percepção do barbeiro)",
  };
  const order: Cause[] = ["NAO_APLICADA_COBERTO", "DUPLICADO", "SEM_TELEFONE", "ASSINOU_DEPOIS", "VENCIDA", "NAO_APLICADA_EXTRA"];
  for (const c of order) {
    console.log(`   ${byCause[c].toString().padStart(4)}  ${label[c]}`);
  }
  console.log("");

  if (details) {
    for (const c of order) {
      const group = rows.filter((r) => r.cause === c);
      if (!group.length) continue;
      console.log(`\n── ${label[c]} ──`);
      for (const r of group) {
        const d = r.date.toISOString().slice(0, 10);
        console.log(
          `  ${d}  ${r.client.padEnd(24)} tel=${(r.phone ?? "—").padEnd(15)} barb=${r.barber.padEnd(12)} ${r.services}\n` +
          `           ↳ ${r.detail}`
        );
      }
    }
    console.log("");
  } else {
    console.log("ℹ️  Rode com --details para ver cada agendamento suspeito.\n");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
