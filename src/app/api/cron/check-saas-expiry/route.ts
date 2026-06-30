import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/evolution/client";
import { setCronHealth } from "@/lib/cron-health";
import { GRACE_DAYS } from "@/lib/entitlements";

/**
 * check-saas-expiry — Cron de Vencimento de Planos SaaS (paywall)
 *
 * Fluxo (carência de GRACE_DAYS dias):
 *  1. ACTIVE vencido  → OVERDUE (mantém o plano). Inicia a carência.
 *  2. OVERDUE além da carência → rebaixa para BASIC (bloqueio efetivo).
 *  3. Avisa quem vence em até 3 dias.
 *
 * O acesso em si é decidido por getEntitlements (que já corta no fim da carência
 * mesmo que o passo 2 ainda não tenha rodado). Este cron cuida das transições de
 * estado e das notificações.
 *
 * Executa diariamente às 09:00 BRT (12:00 UTC).
 * Proteção: CRON_SECRET obrigatório (Authorization: Bearer <secret>).
 */
export async function GET(req: NextRequest) {
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

  const startedAt = Date.now();
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const graceCutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000);
  const APP_URL = process.env.NEXTAUTH_URL;

  const instanceSelect = {
    evolutionInstanceName: true,
    evolutionToken: true,
    status: true,
  } as const;

  let markedOverdue = 0;
  let blocked = 0;
  let warningSent = 0;

  try {
    // ── 1. ACTIVE vencido → OVERDUE (mantém plano; inicia a carência) ────────
    const expired = await prisma.barbershop.findMany({
      where: { saasStatus: "ACTIVE", saasExpiresAt: { lt: now } },
      select: {
        id: true,
        name: true,
        owner: { select: { name: true, phone: true } },
        whatsappInstance: { select: instanceSelect },
      },
    });

    if (expired.length > 0) {
      await prisma.barbershop.updateMany({
        where: { id: { in: expired.map((b) => b.id) }, saasStatus: "ACTIVE" },
        data: { saasStatus: "OVERDUE" }, // mantém o plano durante a carência
      });
      markedOverdue = expired.length;

      for (const shop of expired) {
        const instance = shop.whatsappInstance;
        if (instance?.status !== "CONNECTED" || !shop.owner?.phone) continue;
        const msg = [
          `⚠️ *${shop.name}* — Plano vencido`,
          ``,
          `Olá, ${shop.owner.name?.split(" ")[0] || "parceiro"}! Seu plano da *IaDeBarbearia* venceu.`,
          ``,
          `Você tem *${GRACE_DAYS} dias* para renovar antes do acesso ser suspenso:`,
          `👉 ${APP_URL}/painel/assinatura`,
        ].join("\n");
        await sendMessage(
          instance.evolutionInstanceName,
          shop.owner.phone,
          msg,
          1200,
          instance.evolutionToken ?? undefined
        ).catch(() => {});
      }
      console.log(`[check-saas-expiry] ${markedOverdue} marcada(s) OVERDUE (carência iniciada)`);
    }

    // ── 2. OVERDUE além da carência → rebaixa para BASIC (bloqueio) ──────────
    const toBlock = await prisma.barbershop.findMany({
      where: {
        saasStatus: "OVERDUE",
        saasExpiresAt: { lt: graceCutoff },
        saasPlan: { not: "BASIC" },
      },
      select: {
        id: true,
        name: true,
        owner: { select: { name: true, phone: true } },
        whatsappInstance: { select: instanceSelect },
      },
    });

    if (toBlock.length > 0) {
      await prisma.barbershop.updateMany({
        where: { id: { in: toBlock.map((b) => b.id) }, saasStatus: "OVERDUE" },
        data: { saasPlan: "BASIC" },
      });
      blocked = toBlock.length;

      for (const shop of toBlock) {
        const instance = shop.whatsappInstance;
        if (instance?.status !== "CONNECTED" || !shop.owner?.phone) continue;
        const msg = [
          `🔒 *${shop.name}* — Acesso suspenso`,
          ``,
          `Seu plano da *IaDeBarbearia* não foi renovado e o acesso foi suspenso.`,
          ``,
          `Assine novamente para reativar o sistema:`,
          `👉 ${APP_URL}/painel/assinatura`,
        ].join("\n");
        await sendMessage(
          instance.evolutionInstanceName,
          shop.owner.phone,
          msg,
          1200,
          instance.evolutionToken ?? undefined
        ).catch(() => {});
      }
      console.log(`[check-saas-expiry] ${blocked} barbearia(s) bloqueada(s) após carência`);
    }

    // ── 3. Avisar quem vence em até 3 dias ──────────────────────────────────
    const expiringSoon = await prisma.barbershop.findMany({
      where: { saasStatus: "ACTIVE", saasExpiresAt: { gte: now, lte: in3Days } },
      select: {
        id: true,
        name: true,
        saasExpiresAt: true,
        owner: { select: { name: true, phone: true } },
        whatsappInstance: { select: instanceSelect },
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
        `Seu plano da *IaDeBarbearia* vence em *${daysLeft} dia${daysLeft !== 1 ? "s" : ""}*.`,
        ``,
        `Renove para manter o acesso e todas as funcionalidades:`,
        `👉 ${APP_URL}/painel/assinatura`,
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

    const result = { markedOverdue, blocked, warningSent, expiringSoon: expiringSoon.length };
    await setCronHealth("check-saas-expiry", "ok", Date.now() - startedAt, result);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[check-saas-expiry] Fatal:", msg);
    await setCronHealth("check-saas-expiry", "error", Date.now() - startedAt, { error: msg });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
