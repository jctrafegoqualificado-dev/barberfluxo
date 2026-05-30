import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createHmac } from "crypto";

const {
  mockSubscriptionFindUnique,
  mockSubscriptionFindFirst,
  mockSubscriptionUpdate,
  mockPaymentUpdateMany,
  mockPaymentFindFirst,
  mockPaymentCreate,
} = vi.hoisted(() => ({
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionFindFirst: vi.fn(),
  mockSubscriptionUpdate: vi.fn(),
  mockPaymentUpdateMany: vi.fn(),
  mockPaymentFindFirst: vi.fn(),
  mockPaymentCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      findFirst: mockSubscriptionFindFirst,
      update: mockSubscriptionUpdate,
    },
    payment: {
      updateMany: mockPaymentUpdateMany,
      findFirst: mockPaymentFindFirst,
      create: mockPaymentCreate,
    },
  },
}));

const { mockPaymentGet } = vi.hoisted(() => ({ mockPaymentGet: vi.fn() }));

vi.mock("mercadopago", () => ({
  default: class MpClient { constructor(_opts: unknown) {} },
  Payment: class PaymentApi {
    get = mockPaymentGet;
    constructor(_client: unknown) {}
  },
  PreApproval: class {},
  Preference: class {},
}));

vi.mock("@/lib/mercadopago", () => ({
  getMpAuthorizedPayment: vi.fn(),
}));

vi.mock("@/lib/encrypt", () => ({
  decrypt: vi.fn().mockReturnValue("decrypted-mp-token"),
  encrypt: vi.fn().mockReturnValue("encrypted"),
}));

import { POST } from "@/app/api/payments/webhook/route";

const ACTIVE_SUB = {
  id: "sub-1",
  barbershopId: "shop-1",
  nextBillingDate: new Date("2026-05-01"),
  billingDay: 1,
  status: "ACTIVE",
  plan: { billingCycle: "MONTHLY" },
};

function makeWebhookRequest(body: object, extraHeaders: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/payments/webhook", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function validSignature(dataId: string, requestId = "") {
  const secret = "test-webhook-secret";
  const ts = "1748000000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId };
}

describe("POST /api/payments/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionUpdate.mockResolvedValue({});
    mockPaymentUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("ignora evento de tipo desconhecido e retorna ok sem tocar no banco", async () => {
    const res = await POST(makeWebhookRequest({ type: "plan", data: { id: "999" } }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    expect(mockPaymentUpdateMany).not.toHaveBeenCalled();
  });

  it("payment approved → atualiza pagamento para PAID e avança nextBillingDate", async () => {
    const dataId = "mp-pay-123";
    mockPaymentGet.mockResolvedValue({
      external_reference: "sub-1",
      status: "approved",
      payment_method_id: "pix",
    });
    mockSubscriptionFindUnique.mockResolvedValue(ACTIVE_SUB);

    const req = makeWebhookRequest(
      { type: "payment", data: { id: dataId } },
      validSignature(dataId),
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockPaymentUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { subscriptionId: "sub-1", status: "PENDING" },
        data: expect.objectContaining({ status: "PAID", method: "PIX" }),
      }),
    );
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sub-1" },
        data: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("payment rejected → marca assinatura como OVERDUE", async () => {
    const dataId = "mp-pay-456";
    mockPaymentGet.mockResolvedValue({
      external_reference: "sub-1",
      status: "rejected",
      payment_method_id: "credit_card",
    });

    const req = makeWebhookRequest(
      { type: "payment", data: { id: dataId } },
      validSignature(dataId),
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "OVERDUE" },
    });
  });

  it("payment cancelled → marca assinatura como OVERDUE", async () => {
    const dataId = "mp-pay-789";
    mockPaymentGet.mockResolvedValue({
      external_reference: "sub-1",
      status: "cancelled",
      payment_method_id: "debit_card",
    });

    const req = makeWebhookRequest(
      { type: "payment", data: { id: dataId } },
      validSignature(dataId),
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "OVERDUE" },
    });
  });

  it("payment sem external_reference → retorna ok sem atualizar assinatura", async () => {
    const dataId = "mp-pay-000";
    mockPaymentGet.mockResolvedValue({
      external_reference: null,
      status: "approved",
      payment_method_id: "pix",
    });

    const req = makeWebhookRequest(
      { type: "payment", data: { id: dataId } },
      validSignature(dataId),
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
  });

  it("signature HMAC inválida em produção → 401", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const req = makeWebhookRequest(
      { type: "payment", data: { id: "mp-123" } },
      { "x-signature": "ts=1234,v1=assinatura_errada_aqui" },
    );
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(mockPaymentGet).not.toHaveBeenCalled();

    vi.unstubAllEnvs();
  });
});
