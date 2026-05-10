import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { slugify } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, phone, role, shopName } = await req.json();

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 400 });
    }

    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, phone, role: role || "CLIENT" },
    });

    let barbershopId: string | undefined;

    if (role === "OWNER" && shopName) {
      let slug = slugify(shopName);
      const existing = await prisma.barbershop.findUnique({ where: { slug } });
      if (existing) slug = `${slug}-${Date.now()}`;

      const shop = await prisma.barbershop.create({
        data: {
          name: shopName,
          slug,
          ownerId: user.id,
          openingHours: {
            create: [1, 2, 3, 4, 5, 6].map((day) => ({
              dayOfWeek: day,
              openTime: "09:00",
              closeTime: "20:00",
              isOpen: true,
            })),
          },
        },
      });
      barbershopId = shop.id;
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, barbershopId });

    const res = NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, barbershopId },
      token,
    }, { status: 201 });

    res.cookies.set("token", token, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
