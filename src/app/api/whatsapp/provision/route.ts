import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import * as evolution from "@/lib/evolution/client";

export const maxDuration = 30;

const CLEANUP_TIMEOUT_MS = 500;

function withDbTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Database timeout after ${ms}ms — verifique a conexão Supabase`)), ms)
    ),
  ]);
}

// Sentinel: instância ainda não criada no Evolution — será criada na primeira chamada a /qrcode
const PENDING_TOKEN = "__pending__";

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const elapsed = () => `${Date.now() - t0}ms`;

  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    console.log(`[Provision] start barbershopId=${barbershopId}`);

    const body = await req.json().catch(() => ({}));
    const manualInstanceName = body.instanceName?.trim();
    const manualToken = body.token?.trim();

    // Leituras paralelas — custo total = max(3s, 3s) = 3s
    const [barbershop, existing] = await Promise.all([
      withDbTimeout(prisma.barbershop.findUnique({ where: { id: barbershopId } }), 3000),
      withDbTimeout(prisma.whatsAppInstance.findUnique({ where: { barbershopId } }), 3000),
    ]);
    console.log(`[Provision] db reads done at ${elapsed()}, existing=${!!existing}`);

    if (!barbershop) {
      return NextResponse.json({ error: "Barbershop not found" }, { status: 404 });
    }

    const paidPlans = ["PRO", "ELITE", "PREMIUM"];
    if (!paidPlans.includes(barbershop.saasPlan)) {
      return NextResponse.json(
        { error: "WhatsApp requer um plano pago (PRO ou ELITE)" },
        { status: 403 }
      );
    }

    if (existing) {
      if (existing.status === "CONNECTED" && (!manualInstanceName || existing.evolutionInstanceName === manualInstanceName)) {
        return NextResponse.json(
          { error: "Already connected. Disconnect first to re-provision" },
          { status: 409 }
        );
      }
      // Fire-and-forget: não bloqueia o provision
      evolution.logoutInstance(existing.evolutionInstanceName, CLEANUP_TIMEOUT_MS).catch(() => {});
    }

    let instanceName: string;
    let token: string;

    if (manualInstanceName && manualToken) {
      // Conexão manual: instância já existe no Evolution
      instanceName = manualInstanceName;
      token = manualToken;
      console.log(`[Provision] manual connect to ${instanceName} at ${elapsed()}`);
    } else {
      // Fluxo automático: criação da instância no Evolution ocorre em /qrcode (orçamento separado)
      instanceName = `${barbershop.slug}-${barbershop.id.slice(0, 6)}`;
      token = PENDING_TOKEN;
      // Fire-and-forget: limpa possível instância órfã no Evolution
      evolution.deleteInstance(instanceName, CLEANUP_TIMEOUT_MS).catch(() => {});
      console.log(`[Provision] auto flow — Evolution creation deferred to /qrcode at ${elapsed()}`);
    }

    // Upsert DB apenas — sem chamar Evolution API (elimina o gargalo de timeout)
    console.log(`[Provision] upserting to db at ${elapsed()}`);
    const instance = await withDbTimeout(
      prisma.whatsAppInstance.upsert({
        where: { barbershopId },
        update: {
          evolutionInstanceName: instanceName,
          evolutionToken: token,
          status: "PENDING",
          lastQrCode: null,
        },
        create: {
          barbershopId,
          evolutionInstanceName: instanceName,
          evolutionToken: token,
          status: "PENDING",
          lastQrCode: null,
        },
      }),
      2000
    );
    console.log(`[Provision] done at ${elapsed()}`);

    return NextResponse.json({
      instanceName: instance.evolutionInstanceName,
      qrcode: null, // null → frontend chama /qrcode imediatamente
      status: "PENDING",
      message: manualInstanceName
        ? "Manual connection successful"
        : "Instance queued — QR code will be available shortly via /qrcode",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    console.error(`[Provision] unhandled error at ${elapsed()}: ${msg}`);
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
