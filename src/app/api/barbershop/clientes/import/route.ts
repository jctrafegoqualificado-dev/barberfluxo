import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";
import { phoneVariants } from "@/lib/phone";
import { linkClientToShop, shopClientWhere } from "@/lib/shopClients";

interface CsvRow {
  name: string;
  phone?: string;
  email?: string;
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const { rows } = (await req.json()) as { rows: CsvRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida no CSV" }, { status: 400 });
    }

    let created = 0;
    let linked = 0; // já tinha cadastro (de outra barbearia ou do link) e passou a aparecer aqui
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const name = row.name?.trim();
        if (!name) { skipped++; continue; }

        const cleanPhone = row.phone ? row.phone.replace(/\D/g, "") : null;
        const finalEmail =
          row.email?.trim() ||
          (cleanPhone ? `${cleanPhone}@cliente.iadebarbearia.com` : null);

        if (!finalEmail) { skipped++; continue; }

        // O cadastro do cliente é compartilhado entre barbearias: se já existe, só liga a esta.
        const existing = await prisma.user.findFirst({
          where: {
            OR: [
              ...(cleanPhone ? [{ phone: { in: phoneVariants(cleanPhone) } }] : []),
              { email: finalEmail },
            ],
            role: "CLIENT",
          },
          select: { id: true },
        });

        if (existing) {
          const alreadyHere = await prisma.user.count({ where: { id: existing.id, ...shopClientWhere(barbershopId) } });
          if (alreadyHere > 0) { skipped++; continue; }
          await linkClientToShop(existing.id, barbershopId, "IMPORT");
          linked++;
          continue;
        }

        const password = await hashPassword(cleanPhone ?? name);
        await prisma.user.create({
          data: {
            name,
            email: finalEmail,
            phone: cleanPhone ?? undefined,
            password,
            role: "CLIENT",
            shopLinks: { create: { barbershopId, source: "IMPORT" } },
          },
        });
        created++;
      } catch {
        errors.push(`Linha "${row.name}": erro ao importar`);
        skipped++;
      }
    }

    return NextResponse.json({ created, linked, skipped, errors });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
