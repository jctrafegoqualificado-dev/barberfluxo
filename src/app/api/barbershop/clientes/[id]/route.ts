import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopClientWhere } from "@/lib/shopClients";
import { requireAuth } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { cancelAutoDebit } from "@/lib/subscriptionGateway";
import { differenceInDays } from "date-fns";
import { averageInterval, clientRhythm } from "@/lib/clientRhythm";

function servicesOf(a: { service: { name: string } | null; services: { service: { name: string } }[] }) {
  return a.services.length > 0 ? a.services.map((s) => s.service.name).join(" + ") : a.service?.name ?? "Serviço";
}

/** O mais frequente da lista (empate: o que aparece primeiro — a lista vem do mais recente). */
function mostCommon<T>(items: T[], key: (t: T) => string): T | null {
  const count = new Map<string, number>();
  for (const it of items) count.set(key(it), (count.get(key(it)) ?? 0) + 1);
  let best: T | null = null;
  for (const it of items) if (!best || count.get(key(it))! > count.get(key(best))!) best = it;
  return best;
}

// GET — Ficha do cliente: números, ritmo de volta, preferências, assinatura, observação e histórico
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    const client = await prisma.user.findFirst({
      where: { id, role: "CLIENT", ...shopClientWhere(barbershopId) },
      select: {
        id: true, name: true, email: true, phone: true, birthday: true, isBlocked: true, createdAt: true,
        shopLinks: { where: { barbershopId }, select: { createdAt: true } },
      },
    });
    if (!client) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const today = new Date(new Intl.DateTimeFormat("sv", { timeZone: "America/Sao_Paulo" }).format(new Date()) + "T00:00:00Z");
    const apptSelect = {
      id: true, date: true, startTime: true, status: true, price: true, paymentMethod: true, subscriptionId: true, barberId: true, serviceId: true,
      service: { select: { name: true } },
      services: { select: { serviceId: true, service: { select: { name: true } } } },
      barber: { select: { nickname: true, user: { select: { name: true } } } },
    } as const;

    const [shop, history, upcoming, subscription, note, retention] = await Promise.all([
      prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { slug: true, name: true, retentionDays: true } }),
      prisma.appointment.findMany({
        where: { barbershopId, clientId: id, status: { in: ["DONE", "NO_SHOW"] } },
        orderBy: [{ date: "desc" }, { startTime: "desc" }],
        select: apptSelect,
      }),
      prisma.appointment.findMany({
        where: { barbershopId, clientId: id, status: { in: ["CONFIRMED", "PENDING"] }, date: { gte: today } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 5,
        select: apptSelect,
      }),
      prisma.subscription.findFirst({
        where: { barbershopId, clientId: id, status: { in: ["ACTIVE", "OVERDUE", "PAUSED"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, createdAt: true, nextBillingDate: true, plan: { select: { name: true, price: true } } },
      }),
      prisma.clientNote.findUnique({
        where: { clientId_barbershopId: { clientId: id, barbershopId } },
        select: { content: true, updatedAt: true, updatedBy: true },
      }),
      prisma.clientRetention.findUnique({
        where: { clientId_barbershopId: { clientId: id, barbershopId } },
        select: { lastSentAt: true },
      }),
    ]);

    const done = history.filter((a) => a.status === "DONE");
    const visits = done.length;
    const spent = done.reduce((s, a) => s + a.price, 0);
    const lastDone = done[0] ?? null;
    const avgFrequency = averageInterval(done.map((a) => a.date));
    const daysSinceLastVisit = lastDone ? differenceInDays(new Date(), lastDone.date) : null;
    const rhythm = clientRhythm({
      visits, avgFrequency, daysSinceLastVisit, hasUpcoming: upcoming.length > 0, fallbackDays: shop?.retentionDays ?? 45,
    });

    const barberLabel = (a: (typeof history)[number]) => a.barber.nickname || a.barber.user.name.split(" ")[0];
    const prefBarber = mostCommon(done, (a) => a.barberId);
    const prefService = mostCommon(done, servicesOf);
    const firstDone = done[done.length - 1]?.date;
    const since = [firstDone, subscription?.createdAt, client.shopLinks[0]?.createdAt]
      .filter((d): d is Date => !!d)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? client.createdAt;

    const toItem = (a: (typeof history)[number]) => ({
      id: a.id,
      date: a.date.toISOString().slice(0, 10),
      startTime: a.startTime,
      status: a.status,
      services: servicesOf(a),
      barberName: barberLabel(a),
      paymentMethod: a.paymentMethod,
      price: a.price,
      viaPlan: !!a.subscriptionId,
    });

    return NextResponse.json({
      client: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email.includes("@cliente.") ? null : client.email,
        birthday: client.birthday ? client.birthday.toISOString().slice(0, 10) : null,
        isBlocked: client.isBlocked,
        since: since.toISOString(),
      },
      stats: {
        visits,
        spent,
        avgTicket: visits > 0 ? spent / visits : 0,
        noShows: history.length - visits,
      },
      rhythm: { ...rhythm, avgFrequency, daysSinceLastVisit, lastVisit: lastDone ? { date: lastDone.date.toISOString().slice(0, 10), barberName: barberLabel(lastDone) } : null },
      preferred: prefBarber
        ? {
            barberId: prefBarber.barberId,
            barberName: barberLabel(prefBarber),
            services: prefService ? servicesOf(prefService) : null,
            serviceIds: prefService
              ? (prefService.services.length > 0 ? prefService.services.map((s) => s.serviceId) : prefService.serviceId ? [prefService.serviceId] : [])
              : [],
          }
        : null,
      subscription: subscription
        ? { id: subscription.id, status: subscription.status, planName: subscription.plan.name, price: subscription.plan.price, nextBillingDate: subscription.nextBillingDate }
        : null,
      note,
      lastRetentionAt: retention?.lastSentAt ?? null,
      upcoming: upcoming.map(toItem),
      history: history.map(toItem),
      shop: shop ? { slug: shop.slug, name: shop.name } : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// PUT — Editar cliente (nome, telefone)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { id } = await params;
    const { name, phone, isBlocked, birthday } = await req.json();

    // Valida que o cliente existe E pertence a esta barbearia (via agendamentos ou assinaturas) — CVE-7
    const user = await prisma.user.findFirst({
      where: {
        id,
        role: "CLIENT",
        ...shopClientWhere(payload.barbershopId!),
      },
    });
    if (!user) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Se mudou o telefone, verifica duplicidade (CVE-14)
    // Query direta no banco (sem full scan) — restrita a clientes DESTA barbearia
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, "");
      const duplicate = await prisma.user.findFirst({
        where: {
          phone: phoneDigits,
          id: { not: id },
          role: "CLIENT",
          ...shopClientWhere(payload.barbershopId!),
        },
        select: { id: true, name: true },
      });
      if (duplicate) {
        return NextResponse.json({
          error: `Este telefone já pertence ao cliente "${duplicate.name}". Não é possível duplicar.`,
        }, { status: 400 });
      }
    }

    const data: any = {};
    if (name?.trim()) data.name = name.trim();
    if (phone !== undefined) {
      data.phone = phone ? phone.replace(/\D/g, "") : null;
    }
    if (typeof isBlocked === "boolean") data.isBlocked = isBlocked;
    if (birthday !== undefined) {
      data.birthday = birthday ? new Date(birthday) : null;
    }

    const updated = await prisma.user.update({ where: { id }, data });

    // ── Audit: bloqueio / desbloqueio de cliente ──
    if (typeof isBlocked === "boolean") {
      void logAudit({
        barbershopId: payload.barbershopId!,
        userId:    payload.id,
        userEmail: payload.email,
        userRole:  payload.role,
        action:    isBlocked ? "BLOCK" : "UNBLOCK",
        entity:    "Client",
        entityId:  id,
        diff: { after: { isBlocked } },
        ip: getClientIp(req),
      });
    }

    return NextResponse.json({ client: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar cliente";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — Excluir cliente (Anonimização)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    // Valida que o cliente pertence a esta barbearia — evita deleção cross-tenant (CVE-12)
    const clientBelongsHere = await prisma.user.findFirst({
      where: {
        id,
        role: "CLIENT",
        ...shopClientWhere(barbershopId),
      },
      select: { id: true },
    });
    if (!clientBelongsHere) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Assinaturas vivas: o débito automático no MP também precisa parar
    const liveSubs = await prisma.subscription.findMany({
      where: { clientId: id, barbershopId, status: { in: ["ACTIVE", "OVERDUE", "PAUSED"] } },
      select: { mpPreapprovalId: true },
    });

    // Transação para limpar vínculos e anonimizar
    await prisma.$transaction(async (tx) => {
      // 1. Cancela apenas agendamentos ativos DESTA barbearia (CVE-12)
      await tx.appointment.updateMany({
        where: { clientId: id, barbershopId, status: { in: ["CONFIRMED", "PENDING"] } },
        data: { status: "CANCELLED", notes: "[Cancelado via exclusão de cliente]" },
      });

      // 2. Cancela apenas assinaturas ativas DESTA barbearia (CVE-12)
      await tx.subscription.updateMany({
        where: { clientId: id, barbershopId, status: { in: ["ACTIVE", "OVERDUE", "PAUSED"] } },
        data: { status: "CANCELLED", mpPreapprovalId: null, authorizationLink: null },
      });

      // 3. Anonimização global apenas se não houver vínculo em outras barbearias (CVE-12)
      // Cliente pode ser usuário de múltiplas barbearias — só apaga PII se for exclusivo desta
      const hasOtherRelationships = await tx.user.findFirst({
        where: {
          id,
          OR: [
            { appointments: { some: { barbershopId: { not: barbershopId } } } },
            { subscriptions: { some: { barbershopId: { not: barbershopId } } } },
            { shopLinks: { some: { barbershopId: { not: barbershopId } } } },
          ],
        },
        select: { id: true },
      });

      // Cadastro manual/importado deixa de valer para esta barbearia
      await tx.shopClient.deleteMany({ where: { clientId: id, barbershopId } });

      if (!hasOtherRelationships) {
        const user = await tx.user.findUnique({ where: { id } });
        await tx.user.update({
          where: { id },
          data: {
            name: `[Excluído] ${user?.name || ""}`,
            phone: `deleted_${Date.now()}_${user?.phone || ""}`,
            email: `deleted_${Date.now()}_${user?.email || ""}`,
            role: "DELETED_CLIENT", // Não aparece mais na query de clientes
          },
        });
      }
    });

    for (const sub of liveSubs) await cancelAutoDebit(barbershopId, sub.mpPreapprovalId, "client-delete");

    // ── Audit: exclusão (anonimização) de cliente ──
    void logAudit({
      barbershopId,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "DELETE",
      entity:    "Client",
      entityId:  id,
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao excluir cliente";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
