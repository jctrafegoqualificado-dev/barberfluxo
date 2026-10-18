import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { cleanHandoffTriggers } from "@/lib/whatsapp/handoffTriggers";

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;

    const barbershop = await prisma.barbershop.findUnique({
      where: { id: barbershopId },
      select: {
        name: true,
        aiHandoffTriggers: true,
        aiAssistantName: true,
        aiPersonality: true,
        aiGreetingDirective: true,
        aiIdioma: true,
        aiAtendimentoAtivo: true,
        aiMensagemBoasVindas: true,
        aiMensagemAusencia: true,
        aiMensagemConfirmacaoAgendamento: true,
        aiMensagemCancelamento: true,
        aiObservacoesAdicionais: true,
      },
    });

    return NextResponse.json(barbershop);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const barbershopId = payload.barbershopId!;
    const body = await req.json();

    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.trim().slice(0, max) || null : null;

    const aiAssistantName = str(body.aiAssistantName, 50);
    const aiPersonality = str(body.aiPersonality, 500);
    const aiGreetingDirective = str(body.aiGreetingDirective, 200);
    const aiIdioma = str(body.aiIdioma, 10);
    const aiAtendimentoAtivo = typeof body.aiAtendimentoAtivo === "boolean"
      ? body.aiAtendimentoAtivo
      : undefined;
    const aiMensagemBoasVindas = str(body.aiMensagemBoasVindas, 500);
    const aiMensagemAusencia = str(body.aiMensagemAusencia, 500);
    const aiMensagemConfirmacaoAgendamento = str(body.aiMensagemConfirmacaoAgendamento, 500);
    const aiMensagemCancelamento = str(body.aiMensagemCancelamento, 500);
    const aiObservacoesAdicionais = str(body.aiObservacoesAdicionais, 1000);
    const aiHandoffTriggers = cleanHandoffTriggers(body.aiHandoffTriggers);

    const updated = await prisma.barbershop.update({
      where: { id: barbershopId },
      data: {
        aiAssistantName, aiPersonality, aiGreetingDirective,
        aiIdioma, aiAtendimentoAtivo,
        aiMensagemBoasVindas, aiMensagemAusencia,
        aiMensagemConfirmacaoAgendamento, aiMensagemCancelamento,
        aiObservacoesAdicionais, aiHandoffTriggers,
      },
      select: {
        aiAssistantName: true, aiPersonality: true, aiGreetingDirective: true,
        aiIdioma: true, aiAtendimentoAtivo: true,
        aiMensagemBoasVindas: true, aiMensagemAusencia: true,
        aiMensagemConfirmacaoAgendamento: true, aiMensagemCancelamento: true,
        aiObservacoesAdicionais: true, aiHandoffTriggers: true,
      },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
