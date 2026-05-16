import { NextResponse } from "next/server";
import { sendMessage } from "@/lib/evolution/client";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const number = searchParams.get("number");
  const text = searchParams.get("text") || "Teste de envio BarberFluxo";
  const barbershopId = searchParams.get("barbershopId");

  if (!number || !barbershopId) {
    return NextResponse.json({ error: "Missing number or barbershopId" }, { status: 400 });
  }

  try {
    const instance = await prisma.whatsAppInstance.findUnique({
      where: { barbershopId }
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const result = await sendMessage(
      instance.evolutionInstanceName,
      number,
      text,
      1000,
      instance.evolutionToken
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
