/**
 * /api/webhooks/[barbershopId]/mercadopago
 *
 * Webhook público chamado pelo Mercado Pago para notificar eventos
 * de assinaturas recorrentes (Preapprovals) e pagamentos avulsos de cada barbearia.
 *
 * URL configurada no painel MP de cada barbearia:
 *   https://<dominio>/api/webhooks/<barbershopId>/mercadopago
 *
 * SEGURANÇA:
 *  - Sem autenticação JWT — o MP chama este endpoint diretamente
 *  - O barbershopId na URL funciona como chave de roteamento
 *  - Token da barbearia é descriptografado somente em memória, nunca logado
 *
 * CONFIABILIDADE:
 *  - Sempre retorna 200 para evitar loops de retry do MP
 *  - Idempotente: mpPaymentId impede processamento duplo de pagamentos
 *  - Erros internos são logados via console mas não propagados ao MP
 *
 * Eventos tratados:
 *  - subscription_preapproval          → cliente autorizou (ou cancelou) o débito
 *  - subscription_authorized_payment   → MP cobrou com sucesso (ou falhou) na recorrência
 *  - payment                           → pagamento avulso de agendamento confirmado
 *
 * Docs MP:
 *   Subscriptions: https://www.mercadopago.com.br/developers/pt/docs/subscriptions/webhook
 *   Payments:      https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/webhook
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import {
  getMpPreapproval,
  getMpAuthorizedPayment,
  getMpPayment,
} from "@/lib/mercadopago";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { addMonths } from "date-fns";

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Garante que o dia não ultrapasse o último dia do mês destino (ex: 31 de fev → 28/29). */
function clampDay(day: number, year: number, month: number): number {
  return Math.min(day, new Date(year, month + 1, 0).getDate());
}

/** Retorna quantos meses avançar conforme o ciclo do plano. */
function cycleMonths(billingCycle: string): number {
  switch (billingCycle) {
    case "QUARTERLY": return 3;
    case "YEARLY":    return 12;
    default:          return 1; // MONTHLY
  }
}

/**
 * Calcula a próxima data de cobrança respeitando o dia fixo (billingDay).
 * Exemplo: billingDay=31, mês destino = fevereiro → retorna 28 ou 29.
 */
function advanceBillingDate(
  current:    Date,
  months:     number,
  billingDay: number | null,
): Date {
  const next = addMonths(current, months);
  if (!billingDay) return next;
  return new Date(
    next.getFullYear(),
    next.getMonth(),
    clampDay(billingDay, next.getFullYear(), next.getMonth()),
  );
}

// ─── Helper: busca e descriptografa token da barbearia ────────────────────────

async function getDecryptedToken(barbershopId: string): Promise<string | null> {
  const config = await (prisma as any).paymentGatewayConfig.findUnique({
    where:  { barbershopId },
    select: { accessToken: true, active: true },
  });
  if (!config || !config.active) return null;
  try {
    return decrypt(config.accessToken);
  } catch {
    console.error(`[MP-Webhook] Falha ao descriptografar token da barbearia ${barbershopId}`);
    return null;
  }
}

// ─── Helper: mapeia payment_method_id do MP para nosso enum interno ───────────

function mapPaymentMethod(mpMethod?: string): string {
  if (!mpMethod) return "CREDIT_CARD";
  const m = mpMethod.toLowerCase();
  if (m.includes("debit"))       return "DEBIT_CARD";
  if (m === "account_money")     return "PIX"; // saldo MP → mais próximo de PIX
  return "CREDIT_CARD";
}

// ─── Handler: subscription_preapproval ───────────────────────────────────────
// Chamado quando o cliente autoriza (ou cancela) o débito automático.

async function handlePreapproval(
  barbershopId: string,
  preapprovalId: string,
  token:         string,
): Promise<void> {
  // 1. Fetch status atual do preapproval no MP
  const preapproval = await getMpPreapproval(preapprovalId, token);

  // 2. Localiza a assinatura no banco pelo mpPreapprovalId
  const sub = await prisma.subscription.findFirst({
    where: { barbershopId, mpPreapprovalId: preapprovalId },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      plan:   { select: { name: true } },
    },
  });

  if (!sub) {
    console.warn(
      `[MP-Webhook] subscription_preapproval: preapproval ${preapprovalId} ` +
      `não encontrado no banco (barbershopId=${barbershopId})`,
    );
    return;
  }

  // 3. Processa conforme o status retornado pelo MP
  if (preapproval.status === "authorized") {
    await prisma.subscription.update({
      where: { id: sub.id },
      data:  { authorizationStatus: "AUTHORIZED" },
    });

    // Notifica cliente via WhatsApp
    if (sub.client.phone) {
      void sendWhatsAppNotification(
        barbershopId,
        sub.client.phone,
        `✅ *Assinatura autorizada!*\n\n` +
        `Olá, ${sub.client.name}! Sua assinatura do plano *${sub.plan.name}* foi autorizada com sucesso.\n\n` +
        `O Mercado Pago realizará a cobrança automaticamente a cada ciclo. 😊`,
      );
    }

    void logAudit({
      barbershopId,
      action:   "STATUS_CHANGE",
      entity:   "Subscription",
      entityId: sub.id,
      diff: {
        before: { authorizationStatus: (sub as any).authorizationStatus },
        after:  { authorizationStatus: "AUTHORIZED", source: "mp-webhook" },
      },
    });

  } else if (preapproval.status === "cancelled") {
    await prisma.subscription.update({
      where: { id: sub.id },
      data:  { authorizationStatus: "FAILED" },
    });

    if (sub.client.phone) {
      void sendWhatsAppNotification(
        barbershopId,
        sub.client.phone,
        `⚠️ *Autorização não concluída*\n\n` +
        `Olá, ${sub.client.name}! A autorização do débito automático para o plano *${sub.plan.name}* foi cancelada.\n\n` +
        `Entre em contato com a barbearia para mais informações.`,
      );
    }

    void logAudit({
      barbershopId,
      action:   "STATUS_CHANGE",
      entity:   "Subscription",
      entityId: sub.id,
      diff: {
        before: { authorizationStatus: (sub as any).authorizationStatus },
        after:  { authorizationStatus: "FAILED", reason: "preapproval-cancelled" },
      },
    });

  }
  // "pending" | "paused" → sem ação por ora; MP pode re-notificar depois
}

// ─── Handler: subscription_authorized_payment ────────────────────────────────
// Chamado quando o MP realiza (ou falha) uma cobrança automática.

async function handleAuthorizedPayment(
  barbershopId:       string,
  authorizedPaymentId: string,
  token:              string,
): Promise<void> {
  // 1. Idempotência — evita registrar o mesmo pagamento duas vezes
  const existing = await prisma.payment.findFirst({
    where: { mpPaymentId: authorizedPaymentId },
    select: { id: true },
  });
  if (existing) {
    console.log(`[MP-Webhook] authorized_payment ${authorizedPaymentId} já processado — skip`);
    return;
  }

  // 2. Fetch authorized_payment do MP (status real da cobrança)
  const mpPayment = await getMpAuthorizedPayment(authorizedPaymentId, token);

  // 3. Localiza assinatura pelo preapproval_id (vínculo 1:N preapproval → payments)
  const sub = await prisma.subscription.findFirst({
    where: { barbershopId, mpPreapprovalId: mpPayment.preapproval_id },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      plan:   { select: { name: true, billingCycle: true } },
    },
  });

  if (!sub) {
    console.warn(
      `[MP-Webhook] authorized_payment ${authorizedPaymentId}: subscription não encontrada ` +
      `para preapproval_id=${mpPayment.preapproval_id} (barbershopId=${barbershopId})`,
    );
    return;
  }

  if (mpPayment.status === "processed") {
    // ── 4a. Cobrança bem-sucedida ───────────────────────────────────────────
    const months   = cycleMonths(sub.plan.billingCycle);
    const nextDate = advanceBillingDate(
      new Date(sub.nextBillingDate),
      months,
      (sub as any).billingDay ?? null,
    );
    const method = mapPaymentMethod(mpPayment.payment_method_id);

    // Transação: cria Payment + atualiza Subscription atomicamente
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          amount:         mpPayment.transaction_amount,
          method,
          status:         "PAID",
          paidAt:         new Date(),
          mpPaymentId:    authorizedPaymentId,
          gatewayType:    "mercadopago",
          subscriptionId: sub.id,
          barbershopId,
        },
      });

      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          nextBillingDate:    nextDate,
          usesThisCycle:      0,
          status:             "ACTIVE",
          authorizationStatus: "AUTHORIZED", // mantém — pagamento confirma autorização ativa
        },
      });
    });

    // Notifica cliente
    if (sub.client.phone) {
      void sendWhatsAppNotification(
        barbershopId,
        sub.client.phone,
        `✅ *Pagamento confirmado!*\n\n` +
        `Olá, ${sub.client.name}! O pagamento da sua assinatura *${sub.plan.name}* foi processado com sucesso.\n\n` +
        `💰 Valor: R$ ${mpPayment.transaction_amount.toFixed(2)}\n` +
        `📅 Próxima cobrança: ${nextDate.toLocaleDateString("pt-BR")}`,
      );
    }

    void logAudit({
      barbershopId,
      action:   "CREATE",
      entity:   "Payment",
      entityId: authorizedPaymentId,
      diff: {
        after: {
          amount:         mpPayment.transaction_amount,
          method,
          subscriptionId: sub.id,
          source:         "mp-webhook",
        },
      },
    });

  } else if (mpPayment.status === "cancelled") {
    // ── 4b. Cobrança falhou definitivamente ────────────────────────────────
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status:             "OVERDUE",
        authorizationStatus: "FAILED",
      },
    });

    if (sub.client.phone) {
      void sendWhatsAppNotification(
        barbershopId,
        sub.client.phone,
        `⚠️ *Falha no pagamento*\n\n` +
        `Olá, ${sub.client.name}! Não conseguimos processar o pagamento da sua assinatura *${sub.plan.name}*.\n\n` +
        `Por favor, entre em contato com a barbearia para regularizar sua situação.`,
      );
    }

    void logAudit({
      barbershopId,
      action:   "STATUS_CHANGE",
      entity:   "Subscription",
      entityId: sub.id,
      diff: {
        before: { status: sub.status },
        after:  { status: "OVERDUE", authorizationStatus: "FAILED", reason: "mp-payment-cancelled" },
      },
    });

  }
  // "recycling" → MP ainda vai tentar novamente; aguarda, não faz nada agora
}

// ─── Handler: payment (avulso — pagamento único de agendamento) ───────────────
// Chamado quando o cliente paga via link gerado em /api/barbershop/payments/link

async function handlePayment(
  barbershopId: string,
  paymentId:    string,
  token:        string,
): Promise<void> {
  // 1. Idempotência — evita processar o mesmo payment duas vezes
  const alreadyDone = await prisma.appointment.findFirst({
    where:  { barbershopId, mpPaymentId: paymentId } as any,
    select: { id: true },
  });
  if (alreadyDone) {
    console.log(`[MP-Webhook] payment ${paymentId} (avulso) já processado — skip`);
    return;
  }

  // 2. Fetch payment do MP
  const mpPayment = await getMpPayment(paymentId, token);

  // Só processa pagamentos aprovados
  if (mpPayment.status !== "approved") {
    console.log(`[MP-Webhook] payment ${paymentId} status=${mpPayment.status} — ignorado`);
    return;
  }

  // 3. external_reference deve ter formato "appointment:{id}"
  const ref = mpPayment.external_reference ?? "";
  if (!ref.startsWith("appointment:")) {
    console.log(`[MP-Webhook] payment ${paymentId} external_reference="${ref}" não é avulso — ignorado`);
    return;
  }
  const appointmentId = ref.replace("appointment:", "");

  // 4. Busca agendamento (segurança multi-tenant)
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, barbershopId },
    include: {
      client:    { select: { id: true, name: true, phone: true } },
      barbershop: { select: { name: true, ownerId: true } },
      service:   { select: { name: true } },
    },
  });

  if (!appointment) {
    console.warn(
      `[MP-Webhook] payment ${paymentId}: appointment ${appointmentId} não encontrado ` +
      `(barbershopId=${barbershopId})`,
    );
    return;
  }

  // 5. Atualiza agendamento como pago
  const method = mapPaymentMethod(mpPayment.payment_method_id);
  await prisma.appointment.update({
    where: { id: appointmentId },
    data:  {
      mpPaymentId:   paymentId,
      paymentMethod: method,
    } as any,
  });

  // 6. Notifica dono da barbearia via WhatsApp (busca telefone do dono)
  const owner = await prisma.user.findUnique({
    where:  { id: appointment.barbershop.ownerId },
    select: { phone: true },
  });

  const shopName    = appointment.barbershop?.name ?? "Barbearia";
  const serviceName = appointment.service?.name    ?? "Atendimento";

  if (owner?.phone) {
    void sendWhatsAppNotification(
      barbershopId,
      owner.phone,
      `💰 *Pagamento recebido!*\n\n` +
      `*${appointment.client.name}* pagou o agendamento de *${serviceName}* via Mercado Pago.\n\n` +
      `💳 Método: ${method}\n` +
      `💵 Valor: R$ ${mpPayment.transaction_amount.toFixed(2)}`,
    );
  }

  // Confirma para o cliente também
  if (appointment.client.phone) {
    void sendWhatsAppNotification(
      barbershopId,
      appointment.client.phone,
      `✅ *Pagamento confirmado!*\n\n` +
      `Olá, ${appointment.client.name}! Seu pagamento de *${serviceName}* na *${shopName}* foi confirmado.\n\n` +
      `Até logo! 😊`,
    );
  }

  void logAudit({
    barbershopId,
    action:   "UPDATE",
    entity:   "Appointment",
    entityId: appointmentId,
    diff: {
      after: {
        mpPaymentId:   paymentId,
        paymentMethod: method,
        amount:        mpPayment.transaction_amount,
        source:        "mp-webhook-payment",
      },
    },
  });
}

// ─── POST — entry point do webhook ───────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ barbershopId: string }> },
) {
  const { barbershopId } = await params;

  // ⚠️ SEMPRE retorna 200 — qualquer outro status faz o MP entrar em loop de retry
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: true });

    const { type, data } = body as {
      type?: string;
      data?: { id?: string };
      action?: string;
    };
    const resourceId = data?.id;

    console.log(`[MP-Webhook] barbershopId=${barbershopId} type=${type} id=${resourceId}`);

    // Descarta eventos sem tipo ou sem ID de recurso
    if (!type || !resourceId) {
      return NextResponse.json({ ok: true });
    }

    // Busca token descriptografado da barbearia
    const token = await getDecryptedToken(barbershopId);
    if (!token) {
      // Gateway desconectado ou barbearia inexistente — ignorar silenciosamente
      console.warn(
        `[MP-Webhook] Barbearia ${barbershopId} sem gateway ativo — evento ignorado (type=${type})`,
      );
      return NextResponse.json({ ok: true });
    }

    // Processa conforme o tipo de evento
    switch (type) {
      case "subscription_preapproval":
        await handlePreapproval(barbershopId, resourceId, token);
        break;

      case "subscription_authorized_payment":
        await handleAuthorizedPayment(barbershopId, resourceId, token);
        break;

      case "payment":
        await handlePayment(barbershopId, resourceId, token);
        break;

      default:
        // Outros eventos (point_integration_wh, test, etc.) → ignorar
        console.log(`[MP-Webhook] Evento não tratado: type=${type} — ignorado`);
    }
  } catch (err) {
    // Log completo mas NÃO propaga o erro — MP NÃO deve retentar
    console.error(`[MP-Webhook] Erro interno (barbershopId=${barbershopId}):`, err);
  }

  return NextResponse.json({ ok: true });
}
