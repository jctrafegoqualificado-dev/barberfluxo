import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "./util";
import type { ApiKey } from "@prisma/client";

export async function validateApiKey(req: NextRequest): Promise<{
  valid: boolean;
  apiKey?: ApiKey;
  barbershopId?: string;
}> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return { valid: false };

  const token = auth.slice(7);
  if (!token.startsWith("bf_")) return { valid: false };

  const hash = hashApiKey(token);

  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
  if (!apiKey) return { valid: false };
  if (apiKey.revokedAt !== null) return { valid: false };

  try {
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });
  } catch {
    // não derruba o request se a atualização falhar
  }

  return { valid: true, apiKey, barbershopId: apiKey.barbershopId };
}
