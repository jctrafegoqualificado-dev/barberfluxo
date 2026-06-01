import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";

// URL do webhook N8N — toda nova instância aponta automaticamente para o assistente IA
const WEBHOOK_URL = process.env.N8N_EVOLUTION_WEBHOOK_URL ?? "";

// Permite até 30s nesta rota (requer Vercel Pro; Hobby fica em 10s)
export const maxDuration = 30;

// Timeout curto para operações de limpeza (best-effort, não bloqueia o fluxo principal)
const CLEANUP_TIMEOUT_MS = 500;

// Evita que queries Prisma travem indefinidamente em cold starts serverless.
// Sem isso, o Vercel Hobby mata a função em 10s e retorna 502 com body vazio.
function withDbTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Database timeout after ${ms}ms — verifique a conexão Supabase`)), ms)
    ),
  ]);
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const elapsed = () => `${Date.now() - t0}ms`;

  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    console.log(`[Provision] start barbershopId=${barbershopId}`);

    // 0. Ler corpo da requisição (opcional para conexão manual)
    const body = await req.json().catch(() => ({}));
    const manualInstanceName = body.instanceName?.trim();
    const manualToken = body.token?.trim();

    // 1. Leituras paralelas — economiza ~3s vs. sequencial no Vercel Hobby (limite 10s)
    const [barbershop, existing] = await Promise.all([
      withDbTimeout(prisma.barbershop.findUnique({ where: { id: barbershopId } }), 2000),
      withDbTimeout(prisma.whatsAppInstance.findUnique({ where: { barbershopId } }), 2000),
    ]);
    console.log(`[Provision] db reads done at ${elapsed()}, existing=${!!existing}`);

    if (!barbershop) {
      return NextResponse.json({ error: "Barbershop not found" }, { status: 404 });
    }

    // 2. Validar plano pago (PRO, ELITE ou PREMIUM legado)
    const paidPlans = ["PRO", "ELITE", "PREMIUM"];
    if (!paidPlans.includes(barbershop.saasPlan)) {
      return NextResponse.json(
        { error: "WhatsApp requer um plano pago (PRO ou ELITE)" },
        { status: 403 }
      );
    }

    if (existing) {
      // Se for a mesma instância manual que já está conectada, avisar
      if (existing.status === "CONNECTED" && (!manualInstanceName || existing.evolutionInstanceName === manualInstanceName)) {
        return NextResponse.json(
          { error: "Already connected. Disconnect first to re-provision" },
          { status: 409 }
        );
      }

      // Fire-and-forget: logout da antiga sem bloquear o fluxo principal
      evolution.logoutInstance(existing.evolutionInstanceName, CLEANUP_TIMEOUT_MS).catch(() => {});
    }

    let instanceName = manualInstanceName;
    let token = manualToken;
    let qrcodeBase64 = null;

    if (manualInstanceName && manualToken) {
      // CONEXÃO MANUAL (Instância já criada no Evolution)
      console.log(`[Provision] manual connect to ${instanceName} at ${elapsed()}`);
    } else {
      // CRIAÇÃO AUTOMÁTICA (Fluxo padrão)
      instanceName = `${barbershop.slug}-${barbershop.id.slice(0, 6)}`;

      // Fire-and-forget: delete preventivo sem bloquear o fluxo
      evolution.deleteInstance(instanceName, CLEANUP_TIMEOUT_MS).catch(() => {});

      // Criar instância no Evolution — 5s de budget (restou ~8s do limite Hobby)
      console.log(`[Provision] calling createInstance at ${elapsed()}`);
      const createResult = await evolution.createInstance(instanceName, 5000);
      console.log(`[Provision] createInstance done at ${elapsed()}, error=${"error" in createResult}`);
      if ("error" in createResult) {
        console.error(`[Provision] createInstance error: ${createResult.error}`);
        return NextResponse.json(
          { error: `Falha ao criar instância WhatsApp: ${createResult.error}` },
          { status: 502 }
        );
      }
      token = createResult.token;
      qrcodeBase64 = createResult.qrcodeBase64;
    }

    // Configurar webhook — fire-and-forget
    if (WEBHOOK_URL) {
      evolution.setWebhook(instanceName, WEBHOOK_URL).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[Provision] webhook setup failed (non-fatal): ${msg}`);
      });
    } else {
      console.warn(`[Provision] N8N_EVOLUTION_WEBHOOK_URL não configurada — webhook ignorado`);
    }

    // Upsert atômico — elimina o delete+create separado (economiza ~3s no caso de instância existente)
    console.log(`[Provision] upserting to db at ${elapsed()}`);
    const instance = await withDbTimeout(
      prisma.whatsAppInstance.upsert({
        where: { barbershopId },
        update: {
          evolutionInstanceName: instanceName,
          evolutionToken: token,
          status: "PENDING",
          lastQrCode: qrcodeBase64 || null,
        },
        create: {
          barbershopId,
          evolutionInstanceName: instanceName,
          evolutionToken: token,
          status: "PENDING",
          lastQrCode: qrcodeBase64 || null,
        },
      }),
      2000
    );
    console.log(`[Provision] done at ${elapsed()}`);

    return NextResponse.json({
      instanceName: instance.evolutionInstanceName,
      qrcode: qrcodeBase64,
      status: "PENDING",
      message: manualInstanceName ? "Manual connection successful" : "Scan QR code with WhatsApp to connect",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error(`[Provision] unhandled error at ${elapsed()}: ${msg}`);
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
