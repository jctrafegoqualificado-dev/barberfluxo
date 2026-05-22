import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-keys/util";

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);

    const body = await req.json();
    const { name, barbershopId } = body as { name?: string; barbershopId?: string };

    if (!name || !barbershopId) {
      return NextResponse.json({ error: "name e barbershopId são obrigatórios" }, { status: 400 });
    }

    if (payload.barbershopId !== barbershopId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const barbershop = await prisma.barbershop.findUnique({ where: { id: barbershopId } });
    if (!barbershop) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    }

    const { token, hash, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: { keyHash: hash, keyPrefix: prefix, name, barbershopId },
    });

    console.log(`🔑 [API Key] Criada: prefix=${prefix}, barbershopId=${barbershopId}, name=${name}`);

    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      barbershopId: apiKey.barbershopId,
      prefix,
      apiKey: token,
      warning: "Salve esta key agora — ela não será exibida novamente.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const keys = await prisma.apiKey.findMany({
      where: { barbershopId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      keys: keys.map((k) => ({ ...k, prefix: k.keyPrefix, keyPrefix: undefined })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    if (msg === "UNAUTHORIZED") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "FORBIDDEN") return NextResponse.json({ error: msg }, { status: 403 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
