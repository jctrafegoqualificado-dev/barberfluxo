/**
 * /api/barbershop/payments/link
 *
 * Gera um link de pagamento MP para um agendamento avulso e envia via WhatsApp.
 * O cliente paga antes (ou depois) de chegar na barbearia, sem precisar
 * ter cartão presente no balcão.
 *
 * Fluxo:
 *  1. Barbeiro/Dono clica em "Enviar link de pagamento" no agendamento
 *  2. Este endpoint cria uma MP Preference (checkout único)
 *  3. Envia o link via WhatsApp ao cliente
 *  4. Quando o cliente pagar, MP notifica o webhook /webhooks/[barbershopId]/mercadopago
 *  5. Webhook marca o agendamento como pago (mpPaymentId, paymentMethod)
 *
 * SEGURANÇA:
 *  - Apenas OWNER e BARBER podem gerar links
 *  - Agendamento deve pertencer à barbearia (CVE-10)
 *  - Token do MP nunca é exposto na resposta
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { decrypt } from "@/lib/encrypt";
import { createMpPreference } from "@/lib/mercadopago";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { appointmentId } = await req.json();

    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId é obrigatório" }, { status: 400 });
    }

    // ── 1. Busca o agendamento (com segurança multi-tenant) ────────────────
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId, barbershopId },
      include: {
        client:    { select: { id: true, name: true, phone: true, email: true } },
        service:   { select: { name: true } },
        barbershop: { select: { name: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    if (appointment.status === "CANCELLED") {
      return NextResponse.json({ error: "Não é possível gerar link para agendamento cancelado" }, { status: 400 });
    }

    // Já tem link gerado e pago
    if ((appointment as any).mpPaymentId) {
      return NextResponse.json(
        { error: "Este agendamento já foi pago via link Mercado Pago." },
        { status: 400 },
      );
    }

    // ── 2. Busca gateway da barbearia ──────────────────────────────────────
    const gatewayConfig = await (prisma as any).paymentGatewayConfig.findUnique({
      where:  { barbershopId },
      select: { accessToken: true, active: true },
    });

    if (!gatewayConfig?.active) {
      return NextResponse.json(
        { error: "Gateway de pagamento não configurado. Configure o Mercado Pago nas configurações da barbearia." },
        { status: 400 },
      );
    }

    // ── 3. Calcula valor total (preço + extra) ──────────────────────────────
    const totalAmount = (appointment.price ?? 0) + (appointment.extraPrice ?? 0);
    if (totalAmount <= 0) {
      return NextResponse.json({ error: "Valor do agendamento inválido" }, { status: 400 });
    }

    // ── 4. Cria Preference no MP ────────────────────────────────────────────
    const token    = decrypt(gatewayConfig.accessToken);
    const baseUrl  = process.env.NEXTAUTH_URL ?? "https://iadebarbearia.com.br";
    const shopName = appointment.barbershop?.name ?? "Barbearia";

    const serviceName = appointment.service?.name ?? "Atendimento";
    const title       = `${serviceName} — ${shopName}`;

    // external_reference com prefixo para distinguir de preapprovals no webhook
    const externalReference = `appointment:${appointmentId}`;
    const notificationUrl   = `${baseUrl}/api/webhooks/${barbershopId}/mercadopago`;

    const { preferenceId, initPoint } = await createMpPreference(
      {
        externalReference,
        title,
        unitPrice:        totalAmount,
        payerEmail:       appointment.client.email,
        successUrl:       `${baseUrl}/pagamento-confirmado?id=${appointmentId}`,
        notificationUrl,
      },
      token,
    );

    // ── 5. Salva link + preferenceId no agendamento ─────────────────────────
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        mpPaymentLink:  initPoint,
        mpPreferenceId: preferenceId,
      } as any,
    });

    // ── 6. Envia link via WhatsApp ──────────────────────────────────────────
    let whatsappSent = false;
    if (appointment.client.phone) {
      const result = await sendWhatsAppNotification(
        barbershopId,
        appointment.client.phone,
        `💈 *Link de pagamento — ${shopName}*\n\n` +
        `Olá, ${appointment.client.name}! Seu agendamento de *${serviceName}* está confirmado.\n\n` +
        `💰 Valor: R$ ${totalAmount.toFixed(2)}\n\n` +
        `Para pagar com cartão ou Pix pelo Mercado Pago, clique aqui:\n` +
        `👉 ${initPoint}\n\n` +
        `_Pagamento 100% seguro. ✅_`,
      );
      whatsappSent = result.success;
    }

    // ── 7. Audit ────────────────────────────────────────────────────────────
    void logAudit({
      barbershopId,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "UPDATE",
      entity:    "Appointment",
      entityId:  appointmentId,
      diff: {
        after: {
          mpPreferenceId: preferenceId,
          mpPaymentLink:  initPoint,
          source:         "payments/link",
        },
      },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      ok:           true,
      initPoint,
      preferenceId,
      whatsappSent,
      message: whatsappSent
        ? `Link de pagamento enviado para ${appointment.client.name} via WhatsApp.`
        : `Link gerado! WhatsApp não enviado — compartilhe manualmente: ${initPoint}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
