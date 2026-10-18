import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { MIN_PASSWORD, hashResetToken } from "@/lib/passwordReset";

/**
 * GET ?token= → o link ainda vale? (a tela avisa antes de pedir a senha)
 * POST { token, password } → troca a senha e invalida o link.
 */
async function find(token: unknown) {
  if (typeof token !== "string" || token.length < 20) return null;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true, user: { select: { email: true, isBlocked: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.user.isBlocked) return null;
  return row;
}

const INVALID = { error: "Este link não vale mais. Peça um novo em \"Esqueci a senha\"." };

export async function GET(req: NextRequest) {
  const row = await find(req.nextUrl.searchParams.get("token"));
  if (!row) return NextResponse.json(INVALID, { status: 410 });
  // E-mail parcial, só para a pessoa saber de qual conta é
  const [u, d] = row.user.email.split("@");
  return NextResponse.json({ ok: true, email: `${u.slice(0, 2)}${"•".repeat(Math.max(u.length - 2, 1))}@${d}` });
}

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json().catch(() => ({}));
    if (typeof password !== "string" || password.length < MIN_PASSWORD) {
      return NextResponse.json({ error: `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres` }, { status: 400 });
    }
    if (password.length > 200) return NextResponse.json({ error: "Senha longa demais" }, { status: 400 });
    const row = await find(token);
    if (!row) return NextResponse.json(INVALID, { status: 410 });

    const hashed = await hashPassword(password);
    // Marca como usado só se ainda não foi: dois cliques ao mesmo tempo não usam o link duas vezes
    const used = await prisma.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count === 0) return NextResponse.json(INVALID, { status: 410 });
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { password: hashed } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, id: { not: row.id } } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password] erro:", err);
    return NextResponse.json({ error: "Não foi possível trocar a senha agora. Tente de novo." }, { status: 500 });
  }
}
