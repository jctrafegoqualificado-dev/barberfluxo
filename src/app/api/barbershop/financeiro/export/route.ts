import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { buildMonthResult, currentMonthSP } from "@/lib/monthResult";

const STATUS: Record<string, string> = { RECEIVED: "Recebido", PAID: "Pago", PENDING: "A pagar", OVERDUE: "Atrasada" };

/** Célula de CSV: separador ";" (Excel em português) e aspas quando precisa. */
function cell(v: string | number) {
  const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v;
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET ?month=YYYY-MM — planilha do mês (as mesmas movimentações da tela Resultado do mês)
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req, ["OWNER"]);
    const param = req.nextUrl.searchParams.get("month");
    const month = param && /^\d{4}-\d{2}$/.test(param) ? param : currentMonthSP();
    const r = await buildMonthResult(payload.barbershopId!, month);

    const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const lines = [
      ["Data", "Tipo", "Descrição", "Detalhe", "Forma de pagamento", "Situação", "Valor (R$)"].join(";"),
      ...r.moves.map((m) => [
        day(m.date), m.dir === "in" ? "Entrada" : "Saída", cell(m.desc), cell(m.sub), cell(m.method), STATUS[m.status],
        cell(m.dir === "in" ? m.amount : -m.amount),
      ].join(";")),
      "",
      ["Resumo", "", "", "", "", "", ""].join(";"),
      ["", "Entrou", "", "", "", "", cell(r.entrou.total)].join(";"),
      ["", "Comissões", "", "", "", "", cell(-r.comissoes)].join(";"),
      ["", "Despesas pagas", "", "", "", "", cell(-r.despesas)].join(";"),
      ["", "Taxas de maquininha", "", "", "", "", cell(-r.taxas.total)].join(";"),
      ["", "Sobrou", "", "", "", "", cell(r.sobrou)].join(";"),
    ];

    // BOM para o Excel abrir com acentos
    return new NextResponse("﻿" + lines.join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="financeiro_${month}.csv"`,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }
}
