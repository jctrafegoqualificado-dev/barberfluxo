import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Quando um cliente (User, compartilhado entre barbearias) pertence a uma barbearia:
 * já agendou, já assinou, ou foi cadastrado/importado nela (ShopClient).
 *
 * Use dentro de AND quando o where já tiver um OR próprio.
 */
export function shopClientWhere(barbershopId: string): Prisma.UserWhereInput {
  return {
    OR: [
      { appointments: { some: { barbershopId } } },
      { subscriptions: { some: { barbershopId } } },
      { shopLinks: { some: { barbershopId } } },
    ],
  };
}

/** Liga o cliente à barbearia (idempotente). */
export function linkClientToShop(clientId: string, barbershopId: string, source: "MANUAL" | "IMPORT" = "MANUAL") {
  return prisma.shopClient.upsert({
    where: { clientId_barbershopId: { clientId, barbershopId } },
    create: { clientId, barbershopId, source },
    update: {},
  });
}
