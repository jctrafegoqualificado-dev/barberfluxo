/**
 * mercadopago.ts — Helpers centralizados para a API do Mercado Pago
 *
 * Preapproval = assinatura recorrente autorizada pelo cliente.
 * O cliente autoriza o débito automático uma vez e o MP cobra
 * automaticamente a cada ciclo (mensal, trimestral, anual).
 *
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/subscriptions
 *
 * Multi-tenant: todas as funções aceitam `accessToken` opcional.
 * - Se fornecido → usa o token DA barbearia (gateway configurado pela barbearia)
 * - Se omitido  → usa MERCADOPAGO_ACCESS_TOKEN do .env (token da plataforma)
 * Isso garante compatibilidade total com o código existente (cobrança de SaaS).
 */

import MercadoPago, { PreApproval, Preference, Payment } from "mercadopago";

// ─── Client factory ───────────────────────────────────────────────────────────

/**
 * Cria um cliente MP.
 * @param accessToken Token da barbearia (opcional). Sem ele, usa o token da plataforma (.env).
 */
function getMpClient(accessToken?: string): MercadoPago {
  const token = accessToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
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
  /**
   * URL que o MP chama a cada cobrança automática (webhook).
   * Sem isso o sistema não sabe quando o cliente foi cobrado.
   */
  notificationUrl?: string;
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
 *
 * @param input  Dados da assinatura
 * @param accessToken  Token da barbearia (opcional — omita para usar token da plataforma)
 */
export async function createMpPreapproval(
  input: CreatePreapprovalInput,
  accessToken?: string,
): Promise<CreatePreapprovalResult> {
  const client = getMpClient(accessToken);
  const api = new PreApproval(client);
  const { frequency, frequency_type } = cycleToFrequency(input.billingCycle);

  const result = await api.create({
    body: {
      reason: input.reason,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      notification_url: input.notificationUrl,
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
 *
 * @param preapprovalId  ID do preapproval no MP
 * @param accessToken    Token da barbearia (opcional — omita para usar token da plataforma)
 */
export async function cancelMpPreapproval(preapprovalId: string, accessToken?: string): Promise<void> {
  const client = getMpClient(accessToken);
  const api = new PreApproval(client);
  await api.update({ id: preapprovalId, body: { status: "cancelled" } });
}

// ─── Pause / Resume Preapproval ───────────────────────────────────────────────

/**
 * Pausa um Preapproval no MP (status → "paused").
 * MP não fará cobranças automáticas até que seja retomado.
 * Usado quando o dono dá baixa manual em uma assinatura com MP autorizado
 * (evita dupla cobrança no balcão + débito automático).
 */
export async function pauseMpPreapproval(preapprovalId: string, accessToken?: string): Promise<void> {
  const client = getMpClient(accessToken);
  const api = new PreApproval(client);
  await api.update({ id: preapprovalId, body: { status: "paused" } });
}

/**
 * Retoma um Preapproval pausado (status → "authorized").
 * MP volta a cobrar automaticamente a partir da próxima data de cobrança.
 */
export async function resumeMpPreapproval(preapprovalId: string, accessToken?: string): Promise<void> {
  const client = getMpClient(accessToken);
  const api = new PreApproval(client);
  await api.update({ id: preapprovalId, body: { status: "authorized" } });
}

// ─── Get Preapproval ─────────────────────────────────────────────────────────

export interface MpPreapproval {
  id: string;
  /** "pending" | "authorized" | "paused" | "cancelled" */
  status: string;
  payer_email: string;
  external_reference?: string;
  auto_recurring?: {
    frequency: number;
    frequency_type: string;
    transaction_amount: number;
    currency_id: string;
  };
}

/**
 * Busca um Preapproval existente pelo ID.
 * Usado no webhook para confirmar o status atual após notificação do MP.
 *
 * @param id           ID do preapproval no MP
 * @param accessToken  Token da barbearia (opcional — omita para usar token da plataforma)
 */
export async function getMpPreapproval(id: string, accessToken?: string): Promise<MpPreapproval> {
  const client = getMpClient(accessToken);
  const api = new PreApproval(client);
  const result = await api.get({ id });
  if (!result?.id) {
    throw new Error(`MP não retornou dados para preapproval ${id}`);
  }
  return result as unknown as MpPreapproval;
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
 *
 * @param id           ID do authorized_payment no MP
 * @param accessToken  Token da barbearia (opcional — omita para usar token da plataforma)
 */
export async function getMpAuthorizedPayment(id: string, accessToken?: string): Promise<MpAuthorizedPayment> {
  const token = accessToken ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
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

// ─── Create Payment Preference (avulso / one-time) ────────────────────────────

export interface CreatePreferenceInput {
  /** Identificador interno (ex: appointmentId) — vem de volta no webhook */
  externalReference: string;
  /** Título do item exibido no checkout MP */
  title: string;
  /** Valor único a ser cobrado */
  unitPrice: number;
  /** E-mail do pagador (opcional — MP pede em alguns fluxos) */
  payerEmail?: string;
  /** URL de retorno após pagamento aprovado */
  successUrl: string;
  /** URL chamada pelo MP para notificar eventos */
  notificationUrl: string;
}

export interface CreatePreferenceResult {
  preferenceId: string;
  /** Link do checkout para enviar ao cliente */
  initPoint: string;
}

/**
 * Cria uma Preference no MP para cobrança avulsa (ex: pagamento de um agendamento).
 * Diferente do Preapproval, esta cobra uma única vez.
 *
 * @param input        Dados da cobrança
 * @param accessToken  Token da barbearia (opcional — omita para usar token da plataforma)
 */
export async function createMpPreference(
  input: CreatePreferenceInput,
  accessToken?: string,
): Promise<CreatePreferenceResult> {
  const client = getMpClient(accessToken);
  const api = new Preference(client);

  const result = await api.create({
    body: {
      items: [
        {
          id:         input.externalReference,
          title:      input.title,
          quantity:   1,
          unit_price: input.unitPrice,
          currency_id: "BRL",
        },
      ],
      external_reference: input.externalReference,
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      back_urls: {
        success: input.successUrl,
        failure: input.successUrl,
        pending: input.successUrl,
      },
      auto_return:      "approved",
      notification_url: input.notificationUrl,
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error(
      `MP não retornou id/init_point ao criar preference para ref=${input.externalReference}`,
    );
  }

  return { preferenceId: result.id, initPoint: result.init_point };
}

// ─── Get Payment (avulso — pagamento único) ───────────────────────────────────

export interface MpPayment {
  id: number | string;
  /** "approved" | "pending" | "rejected" | "cancelled" | "refunded" */
  status: string;
  status_detail?: string;
  transaction_amount: number;
  currency_id: string;
  payment_method_id?: string;
  /** Vem do external_reference que enviamos ao criar a preference */
  external_reference?: string;
  payer?: { email?: string };
}

/**
 * Busca um Payment (pagamento único) pelo ID.
 * Usado pelo webhook quando MP notifica `type=payment` (avulso, não-recorrente).
 */
export async function getMpPayment(id: string, accessToken?: string): Promise<MpPayment> {
  const client = getMpClient(accessToken);
  const api = new Payment(client);
  const result = await api.get({ id });
  if (!result?.id) {
    throw new Error(`MP não retornou dados para payment ${id}`);
  }
  return result as unknown as MpPayment;
}
