import MercadoPago, { PreApproval } from "mercadopago";
import { prisma } from "@/lib/prisma";
import { saasCharge } from "@/lib/saasPlans";
import { billableBarbers, loadSaasPlans } from "@/lib/saasPlans.server";

/**
 * Barbearia com cobrança automática (assinatura do Mercado Pago criada por "Gerar Link MP"):
 * quando a equipe muda, o valor da assinatura acompanha (plano + barbeiros extras) a partir da
 * próxima cobrança. Sem assinatura automática, não faz nada — o valor novo entra no próximo
 * pagamento feito na Minha assinatura.
 *
 * Nunca lança erro: quem chama (cadastro/desativação de barbeiro) não pode falhar por causa do MP.
 */
export async function syncRecurringAmount(barbershopId: string): Promise<void> {
  try {
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token) return;
    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { mpSubscriptionId: true, saasPlan: true, saasStatus: true },
    });
    if (!shop?.mpSubscriptionId || shop.saasStatus === "CANCELLED") return;

    const [plans, barbers] = await Promise.all([loadSaasPlans(), billableBarbers(barbershopId)]);
    const charge = saasCharge(shop.saasPlan, "monthly", barbers, plans);
    if (!charge) return;

    const api = new PreApproval(new MercadoPago({ accessToken: token }));
    const current = await api.get({ id: shop.mpSubscriptionId });
    if (current.status === "cancelled") return;
    if (Math.abs((current.auto_recurring?.transaction_amount ?? 0) - charge.total) < 0.01) return;

    await api.update({ id: shop.mpSubscriptionId, body: { auto_recurring: { transaction_amount: charge.total, currency_id: "BRL" } } });
    console.log(`[saasRecurring] ${barbershopId}: assinatura MP agora ${charge.total} (${barbers} barbeiros)`);
  } catch (err) {
    console.error("[saasRecurring] não foi possível atualizar o valor da assinatura:", err);
  }
}
