import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";

interface CsvRow {
  name: string;
  phone?: string;
  email?: string;
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);

    const { rows } = (await req.json()) as { rows: CsvRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida no CSV" }, { status: 400 });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const name = row.name?.trim();
        if (!name) { skipped++; continue; }

        const cleanPhone = row.phone ? row.phone.replace(/\D/g, "") : null;
        const finalEmail =
          row.email?.trim() ||
          (cleanPhone ? `${cleanPhone}@cliente.barberfluxo.com` : null);

        if (!finalEmail) { skipped++; continue; }

        const existing = await prisma.user.findFirst({
          where: {
            OR: [
              ...(cleanPhone ? [{ phone: cleanPhone }] : []),
              { email: finalEmail },
            ],
            role: "CLIENT",
          },
        });

        if (existing) { skipped++; continue; }

        const password = await hashPassword(cleanPhone ?? name);
        await prisma.user.create({
          data: {
            name,
            email: finalEmail,
            phone: cleanPhone ?? undefined,
            password,
            role: "CLIENT",
          },
        });
        created++;
      } catch {
        errors.push(`Linha "${row.name}": erro ao importar`);
        skipped++;
      }
    }

    return NextResponse.json({ created, skipped, errors });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
