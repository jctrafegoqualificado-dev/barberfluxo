import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// PUT — Editar cliente (nome, telefone)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = requireAuth(req, ["OWNER", "BARBER"]);
    const { id } = await params;
    const { name, phone } = await req.json();

    // Valida que o cliente existe e pertence à barbearia (via agendamentos ou assinaturas)
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "CLIENT") {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Se mudou o telefone, verifica duplicidade
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, "");
      const existing = await prisma.user.findFirst({
        where: {
          id: { not: id },
          role: "CLIENT",
        },
      });
      // Busca em memória para sanitizar telefones
      const allClients = await prisma.user.findMany({ where: { role: "CLIENT", id: { not: id } } });
      const duplicate = allClients.find(c => c.phone.replace(/\D/g, "") === phoneDigits);
      if (duplicate) {
        return NextResponse.json({
          error: `Este telefone já pertence ao cliente "${duplicate.name}". Não é possível duplicar.`,
        }, { status: 400 });
      }
    }

    const data: any = {};
    if (name?.trim()) data.name = name.trim();
    if (phone?.trim()) data.phone = phone.replace(/\D/g, "");

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
    const { id } = await params;

    // Transação para limpar vínculos e anonimizar
    await prisma.$transaction(async (tx) => {
      // 1. Cancela agendamentos ativos
      await tx.appointment.updateMany({
        where: { clientId: id, status: { in: ["CONFIRMED", "PENDING"] } },
        data: { status: "CANCELLED", notes: "[Cancelado via exclusão de cliente]" },
      });

      // 2. Cancela assinaturas ativas
      await tx.subscription.updateMany({
        where: { clientId: id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      // 3. Anonimiza o cliente (Muda role e nome para não aparecer mais em buscas/listas)
      const user = await tx.user.findUnique({ where: { id } });
      await tx.user.update({
        where: { id },
        data: { 
          name: `[Excluído] ${user?.name || ""}`,
          phone: `deleted_${Date.now()}_${user?.phone || ""}`,
          email: `deleted_${Date.now()}_${user?.email || ""}`,
          role: "DELETED_CLIENT" // Mudamos o role para não aparecer na query de clientes
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao excluir cliente";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
