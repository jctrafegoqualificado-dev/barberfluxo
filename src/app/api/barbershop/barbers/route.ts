import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword } from "@/lib/auth";
import { z } from "zod";
import { logAudit, getClientIp } from "@/lib/audit";

const BarberCreateSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().optional(),
  password: z.string().optional(),
  commission: z.number().min(0).max(100).optional(),
  nickname: z.string().optional(),
  dayOff: z.number().int().min(0).max(6).optional().nullable(),
  cpf: z.string().optional(),
  birthday: z.string().optional(),
  photoUrl: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const barbers = await prisma.barber.findMany({
      // Arquivado = excluído: nunca aparece, nem com includeInactive.
      where: { barbershopId, archivedAt: null, ...(includeInactive ? {} : { active: true }) },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, birthday: true } },
      },
      orderBy: [{ active: "desc" }, { user: { name: "asc" } }],
    });
    const res = NextResponse.json({ barbers });
    // Sem cache: esta lista é editada pelo próprio dono na tela ao lado. Um
    // max-age aqui fazia o painel reexibir o profissional recém-excluído,
    // porque o reload pós-DELETE era servido pelo cache do navegador.
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

/**
 * Exclui um profissional.
 *
 * Sem histórico  → remove o registro do banco de vez (hard delete), junto com a
 *                  conta de usuário quando ela não serve para mais nada.
 * Com histórico  → arquiva (archivedAt). O profissional some do painel e de todas
 *                  as listagens, mas atendimentos, comissões e vendas passados
 *                  continuam intactos nos relatórios financeiros.
 *
 * Agendamentos futuros bloqueiam a exclusão: precisam ser cancelados ou
 * transferidos antes, senão o cliente fica com um horário órfão.
 */
export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { barberId } = await req.json();
    if (!barberId || typeof barberId !== "string") {
      return NextResponse.json({ error: "barberId obrigatório" }, { status: 400 });
    }

    // Valida que o barbeiro pertence a esta barbearia (CVE-6)
    const barber = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: payload.barbershopId! },
      select: {
        id: true,
        userId: true,
        user: { select: { name: true, email: true, role: true, isPlatformAdmin: true } },
      },
    });
    if (!barber) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }
    if (barber.userId === payload.id) {
      return NextResponse.json(
        { error: "Você não pode excluir o seu próprio perfil de profissional." },
        { status: 400 }
      );
    }

    // Agendamentos ainda por acontecer impedem a exclusão.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const upcoming = await prisma.appointment.count({
      where: {
        barberId,
        date: { gte: startOfToday },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (upcoming > 0) {
      return NextResponse.json(
        {
          error: `Este profissional tem ${upcoming} agendamento(s) futuro(s). Cancele ou transfira esses horários antes de excluir.`,
          upcomingAppointments: upcoming,
        },
        { status: 409 }
      );
    }

    // Histórico que não pode ser apagado — se existir qualquer um, arquivamos.
    const [appointments, productSales, commissionPayments, commissionVales, reviews] =
      await prisma.$transaction([
        prisma.appointment.count({ where: { barberId } }),
        prisma.productSale.count({ where: { barberId } }),
        prisma.commissionPayment.count({ where: { barberId } }),
        prisma.commissionVale.count({ where: { barberId } }),
        prisma.review.count({ where: { barberId } }),
      ]);
    const hasHistory =
      appointments + productSales + commissionPayments + commissionVales + reviews > 0;

    if (hasHistory) {
      await prisma.barber.update({
        where: { id: barberId },
        data: { active: false, onVacation: false, archivedAt: new Date() },
      });
    } else {
      // Sem histórico: apaga de vez, limpando antes os vínculos operacionais.
      const canDeleteUser =
        barber.user.role !== "PLATFORM_ADMIN" &&
        barber.user.role !== "OWNER" &&
        !barber.user.isPlatformAdmin &&
        (await countUserTiesOutsideBarberProfile(barber.userId)) === 0;

      await prisma.$transaction(async (tx) => {
        await tx.scheduleBlock.deleteMany({ where: { barberId } });
        await tx.task.updateMany({ where: { barberId }, data: { barberId: null } });
        await tx.meta.updateMany({ where: { barberId }, data: { barberId: null } });
        await tx.barber.update({ where: { id: barberId }, data: { allowedPlans: { set: [] } } });
        await tx.barber.delete({ where: { id: barberId } });

        if (canDeleteUser) {
          await tx.user.delete({ where: { id: barber.userId } });
        } else {
          // A conta continua existindo por outros vínculos (ex.: também é cliente),
          // mas não pode manter o acesso de barbeiro.
          await tx.user.updateMany({
            where: { id: barber.userId, role: "BARBER" },
            data: { role: "CLIENT" },
          });
        }
      });
    }

    void logAudit({
      barbershopId: payload.barbershopId!,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    hasHistory ? "ARCHIVE" : "DELETE",
      entity:    "Barber",
      entityId:  barberId,
      diff: { before: { name: barber.user.name, email: barber.user.email } },
      ip: getClientIp(req),
    });

    return NextResponse.json({ ok: true, mode: hasHistory ? "archived" : "deleted" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

/** Vínculos do usuário que existem independentemente do perfil de barbeiro. */
async function countUserTiesOutsideBarberProfile(userId: string) {
  const [ownedShop, appointments, subscriptions, productSales, contacts, reviews, points, retentions] =
    await prisma.$transaction([
      prisma.barbershop.count({ where: { ownerId: userId } }),
      prisma.appointment.count({ where: { clientId: userId } }),
      prisma.subscription.count({ where: { clientId: userId } }),
      prisma.productSale.count({ where: { clientId: userId } }),
      prisma.whatsAppContact.count({ where: { userId } }),
      prisma.review.count({ where: { clientId: userId } }),
      prisma.loyaltyPoint.count({ where: { clientId: userId } }),
      prisma.clientRetention.count({ where: { clientId: userId } }),
    ]);
  return ownedShop + appointments + subscriptions + productSales + contacts + reviews + points + retentions;
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const {
      barberId, name, phone, nickname, commission, password, dayOff, active, onVacation,
      photoUrl, cpf, birthday,
    } = await req.json();

    // ── Férias — estado próprio; sempre deixa o profissional inativo na agenda ──
    if (typeof onVacation === "boolean") {
      const result = await prisma.barber.updateMany({
        where: { id: barberId, barbershopId: payload.barbershopId!, archivedAt: null },
        data: { onVacation, active: !onVacation },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
      }
      void logAudit({
        barbershopId: payload.barbershopId!,
        userId:    payload.id,
        userEmail: payload.email,
        userRole:  payload.role,
        action:    onVacation ? "DEACTIVATE" : "ACTIVATE",
        entity:    "Barber",
        entityId:  barberId,
        diff: { after: { onVacation } },
        ip: getClientIp(req),
      });
      return NextResponse.json({ ok: true });
    }

    // ── Toggle ativo/inativo — valida posse antes (CVE-6) ──
    if (typeof active === "boolean") {
      const result = await prisma.barber.updateMany({
        where: { id: barberId, barbershopId: payload.barbershopId!, archivedAt: null },
        // Reativar encerra as férias; desativar manualmente não coloca em férias.
        data: { active, ...(active ? { onVacation: false } : {}) },
      });
      if (result.count === 0) {
        return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
      }
      // ── Audit: ativação / desativação por toggle ──
      void logAudit({
        barbershopId: payload.barbershopId!,
        userId:    payload.id,
        userEmail: payload.email,
        userRole:  payload.role,
        action:    active ? "ACTIVATE" : "DEACTIVATE",
        entity:    "Barber",
        entityId:  barberId,
        diff: { after: { active } },
        ip: getClientIp(req),
      });
      return NextResponse.json({ ok: true });
    }

    // Valida que o barbeiro pertence a esta barbearia (CVE-6)
    const barber = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: payload.barbershopId!, archivedAt: null },
      select: { userId: true, user: { select: { role: true, isPlatformAdmin: true } } },
    });
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    // Uma conta com privilégios (PLATFORM_ADMIN) não pode ter a SENHA redefinida por um
    // OWNER que não seja o próprio titular — isso permitiria sequestrar a conta. Os demais
    // dados de perfil/contato (nome, telefone, comissão etc.) continuam editáveis.
    const isSelf = barber.userId === payload.id;
    const isPrivileged = barber.user.role === "PLATFORM_ADMIN" || barber.user.isPlatformAdmin;
    if (password && isPrivileged && !isSelf) {
      return NextResponse.json(
        { error: "A senha desta conta só pode ser alterada pelo próprio titular." },
        { status: 403 }
      );
    }

    await prisma.user.update({
      where: { id: barber.userId },
      data: {
        name,
        phone: phone || null,
        ...(password ? { password: await hashPassword(password) } : {}),
        ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}),
      },
    });

    await prisma.barber.update({
      where: { id: barberId },
      data: {
        commission: Number(commission),
        nickname: nickname || null,
        dayOff: dayOff !== undefined && dayOff !== "" ? Number(dayOff) : null,
        ...(photoUrl !== undefined ? { photoUrl: photoUrl || null } : {}),
        ...(cpf !== undefined ? { cpf: cpf || null } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();
    const parsed = BarberCreateSchema.safeParse({
      ...body,
      commission: body.commission !== undefined ? Number(body.commission) : undefined,
      dayOff: body.dayOff !== undefined && body.dayOff !== "" ? Number(body.dayOff) : null,
    });
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Dados inválidos";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { name, email, phone, password, commission, nickname, dayOff, cpf, birthday, photoUrl } = parsed.data;

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const hashed = await hashPassword(password || "barber123");
      user = await prisma.user.create({
        data: {
          name, email, phone, password: hashed, role: "BARBER",
          ...(birthday ? { birthday: new Date(birthday) } : {}),
        },
      });
    } else if (user.role === "PLATFORM_ADMIN" || user.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Este e-mail pertence a uma conta com privilégios e não pode ser adicionado como barbeiro." },
        { status: 400 }
      );
    }

    // Reconratação: o perfil foi arquivado numa exclusão anterior (o histórico
    // impediu o hard delete). Reativa em vez de estourar no userId @unique.
    const archived = await prisma.barber.findFirst({
      where: { userId: user.id, barbershopId, archivedAt: { not: null } },
      select: { id: true },
    });
    if (archived) {
      const restored = await prisma.barber.update({
        where: { id: archived.id },
        data: {
          archivedAt: null,
          active: true,
          onVacation: false,
          commission: commission ?? 50,
          nickname: nickname ?? null,
          dayOff: dayOff ?? null,
          ...(cpf ? { cpf } : {}),
          ...(photoUrl ? { photoUrl } : {}),
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, birthday: true } },
        },
      });
      void logAudit({
        barbershopId,
        userId:    payload.id,
        userEmail: payload.email,
        userRole:  payload.role,
        action:    "ACTIVATE",
        entity:    "Barber",
        entityId:  restored.id,
        ip: getClientIp(req),
      });
      return NextResponse.json({ barber: restored });
    }

    const barber = await prisma.barber.create({
      data: {
        userId: user.id,
        barbershopId,
        commission: commission ?? 50,
        nickname,
        dayOff: dayOff ?? null,
        ...(cpf ? { cpf } : {}),
        ...(photoUrl ? { photoUrl } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, birthday: true } },
      },
    });

    // ── Audit: cadastro de barbeiro ──
    void logAudit({
      barbershopId,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "CREATE",
      entity:    "Barber",
      entityId:  barber.id,
      diff: { after: { name, email, commission: commission ?? 50 } },
      ip: getClientIp(req),
    });

    return NextResponse.json({ barber }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
