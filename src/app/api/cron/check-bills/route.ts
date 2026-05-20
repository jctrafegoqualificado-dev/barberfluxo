import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format, addDays } from "date-fns";

// MOCK: Função que simula o envio de WhatsApp (substitua pela sua API real Evolution/Baileys)
async function sendWhatsAppMessage(phone: string, text: string) {
  console.log(`[WHATSAPP] Enviando para ${phone}: ${text}`);
  // Exemplo de integração real:
  // await fetch('sua-url-evolution/message/sendText', { method: 'POST', body: JSON.stringify({ number: phone, text }) })
}

export async function GET(req: Request) {
  try {
    // 1. Opcional: Adicionar token de segurança (ex: req.headers.get("Authorization") === "Bearer MINHA-CHAVE-CRON")
    const authHeader = req.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    // Busca todas as despesas que vencem amanhã e estão pendentes
    const expensesDueTomorrow = await prisma.expense.findMany({
      where: {
        status: "PENDING",
        dueDate: {
          gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
          lte: new Date(tomorrow.setHours(23, 59, 59, 999))
        }
      },
      include: {
        barbershop: {
          include: {
            owner: true // Supondo que existe relation "owner" - no nosso schema é via User.ownedShop
          }
        }
      }
    });

    // Mas no schema do Prisma, o dono é recuperado assim:
    const results = [];

    for (const expense of expensesDueTomorrow) {
      // Procurar o User OWNER dessa barbershop
      const owner = await prisma.user.findFirst({
        where: {
          role: "OWNER",
          ownedShop: { id: expense.barbershopId }
        }
      });

      if (owner?.phone) {
        const value = expense.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const text = `⚠️ *Lembrete Financeiro*\n\nOlá ${owner.name.split(" ")[0]}, sua despesa de *${expense.name}* (${value}) vence amanhã (${format(expense.dueDate!, "dd/MM/yyyy")}).\n\n_Para não esquecer, acesse o painel e registre o pagamento quando realizar._`;
        
        await sendWhatsAppMessage(owner.phone, text);
        results.push({ expense: expense.name, to: owner.phone, status: "sent" });
      } else {
        results.push({ expense: expense.name, to: "no-phone", status: "skipped" });
      }
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
