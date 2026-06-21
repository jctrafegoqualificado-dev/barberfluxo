import { NextResponse } from "next/server";
import { loadSaasPlans } from "@/lib/saasPlans.server";

// GET /api/plans — preços/labels vigentes dos planos (público; info de pricing).
// Consumido pelos componentes de UI (assinatura, cadastro, admin) para refletir
// edições feitas pelo CEO na aba "Planos" sem precisar de novo deploy.
export async function GET() {
  const plans = await loadSaasPlans();
  return NextResponse.json(
    { plans },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
  );
}
