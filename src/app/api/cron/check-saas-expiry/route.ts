import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/evolution/client";

/**
 * check-saas-expiry — Cron de Vencimento de Planos SaaS
 *
 * Responsabilidade: encontrar barbearias com plano pago (ACTIVE) cujo
 * saasExpiresAt já passou e marcá-las como OVERDUE.
 * Também envia aviso de vencimento 3 dias antes para o dono via WhatsApp.
 *
 * Executa diariamente às 09:00 BRT (12:00 UTC).
 * Proteção: CRON_SECRET obrigatório (Authorization: Bearer <secret>).
 */
export async function GET(req: NextRequest) {
  // ── Autenticação ──────────────────────────────────────────────────────────
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!CRON_SECRET) {
    console.error("[check-saas-expiry] CRON_SECRET não configurado");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  const authHeader  = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const provided    = authHeader?.replace("Bearer ", "").trim() ?? querySecret;

  if (provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Janela de "3 dias antes": para aviso de vencimento próximo
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  let markedOverdue = 0;
  let warningSent   = 0;

  try {
    // ── 1. Marcar como OVERDUE as que já venceram ─────────────────────────
    const expired = await prisma.barbershop.findMany({
      where: {
        saasStatus: "ACTIVE",
        saasExpiresAt: { lt: now },
      },
      select: {
        id: true,
        name: true,
        saasExpiresAt: true,
        owner: { select: { name: true, phone: true } },
        whatsappInstance: {
          select: { evolutionInstanceName: true, evolutionToken: true, status: true },
        },
      },
    });

    if (expired.length > 0) {
      await prisma.barbershop.updateMany({
        where: {
          id: { in: expired.map((b) => b.id) },
          saasStatus: "ACTIVE", // re-checa para evitar race condition
        },
        data: { saasStatus: "OVERDUE", saasPlan: "BASIC" },
      });
      markedOverdue = expired.length;

      // Notifica o dono via WhatsApp (best effort)
      for (const shop of expired) {
        const instance = shop.whatsappInstance;
        if (instance?.status !== "CONNECTED" || !shop.owner?.phone) continue;

        const msg = [
          `⚠️ *${shop.name}* — Plano vencido`,
          ``,
          `Olá, ${shop.owner.name?.split(" ")[0] || "parceiro"}! Seu plano de assinatura da *IaDeBarbearia* venceu.`,
          ``,
          `Seu acesso foi reduzido ao plano Basic. Renove agora para não perder funcionalidades:`,
          `👉 ${process.env.NEXTAUTH_URL}/painel/assinatura`,
        ].join("\n");

        await sendMessage(
          instance.evolutionInstanceName,
          shop.owner.phone,
          msg,
          1200,
          instance.evolutionToken ?? undefined
        ).catch(() => {}); // best effort
      }

      console.log(`[check-saas-expiry] ${markedOverdue} barbearia(s) marcadas como OVERDUE`);
    }

    // ── 2. Avisar quem vence em até 3 dias ────────────────────────────────
    const expiringSoon = await prisma.barbershop.findMany({
      where: {
        saasStatus: "ACTIVE",
        saasExpiresAt: { gte: now, lte: in3Days },
      },
      select: {
        id: true,
        name: true,
        saasExpiresAt: true,
        owner: { select: { name: true, phone: true } },
        whatsappInstance: {
          select: { evolutionInstanceName: true, evolutionToken: true, status: true },
        },
      },
    });

    for (const shop of expiringSoon) {
      const instance = shop.whatsappInstance;
      if (instance?.status !== "CONNECTED" || !shop.owner?.phone) continue;

      const daysLeft = Math.ceil(
        (shop.saasExpiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const msg = [
        `🔔 *Aviso de vencimento — ${shop.name}*`,
        ``,
        `Seu plano de assinatura da *IaDeBarbearia* vence em *${daysLeft} dia${daysLeft !== 1 ? "s" : ""}*.`,
        ``,
        `Renove agora para manter todas as funcionalidades ativas:`,
        `👉 ${process.env.NEXTAUTH_URL}/painel/assinatura`,
      ].join("\n");

      const result = await sendMessage(
        instance.evolutionInstanceName,
        shop.owner.phone,
        msg,
        1200,
        instance.evolutionToken ?? undefined
      ).catch(() => ({ error: "send failed" }));

      if (!("error" in result)) warningSent++;

      await new Promise((r) => setTimeout(r, 1500));
    }

    return NextResponse.json({
      ok: true,
      markedOverdue,
      warningSent,
      expiringSoon: expiringSoon.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[check-saas-expiry] Fatal:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
