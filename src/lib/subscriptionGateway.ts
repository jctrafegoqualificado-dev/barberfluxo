import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encrypt";
import { cancelMpPreapproval, pauseMpPreapproval } from "@/lib/mercadopago";

/**
 * Débito automático (Mercado Pago) das assinaturas de cliente.
 *
 * O preapproval foi criado com o token DA BARBEARIA — cancelar/pausar com o token da
 * plataforma falha e o MP continua cobrando o cliente. Sempre usar estas funções.
 * Melhor esforço: erro no MP só é logado, a operação no banco segue.
 */

async function shopToken(barbershopId: string): Promise<string | null> {
  const cfg = await prisma.paymentGatewayConfig.findUnique({
    where: { barbershopId },
    select: { accessToken: true },
  });
  return cfg?.accessToken ? decrypt(cfg.accessToken) : null;
}

export async function cancelAutoDebit(barbershopId: string, preapprovalId: string | null | undefined, context: string) {
  if (!preapprovalId) return;
  try {
    const token = await shopToken(barbershopId);
    if (!token) { console.error(`[mp ${context}] Sem token da barbearia para cancelar ${preapprovalId}`); return; }
    await cancelMpPreapproval(preapprovalId, token);
  } catch (err) {
    console.error(`[mp ${context}] Falha ao cancelar preapproval ${preapprovalId}:`, err);
  }
}

/** Pausa o débito; devolve true se pausou (para marcar authorizationStatus = PAUSED). */
export async function pauseAutoDebit(barbershopId: string, preapprovalId: string | null | undefined, context: string): Promise<boolean> {
  if (!preapprovalId) return false;
  try {
    const token = await shopToken(barbershopId);
    if (!token) return false;
    await pauseMpPreapproval(preapprovalId, token);
    return true;
  } catch (err) {
    console.error(`[mp ${context}] Falha ao pausar preapproval ${preapprovalId}:`, err);
    return false;
  }
}
