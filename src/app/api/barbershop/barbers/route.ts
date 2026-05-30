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
      where: { barbershopId, ...(includeInactive ? {} : { active: true }) },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, birthday: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    const res = NextResponse.json({ barbers });
    res.headers.set("Cache-Control", "private, max-age=30");
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const { barberId } = await req.json();
    // Valida que o barbeiro pertence a esta barbearia antes de desativar (CVE-6)
    const result = await prisma.barber.updateMany({
      where: { id: barberId, barbershopId: payload.barbershopId! },
      data: { active: false },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }

    // ── Audit: desativação de barbeiro ──
    void logAudit({
      barbershopId: payload.barbershopId!,
      userId:    payload.id,
      userEmail: payload.email,
      userRole:  payload.role,
      action:    "DEACTIVATE",
      entity:    "Barber",
      entityId:  barberId,
      ip: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const {
      barberId, name, phone, nickname, commission, password, dayOff, active,
      photoUrl, cpf, birthday,
    } = await req.json();

    // ── Toggle ativo/inativo — valida posse antes (CVE-6) ──
    if (typeof active === "boolean") {
      const result = await prisma.barber.updateMany({
        where: { id: barberId, barbershopId: payload.barbershopId! },
        data: { active },
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
      where: { id: barberId, barbershopId: payload.barbershopId! },
      select: { userId: true, user: { select: { role: true, isPlatformAdmin: true } } },
    });
    if (!barber) return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });

    // Previne que OWNER sobrescreva dados (incluindo senha) de conta com privilégios
    if (barber.user.role === "PLATFORM_ADMIN" || barber.user.isPlatformAdmin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
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
