/**
 * mercadopago.ts — Helpers centralizados para a API do Mercado Pago
 *
 * Preapproval = assinatura recorrente autorizada pelo cliente.
 * O cliente autoriza o débito automático uma vez e o MP cobra
 * automaticamente a cada ciclo (mensal, trimestral, anual).
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/subscriptions
 */

import MercadoPago, { PreApproval } from "mercadopago";

// ─── Client factory ───────────────────────────────────────────────────────────

function getMpClient(): MercadoPago {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  return new MercadoPago({ accessToken: token });
}

// ─── Billing cycle → MP frequency ────────────────────────────────────────────

function cycleToFrequency(billingCycle: string): {
  frequency: number;
  frequency_type: "months";
} {
  switch (billingCycle) {
    case "QUARTERLY":
      return { frequency: 3, frequency_type: "months" };
    case "YEARLY":
      return { frequency: 12, frequency_type: "months" };
    default: // MONTHLY
      return { frequency: 1, frequency_type: "months" };
  }
}

// ─── Create Preapproval ───────────────────────────────────────────────────────

export interface CreatePreapprovalInput {
  /** ID da Subscription no banco — usado como external_reference para rastrear */
  subscriptionId: string;
  /** Texto exibido ao cliente na tela de autorização. Ex: "Plano Premium — Barbearia X" */
  reason: string;
  /** E-mail do cliente (obrigatório pelo MP) */
  payerEmail: string;
  /** Valor a cobrar por ciclo (plan.price) */
  transactionAmount: number;
  /** "MONTHLY" | "QUARTERLY" | "YEARLY" — mapeado para frequency do MP */
  billingCycle: string;
  /** Data da primeira cobrança (subscription.nextBillingDate) */
  startDate: Date;
  /** URL de retorno após o cliente autorizar */
  backUrl: string;
}

export interface CreatePreapprovalResult {
  preapprovalId: string;
  /** Link de checkout para o cliente autorizar o débito automático */
  initPoint: string;
}

/**
 * Cria um Preapproval no Mercado Pago.
 * O cliente recebe `initPoint` e autoriza o débito recorrente.
 * O MP cobra automaticamente a cada ciclo e notifica via webhook.
 */
export async function createMpPreapproval(
  input: CreatePreapprovalInput,
): Promise<CreatePreapprovalResult> {
  const client = getMpClient();
  const api = new PreApproval(client);
  const { frequency, frequency_type } = cycleToFrequency(input.billingCycle);

  const result = await api.create({
    body: {
      reason: input.reason,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      external_reference: input.subscriptionId,
      auto_recurring: {
        frequency,
        frequency_type,
        transaction_amount: input.transactionAmount,
        currency_id: "BRL",
        start_date: input.startDate.toISOString(),
      },
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error(
      `MP não retornou id/init_point ao criar preapproval para sub=${input.subscriptionId}`,
    );
  }

  return { preapprovalId: result.id, initPoint: result.init_point };
}

// ─── Cancel Preapproval ───────────────────────────────────────────────────────

/**
 * Cancela um Preapproval no MP (status → "cancelled").
 * Deve ser chamado ao cancelar ou excluir uma Subscription.
 * Fire-and-forget: erros são logados mas não interrompem o fluxo principal.
 */
export async function cancelMpPreapproval(preapprovalId: string): Promise<void> {
  const client = getMpClient();
  const api = new PreApproval(client);
  await api.update({ id: preapprovalId, body: { status: "cancelled" } });
}

// ─── Get Authorized Payment ───────────────────────────────────────────────────

export interface MpAuthorizedPayment {
  id: string;
  /** ID do preapproval que originou este pagamento */
  preapproval_id: string;
  /** "processed" = cobrado com sucesso | "recycling" = tentativa em andamento | "cancelled" = falhou */
  status: string;
  transaction_amount: number;
  currency_id: string;
  payment_method_id?: string;
}

/**
 * Busca um authorized_payment pelo ID via REST direto.
 * O SDK v2 não expõe AuthorizedPayment como classe dedicada,
 * por isso usamos fetch diretamente.
 *
 * Docs: GET /authorized_payments/{id}
 */
export async function getMpAuthorizedPayment(id: string): Promise<MpAuthorizedPayment> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");

  const res = await fetch(`https://api.mercadopago.com/authorized_payments/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    // Sem cache — precisamos do status em tempo real
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MP authorized_payment ${id}: HTTP ${res.status} — ${text}`);
  }

  return res.json() as Promise<MpAuthorizedPayment>;
}
