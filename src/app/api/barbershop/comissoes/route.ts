import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { computeCommissions } from "@/lib/commissions";


export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const monthOffset = Number(req.nextUrl.searchParams.get("month") || "0");
    const fromParam = req.nextUrl.searchParams.get("from");
    const toParam = req.nextUrl.searchParams.get("to");

    let start: Date, end: Date, mesLabel: string, monthKey: string;

    if (fromParam && toParam) {
      start = new Date(fromParam + "T00:00:00");
      end = new Date(toParam + "T23:59:59");
      mesLabel = `${format(start, "dd/MM/yyyy")} — ${format(end, "dd/MM/yyyy")}`;
      monthKey = `${fromParam}_${toParam}`;
    } else {
      const refDate = subMonths(new Date(), monthOffset);
      start = startOfMonth(refDate);
      end = endOfMonth(refDate);
      mesLabel = format(refDate, "MMMM yyyy", { locale: ptBR });
      monthKey = format(refDate, "yyyy-MM");
    }

    const { barbers: result, totalSubRevenue, ticketMedioSub } = await computeCommissions(barbershopId, start, end, monthKey);

    return NextResponse.json({ barbers: result, mes: mesLabel, monthOffset, monthKey, totalSubRevenue, ticketMedioSub });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const {
      barberId,
      commissionType, commission,
      productCommissionType, productCommission,
    } = await req.json();

    // Valida que o barbeiro pertence a esta barbearia antes de alterar taxas (CVE-8)
    const existing = await prisma.barber.findFirst({
      where: { id: barberId, barbershopId: payload.barbershopId! },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Barbeiro não encontrado" }, { status: 404 });
    }

    const barber = await prisma.barber.update({
      where: { id: barberId },
      data: {
        commissionType,
        commission: Number(commission),
        productCommissionType,
        productCommission: Number(productCommission),
      },
    });
    return NextResponse.json({ barber });
  } catch (e: unknown) {
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}
