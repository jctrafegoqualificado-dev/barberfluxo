import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingRatelimit, getIp } from "@/lib/ratelimit";
import { getEntitlements } from "@/lib/entitlements";
import { onlyDigits, phoneVariants } from "@/lib/phone";

// POST — o cliente entra na lista de espera de um dia pelo link de agendamento.
// Se já estiver na fila desse dia, só atualiza (não duplica). Ver src/lib/waitlist.ts.

const MAX_DAYS_AHEAD = 30;
const todaySP = () => new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date());

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const { success } = await bookingRatelimit.limit(`${getIp(req)}:${slug}:waitlist`);
    if (!success) {
      return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, { status: 429 });
    }

    const { clientName, clientPhone, date, barberId, anyBarber, serviceIds } = await req.json();

    const name = typeof clientName === "string" ? clientName.trim() : "";
    const phone = onlyDigits(clientPhone);
    if (!name) return NextResponse.json({ error: "Informe seu nome" }, { status: 400 });
    if (phone.length < 10) return NextResponse.json({ error: "Informe um WhatsApp válido com DDD" }, { status: 400 });

    const today = todaySP();
    const limit = new Date(today + "T12:00:00Z");
    limit.setUTCDate(limit.getUTCDate() + MAX_DAYS_AHEAD);
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today || date > limit.toISOString().slice(0, 10)) {
      return NextResponse.json({ error: "Escolha um dia válido" }, { status: 400 });
    }

    const shop = await prisma.barbershop.findUnique({ where: { slug } });
    if (!shop || !shop.active) return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 });
    if (!getEntitlements(shop).hasAccess) {
      return NextResponse.json({ error: "Esta barbearia não está aceitando agendamentos no momento." }, { status: 403 });
    }

    let validBarberId: string | null = null;
    if (barberId) {
      const barber = await prisma.barber.findFirst({
        where: { id: barberId, barbershopId: shop.id, active: true, archivedAt: null },
        select: { id: true },
      });
      if (!barber) return NextResponse.json({ error: "Profissional inválido" }, { status: 400 });
      validBarberId = barber.id;
    }

    const ids = Array.isArray(serviceIds) ? serviceIds.filter((x): x is string => typeof x === "string") : [];
    const validServices = ids.length
      ? await prisma.service.findMany({
          where: { id: { in: ids }, barbershopId: shop.id, active: true, onlineBooking: true },
          select: { id: true },
        })
      : [];

    const data = {
      clientName: name,
      clientPhone: phone,
      barberId: validBarberId,
      // Sem profissional escolhido, qualquer um serve.
      anyBarber: Boolean(anyBarber) || !validBarberId,
      serviceIds: validServices.map((s) => s.id),
    };

    const existing = await prisma.waitlistEntry.findFirst({
      where: { barbershopId: shop.id, date, clientPhone: { in: phoneVariants(phone) }, status: { in: ["WAITING", "NOTIFIED"] } },
      select: { id: true },
    });
    const entry = existing
      ? await prisma.waitlistEntry.update({ where: { id: existing.id }, data: { ...data, status: "WAITING" }, select: { id: true, date: true } })
      : await prisma.waitlistEntry.create({ data: { ...data, date, barbershopId: shop.id }, select: { id: true, date: true } });

    return NextResponse.json({ entry, updated: Boolean(existing) }, { status: existing ? 200 : 201 });
  } catch (e: unknown) {
    console.error("[waitlist] erro ao entrar na fila:", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
