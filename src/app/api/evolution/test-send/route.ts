import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendTextMessage } from "@/lib/whatsapp/send";

// Função para comparação segura de strings (evita timing attacks)
function secureCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    const TEST_API_KEY = process.env.TEST_API_KEY || "";
    
    if (!TEST_API_KEY) {
      console.warn("⚠️ [Test Send] TEST_API_KEY não configurada no servidor.");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Validar autenticação
    const reqTestKey = req.headers.get("x-test-key") || "";
    if (!secureCompare(TEST_API_KEY, reqTestKey)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parsear body
    const body = await req.json();
    const { phone, text, barbershopId } = body;

    if (!phone || !text || !barbershopId) {
      return NextResponse.json({ error: "Missing 'phone', 'text' or 'barbershopId' in body" }, { status: 400 });
    }

    // Chamar serviço de envio
    const result = await sendTextMessage(barbershopId, phone, text);

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId }, { status: 200 });

  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error", details: error instanceof Error ? error.message : "Desconhecido" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
