import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/evolution/client";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const querySecret = req.nextUrl.searchParams.get("secret");
    const providedSecret = authHeader?.replace("Bearer ", "") || querySecret;

    if (CRON_SECRET && providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Dia de amanhã (UTC-3)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowDay = tomorrow.getUTCDate(); // dia do mês (1-31) em UTC, suficiente para billingDay

    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        billingDay: tomorrowDay,
      },
      include: {
        client: { select: { name: true, phone: true } },
        plan: { select: { name: true, price: true } },
        barbershop: {
          select: {
            name: true,
            whatsappInstance: {
              select: { evolutionInstanceName: true, evolutionToken: true, status: true },
            },
          },
        },
      },
    });

    console.log(`[subscription-renewal] billingDay=${tomorrowDay}, found=${subscriptions.length}`);

    let sent = 0;
    let skipped = 0;

    // Agrupa por barbearia para enviar resumo ao dono
    const byShop: Record<string, { shopName: string; count: number; ownerPhone: string | null; instance: { evolutionInstanceName: string; evolutionToken?: string | null } | null }> = {};

    for (const sub of subscriptions) {
      const instance = sub.barbershop.whatsappInstance;
      const connected = instance?.status === "CONNECTED";

      // Mensagem ao cliente
      if (connected && sub.client.phone) {
        const firstName = sub.client.name.split(" ")[0];
        const price = sub.plan.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const msg = [
          `Olá, ${firstName}! 👋`,
          ``,
          `Sua assinatura *${sub.plan.name}* no(a) *${sub.barbershop.name}* vence amanhã, dia *${tomorrowDay}*.`,
          ``,
          `Valor: *${price}*`,
          ``,
          `Entre em contato com a barbearia para renovar e continuar aproveitando seus benefícios! ✂️`,
        ].join("\n");

        const result = await sendMessage(
          instance!.evolutionInstanceName,
          sub.client.phone,
          msg,
          1200,
          instance!.evolutionToken ?? undefined
        );

        if ("error" in result) {
          console.error(`[subscription-renewal] Erro ao notificar cliente ${sub.client.phone}:`, result.error);
          skipped++;
        } else {
          sent++;
        }

        await new Promise((r) => setTimeout(r, 1500));
      } else {
        skipped++;
      }

      // Acumula por barbearia para resumo ao dono
      const shopId = sub.barbershopId;
      if (!byShop[shopId]) {
        byShop[shopId] = {
          shopName: sub.barbershop.name,
          count: 0,
          ownerPhone: null,
          instance: connected ? instance : null,
        };
      }
      byShop[shopId].count++;
    }

    // Busca telefone do dono de cada barbearia e envia resumo
    for (const [shopId, info] of Object.entries(byShop)) {
      if (!info.instance) continue;

      const owner = await prisma.user.findFirst({
        where: { role: "OWNER", ownedShop: { id: shopId } },
        select: { name: true, phone: true },
      });

      if (!owner?.phone) continue;

      const msg = [
        `📋 *Renovações de amanhã — ${info.shopName}*`,
        ``,
        `${info.count} assinatura${info.count > 1 ? "s vencem" : " vence"} amanhã (dia ${tomorrowDay}).`,
        `Os clientes já foram notificados via WhatsApp.`,
        ``,
        `Acesse o painel para acompanhar os pagamentos.`,
      ].join("\n");

      const result = await sendMessage(
        info.instance.evolutionInstanceName,
        owner.phone,
        msg,
        1200,
        info.instance.evolutionToken ?? undefined
      );

      if (!("error" in result)) {
        sent++;
      }

      await new Promise((r) => setTimeout(r, 1500));
    }

    return NextResponse.json({ ok: true, billingDay: tomorrowDay, processed: subscriptions.length, sent, skipped });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[subscription-renewal] Fatal:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
