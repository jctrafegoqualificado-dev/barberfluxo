import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await params; // slug not needed for lookup, just validates route
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone");

    if (!phone || phone.replace(/\D/g, "").length < 8) {
      return NextResponse.json({ found: false });
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const email = `${cleanPhone}@cliente.barberfluxo`;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { name: true, phone: true },
    });

    if (!user) return NextResponse.json({ found: false });

    // Separa nome e sobrenome
    const parts = user.name.trim().split(" ");
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ");

    return NextResponse.json({ found: true, firstName, lastName });
  } catch {
    return NextResponse.json({ found: false });
  }
}
