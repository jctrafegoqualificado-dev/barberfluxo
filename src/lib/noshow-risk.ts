import { prisma } from "@/lib/prisma";

export type NoshowRiskLabel = "low" | "medium" | "high";

export interface NoshowRisk {
  label: NoshowRiskLabel;
  score: number;
  noShowCount: number;
  totalCount: number;
}

// Laplace-smoothed no-show rate: avoids inflating score for clients with few visits.
// score = noShowCount / (total + 2)  →  new client with 0 history ≈ 0%, not undefined
export async function computeNoshowRisks(
  clientIds: string[],
  barbershopId: string
): Promise<Map<string, NoshowRisk>> {
  if (clientIds.length === 0) return new Map();

  const [totals, noshows] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { barbershopId, clientId: { in: clientIds } },
      _count: { _all: true },
    }),
    prisma.appointment.groupBy({
      by: ["clientId"],
      where: { barbershopId, clientId: { in: clientIds }, status: "NO_SHOW" },
      _count: { _all: true },
    }),
  ]);

  const totalMap = new Map(totals.map((t) => [t.clientId, t._count._all]));
  const noshowMap = new Map(noshows.map((n) => [n.clientId, n._count._all]));

  const result = new Map<string, NoshowRisk>();
  for (const clientId of clientIds) {
    const total = totalMap.get(clientId) ?? 0;
    const noShowCount = noshowMap.get(clientId) ?? 0;
    const score = Math.round((noShowCount / (total + 2)) * 100);
    const label: NoshowRiskLabel = score >= 50 ? "high" : score >= 20 ? "medium" : "low";
    result.set(clientId, { label, score, noShowCount, totalCount: total });
  }

  return result;
}
