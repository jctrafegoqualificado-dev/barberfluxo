/**
 * /api/payments/preapproval
 *
 * POST — Cria um Preapproval no Mercado Pago para uma Subscription existente.
 *         Retorna o link de checkout (initPoint) que o OWNER envia ao cliente
 *         para que ele autorize o débito automático recorrente.
 *
 * DELETE — Cancela o Preapproval no MP (ex.: assinante solicitou cancelamento).
 *
 * Fluxo após autorização do cliente:
 *   1. Cliente autoriza → MP começa a cobrar automaticamente.
 *   2. MP chama POST /api/payments/webhook com type="subscription_authorized_payment".
 *   3. O webhook avança nextBillingDate e marca o pagamento como PAGO.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { createMpPreapproval, cancelMpPreapproval } from "@/lib/mercadopago";
import { decrypt } from "@/lib/encrypt";

// ─── POST /api/payments/preapproval ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { subscriptionId, clientEmail: clientEmailInput } = await req.json();

    if (!subscriptionId) {
      return NextResponse.json({ error: "subscriptionId obrigatório" }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId, barbershopId },
      include: {
        client:    { select: { id: true, email: true, name: true } },
        plan:      { select: { name: true, price: true, billingCycle: true } },
        barbershop:{ select: { name: true } },
      },
    });

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    if (sub.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Não é possível criar cobrança recorrente para assinatura cancelada" },
        { status: 400 },
      );
    }

    // Idempotente: se já foi criado, apenas informa o ID (não gera novo link)
    if ((sub as any).mpPreapprovalId) {
      return NextResponse.json({
        preapprovalId: (sub as any).mpPreapprovalId,
        alreadyExists: true,
        message: "Preapproval já criado. Compartilhe o link anterior ou cancele e recrie.",
      });
    }

    // ── Busca token MP da barbearia (obrigatório) ─────────────────────────────
    // findFirst em vez de findUnique: `active` não faz parte da chave única de barbershopId
    const gatewayConfig = await (prisma as any).paymentGatewayConfig.findFirst({
      where:  { barbershopId, active: true },
      select: { accessToken: true },
    });

    if (!gatewayConfig?.accessToken) {
      return NextResponse.json(
        { error: "Mercado Pago não conectado. Configure em Configurações → Pagamentos." },
        { status: 400 },
      );
    }

    const barbershopToken = decrypt(gatewayConfig.accessToken);
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    // ── Resolve o e-mail do pagador ───────────────────────────────────────────
    // MP exige payer_email para criar preapproval. E-mails sintéticos (@cliente.*)
    // são apenas identificadores internos — o cliente não os conhece e o checkout falha.
    // Se o dono informou um e-mail real via clientEmailInput, usa ele e atualiza o cadastro.
    const isFakeEmail = (email: string) =>
      /@cliente\./i.test(email) || email.endsWith("@cliente.barberfluxo") || email.endsWith("@cliente.barberapp");

    let payerEmail: string | undefined = isFakeEmail(sub.client.email) ? undefined : sub.client.email;

    if (!payerEmail && clientEmailInput?.trim()) {
      // Dono informou o e-mail real do cliente → tenta salvar no cadastro e usa no MP
      const trimmed = clientEmailInput.trim();
      try {
        await prisma.user.update({ where: { id: sub.client.id }, data: { email: trimmed } });
        console.log(`[preapproval] E-mail do cliente atualizado para ${trimmed} (era sintético)`);
      } catch (updateErr: any) {
        if (updateErr?.code === "P2002") {
          // E-mail já existe em outro cadastro (ex: cliente tem 2 registros)
          // Usa o e-mail somente para o MP — não salva no banco
          console.warn(`[preapproval] Conflito de e-mail: ${trimmed} já existe em outro cadastro. Usando só para MP.`);
        } else {
          throw updateErr; // qualquer outro erro, propaga
        }
      }
      payerEmail = trimmed;
    }

    if (!payerEmail) {
      // MP exige o e-mail — sem ele o preapproval não pode ser criado
      return NextResponse.json(
        { error: "EMAIL_REQUIRED", message: "Informe o e-mail do cliente para ativar o débito automático no Mercado Pago." },
        { status: 400 },
      );
    }

    const startDate = new Date(sub.nextBillingDate);

    console.log(`[preapproval] Criando preapproval: sub=${subscriptionId} startDate=${startDate.toISOString()} amount=${sub.plan.price} cycle=${sub.plan.billingCycle} payerEmail=${payerEmail}`);

    const { preapprovalId, initPoint } = await createMpPreapproval({
      subscriptionId,
      reason:            `${sub.plan.name} — ${sub.barbershop.name}`,
      payerEmail,  // undefined → MP deixa o cliente entrar com o próprio e-mail
      transactionAmount: sub.plan.price,
      billingCycle:      sub.plan.billingCycle,
      startDate,
      backUrl:           `${baseUrl}/assinatura-confirmada?id=${subscriptionId}`,
      notificationUrl:   `${baseUrl}/api/payments/webhook`,
    }, barbershopToken);

    // Persiste ID + link + status no banco (igual ao fluxo de criação automática)
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        mpPreapprovalId:     preapprovalId,
        authorizationLink:   initPoint,
        authorizationStatus: "PENDING_AUTH",
        authorizationSentAt: new Date(),
      } as any,
    });

    console.log(`[preapproval] Criado: sub=${subscriptionId} preapproval=${preapprovalId}`);

    return NextResponse.json({ preapprovalId, checkoutUrl: initPoint }, { status: 201 });
  } catch (e: unknown) {
    // O SDK do MP pode lançar objetos não-Error — extraímos a mensagem manualmente
    let msg = "Erro ao criar cobrança recorrente";
    if (e instanceof Error) {
      msg = e.message;
    } else if (typeof e === "object" && e !== null) {
      const err = e as Record<string, unknown>;
      msg = String(err.message ?? err.error ?? err.cause ?? JSON.stringify(e));
    }
    console.error("[preapproval] POST error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── DELETE /api/payments/preapproval?subscriptionId=... ─────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { searchParams } = new URL(req.url);
    const subscriptionId = searchParams.get("subscriptionId");

    if (!subscriptionId) {
      return NextResponse.json({ error: "subscriptionId obrigatório" }, { status: 400 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { id: subscriptionId, barbershopId: payload.barbershopId! },
      select: { mpPreapprovalId: true } as any,
    });

    if (!sub) {
      return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    }

    const mpId = (sub as any).mpPreapprovalId as string | null;

    if (mpId) {
      // Busca token da barbearia para cancelar no contexto correto
      // findFirst em vez de findUnique: `active` não é parte da chave única
      const gatewayConfig = await (prisma as any).paymentGatewayConfig.findFirst({
        where:  { barbershopId: payload.barbershopId!, active: true },
        select: { accessToken: true },
      });
      const barbershopToken = gatewayConfig?.accessToken
        ? decrypt(gatewayConfig.accessToken)
        : undefined;

      await cancelMpPreapproval(mpId, barbershopToken);
    }

    // Limpa mpPreapprovalId + link + status independentemente de ter ID no MP
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        mpPreapprovalId:     null,
        authorizationLink:   null,
        authorizationStatus: "MANUAL",
        authorizationSentAt: null,
      } as any,
    });

    console.log(`[preapproval] Cancelado e campos limpos: sub=${subscriptionId} preapproval=${mpId ?? "sem-id"}`);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    let msg = "Erro ao cancelar cobrança recorrente";
    if (e instanceof Error) {
      msg = e.message;
    } else if (typeof e === "object" && e !== null) {
      msg = String((e as any).message ?? (e as any).error ?? JSON.stringify(e));
    }
    console.error("[preapproval] DELETE error:", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
