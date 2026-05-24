import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const shop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        instagram: true,
        cnpj: true,
        zipCode: true,
        neighborhood: true,
        streetNumber: true,
        streetComplement: true,
        contactEmail: true,
        logoUrl: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!shop) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    return NextResponse.json({
      ...shop,
      ownerName: shop.owner?.name ?? "",
      ownerEmail: shop.owner?.email ?? "",
    });
  } catch (e) {
    console.error("❌ [Profile GET]:", e);
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();

    const {
      name,
      phone,
      address,
      city,
      state,
      instagram,
      cnpj,
      zipCode,
      neighborhood,
      streetNumber,
      streetComplement,
      contactEmail,
      logoUrl,
      ownerName,
    } = body;

    // Atualiza dados da barbearia
    await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        name,
        phone,
        address,
        city,
        state,
        instagram,
        cnpj,
        zipCode,
        neighborhood,
        streetNumber,
        streetComplement,
        contactEmail,
        logoUrl,
      },
    });

    // Atualiza nome do dono se fornecido
    if (ownerName) {
      await prisma.user.update({
        where: { id: payload.id },
        data: { name: ownerName },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("❌ [Profile PATCH]:", e);
    return NextResponse.json({ error: "Erro ao salvar perfil" }, { status: 500 });
  }
}
