import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

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
        OR: [
          { appointments: { some: { barbershopId: payload.barbershopId! } } },
          { subscriptions:  { some: { barbershopId: payload.barbershopId! } } },
        ],
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
          OR: [
            { appointments: { some: { barbershopId: payload.barbershopId! } } },
            { subscriptions: { some: { barbershopId: payload.barbershopId! } } },
          ],
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
        OR: [
          { appointments: { some: { barbershopId } } },
          { subscriptions: { some: { barbershopId } } },
        ],
      },
      select: { id: true },
    });
    if (!clientBelongsHere) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Transação para limpar vínculos e anonimizar
    await prisma.$transaction(async (tx) => {
      // 1. Cancela apenas agendamentos ativos DESTA barbearia (CVE-12)
      await tx.appointment.updateMany({
        where: { clientId: id, barbershopId, status: { in: ["CONFIRMED", "PENDING"] } },
        data: { status: "CANCELLED", notes: "[Cancelado via exclusão de cliente]" },
      });

      // 2. Cancela apenas assinaturas ativas DESTA barbearia (CVE-12)
      await tx.subscription.updateMany({
        where: { clientId: id, barbershopId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      // 3. Anonimização global apenas se não houver vínculo em outras barbearias (CVE-12)
      // Cliente pode ser usuário de múltiplas barbearias — só apaga PII se for exclusivo desta
      const hasOtherRelationships = await tx.user.findFirst({
        where: {
          id,
          OR: [
            { appointments: { some: { barbershopId: { not: barbershopId } } } },
            { subscriptions: { some: { barbershopId: { not: barbershopId } } } },
          ],
        },
        select: { id: true },
      });

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

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao excluir cliente";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
