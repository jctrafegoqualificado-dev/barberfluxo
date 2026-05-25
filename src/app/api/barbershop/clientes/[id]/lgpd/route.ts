import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

/**
 * GET /api/barbershop/clientes/[id]/lgpd
 *
 * Exporta todos os dados pessoais de um cliente — LGPD Art. 18.
 * Destinado a ser usado pelo OWNER quando um cliente exercer o
 * direito de acesso aos seus dados (por e-mail, WhatsApp ou pessoalmente).
 *
 * Resposta em JSON; o frontend pode oferecer download como .json.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const { id } = await params;

    // Confirma que o cliente pertence a esta barbearia (CVE cross-tenant)
    const user = await prisma.user.findFirst({
      where: {
        id,
        role: "CLIENT",
        OR: [
          { appointments: { some: { barbershopId } } },
          { subscriptions:  { some: { barbershopId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        birthday: true,
        createdAt: true,
        isBlocked: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    // Agendamentos NESTA barbearia
    const appointments = await prisma.appointment.findMany({
      where: { clientId: id, barbershopId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        status: true,
        price: true,
        paymentMethod: true,
        notes: true,
        service: { select: { name: true } },
        barber: { select: { user: { select: { name: true } } } },
      },
    });

    // Assinaturas NESTA barbearia
    const subscriptions = await prisma.subscription.findMany({
      where: { clientId: id, barbershopId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        billingDay: true,
        usesThisCycle: true,
        createdAt: true,
        updatedAt: true,
        plan: { select: { name: true, price: true, maxUses: true } },
      },
    });

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: { name: true },
    });

    const exportData = {
      exportadoEm: new Date().toISOString(),
      barbearia: barbershop?.name ?? barbershopId,
      dadosPessoais: {
        id: user.id,
        nome: user.name,
        telefone: user.phone,
        // e-mail sintético (telefone@cliente.barberfluxo) não é exposto
        aniversario: user.birthday ?? null,
        cadastradoEm: user.createdAt,
        bloqueado: user.isBlocked,
      },
      agendamentos: appointments.map((a) => ({
        id: a.id,
        data: a.date,
        servico: a.service?.name ?? null,
        barbeiro: a.barber?.user?.name ?? null,
        status: a.status,
        valor: a.price,
        pagamento: a.paymentMethod ?? null,
        observacoes: a.notes ?? null,
      })),
      assinaturas: subscriptions.map((s) => ({
        id: s.id,
        plano: s.plan.name,
        valorMensal: s.plan.price,
        usosNoMes: s.usesThisCycle,
        limiteUsos: s.plan.maxUses,
        vencimento: s.billingDay ? `Todo dia ${s.billingDay}` : null,
        status: s.status,
        criadaEm: s.createdAt,
        atualizadaEm: s.updatedAt,
      })),
      finalidade:
        "Dados coletados para prestação de serviços de barbearia (agendamento, faturamento e comunicação). Armazenados conforme a LGPD (Lei 13.709/2018).",
    };

    return NextResponse.json(exportData);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
