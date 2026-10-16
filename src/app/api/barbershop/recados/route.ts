import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sendWhatsAppNotification } from "@/lib/notifications";
import { logAudit, getClientIp } from "@/lib/audit";

// Recados do dono para a equipe. O dono escreve e vê quem leu; o barbeiro vê os
// recados recentes no início dele e marca como lidos (ver ./lidos).

const MAX_LENGTH = 500;
const OWNER_WINDOW_DAYS = 60; // histórico na tela do dono
const BARBER_WINDOW_DAYS = 30; // o que aparece para o barbeiro

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "Erro interno";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const barbershopId = payload.barbershopId!;

    if (payload.role === "BARBER") {
      const barber = await prisma.barber.findUnique({ where: { userId: payload.id }, select: { id: true } });
      if (!barber) return NextResponse.json({ notices: [], unread: 0 });

      const notices = await prisma.teamNotice.findMany({
        where: { barbershopId, createdAt: { gte: daysAgo(BARBER_WINDOW_DAYS) } },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true, content: true, authorName: true, createdAt: true,
          reads: { where: { barberId: barber.id }, select: { id: true } },
        },
      });
      const list = notices.map(({ reads, ...n }) => ({ ...n, read: reads.length > 0 }));
      return NextResponse.json({ notices: list, unread: list.filter((n) => !n.read).length });
    }

    const [notices, team] = await Promise.all([
      prisma.teamNotice.findMany({
        where: { barbershopId, createdAt: { gte: daysAgo(OWNER_WINDOW_DAYS) } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, content: true, authorName: true, createdAt: true,
          reads: { select: { readAt: true, barber: { select: { id: true, user: { select: { name: true } } } } } },
        },
      }),
      prisma.barber.findMany({
        where: { barbershopId, active: true, archivedAt: null },
        select: { id: true, user: { select: { name: true } } },
      }),
    ]);

    return NextResponse.json({
      notices: notices.map((n) => ({
        id: n.id,
        content: n.content,
        authorName: n.authorName,
        createdAt: n.createdAt,
        readBy: n.reads.map((r) => ({ barberId: r.barber.id, name: r.barber.user.name, readAt: r.readAt })),
      })),
      team: team.map((b) => ({ id: b.id, name: b.user.name })),
    });
  } catch (e: unknown) {
    return errorResponse(e);
  }
}

// POST — publica um recado. notifyWhatsApp: avisa cada profissional ativo pelo WhatsApp da barbearia.
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { content, notifyWhatsApp } = await req.json();

    const text = typeof content === "string" ? content.trim() : "";
    if (!text) return NextResponse.json({ error: "Escreva o recado" }, { status: 400 });
    if (text.length > MAX_LENGTH) {
      return NextResponse.json({ error: `Máximo de ${MAX_LENGTH} caracteres` }, { status: 400 });
    }

    const [author, shop] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.id }, select: { name: true } }),
      prisma.barbershop.findUnique({ where: { id: barbershopId }, select: { name: true } }),
    ]);

    const notice = await prisma.teamNotice.create({
      data: { barbershopId, content: text, authorId: payload.id, authorName: author?.name ?? null },
      select: { id: true, content: true, authorName: true, createdAt: true },
    });

    void logAudit({
      barbershopId,
      userId: payload.id,
      userEmail: payload.email,
      userRole: payload.role,
      action: "CREATE",
      entity: "TeamNotice",
      entityId: notice.id,
      ip: getClientIp(req),
    });

    let notified = 0;
    if (notifyWhatsApp) {
      const barbers = await prisma.barber.findMany({
        where: { barbershopId, active: true, archivedAt: null, userId: { not: payload.id } },
        select: { user: { select: { phone: true } } },
      });
      const msg = `📢 *Recado da ${shop?.name ?? "barbearia"}*\n\n${text}\n\n— ${author?.name ?? "Dono"}`;
      for (const b of barbers) {
        if (!b.user.phone) continue;
        notified++;
        sendWhatsAppNotification(barbershopId, b.user.phone, msg).catch(console.error);
      }
    }

    return NextResponse.json({ notice, notified }, { status: 201 });
  } catch (e: unknown) {
    return errorResponse(e);
  }
}
