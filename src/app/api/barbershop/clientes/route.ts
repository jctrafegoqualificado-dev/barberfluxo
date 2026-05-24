import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    let barbershopId = payload.barbershopId!;
    let barberIdFilter: string | undefined;

    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id } });
      if (!barber) return NextResponse.json({ clientes: [] });
      barbershopId = barber.barbershopId;
      barberIdFilter = barber.id;
    }

    // Busca todos os usuários que são CLIENTES nesta barbearia (com agendamentos, assinaturas ou vinculados à barbearia)
    const dbClients = await prisma.user.findMany({
      where: {
        role: "CLIENT", // Note: DELETED_CLIENT is excluded automatically here
        OR: [
          { appointments: { some: { barbershopId } } },
          { subscriptions: { some: { barbershopId } } }
        ]
      },
      include: {
        appointments: {
          where: { barbershopId, status: { in: ["DONE", "NO_SHOW"] } },
          orderBy: { date: "asc" },
          select: { date: true, price: true, status: true },
        },
        subscriptions: {
          where: { barbershopId, status: "ACTIVE" },
          include: { plan: true }
        }
      }
    });

    // Calcula a média geral das avaliações realizadas para obter a "Moral" (NPS geral) da barbearia
    const reviews = await prisma.review.findMany({
      where: { barbershopId }
    });
    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews : 0;
    const moral = totalReviews > 0 ? Math.round(avgRating * 10) / 10 : 5.0; // Padrão 5.0 se sem reviews

    const clientes = dbClients.map((u) => {
      const doneAppts = u.appointments.filter((a) => a.status === "DONE");
      const sortedVisits = doneAppts.map(a => new Date(a.date)).sort((a, b) => a.getTime() - b.getTime());
      const totalSpent = doneAppts.reduce((sum, a) => sum + a.price, 0);
      const noShowCount = u.appointments.filter((a) => a.status === "NO_SHOW").length;
      const firstVisit = sortedVisits.length > 0 ? sortedVisits[0] : null;
      const lastVisit = sortedVisits.length > 0 ? sortedVisits[sortedVisits.length - 1] : null;
      const thisMonthVisits = sortedVisits.filter((d) => d >= monthStart && d <= monthEnd).length;
      
      // Se tiver assinatura, usa a data da assinatura como "primeira interação" se não houver visitas
      const firstInteraction = firstVisit || (u.subscriptions[0] ? new Date(u.subscriptions[0].createdAt) : now);
      const isNew = firstInteraction >= monthStart;

      let avgFrequency: number | null = null;
      if (sortedVisits.length > 1) {
        let totalDays = 0;
        for (let i = 1; i < sortedVisits.length; i++) {
          totalDays += differenceInDays(sortedVisits[i], sortedVisits[i - 1]);
        }
        avgFrequency = Math.round(totalDays / (sortedVisits.length - 1));
      }

      const daysSinceLastVisit = lastVisit ? differenceInDays(now, lastVisit) : null;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        isBlocked: u.isBlocked,
        birthday: u.birthday ? u.birthday.toISOString() : null,
        totalVisits: sortedVisits.length,
        totalSpent,
        thisMonthVisits,
        firstVisit: firstVisit?.toISOString() || null,
        lastVisit: lastVisit?.toISOString() || null,
        daysSinceLastVisit,
        avgFrequency,
        isNew,
        noShowCount,
        activePlan: u.subscriptions[0]?.plan.name ?? null,
      };
    });

    // Ordena por quem interagiu por último (agendamento ou assinatura)
    clientes.sort((a, b) => {
      const dateA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const dateB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ clientes, moral });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { name, phone, email } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    const cleanPhone = phone ? phone.replace(/\D/g, "") : null;
    const finalEmail = email?.trim() || (cleanPhone ? `${cleanPhone}@cliente.barberfluxo.com` : null);

    if (!finalEmail) {
      return NextResponse.json({ error: "Informe telefone ou e-mail" }, { status: 400 });
    }

    // Verifica duplicata
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          ...(cleanPhone ? [{ phone: cleanPhone }] : []),
          { email: finalEmail },
        ],
        role: "CLIENT",
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Já existe um cliente com esse telefone ou e-mail" }, { status: 409 });
    }

    const password = await hashPassword(cleanPhone ?? name);
    const client = await prisma.user.create({
      data: {
        name: name.trim(),
        email: finalEmail,
        phone: cleanPhone ?? undefined,
        password,
        role: "CLIENT",
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
