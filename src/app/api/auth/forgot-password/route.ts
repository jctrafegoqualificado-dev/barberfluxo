import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordReset } from "@/lib/email";
import { passwordResetRatelimit, passwordResetIpRatelimit, getIp } from "@/lib/ratelimit";
import { RESET_TTL_MS, hashResetToken, newResetToken } from "@/lib/passwordReset";

/**
 * POST /api/auth/forgot-password { email }
 * Manda o link de "criar nova senha". A resposta é sempre a mesma, exista a conta ou não,
 * para não revelar quais e-mails estão cadastrados.
 */
const DONE = { ok: true, message: "Se esse e-mail tiver uma conta, enviamos um link para criar uma nova senha." };

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json().catch(() => ({}));
    const clean = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!/^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/.test(clean)) {
      return NextResponse.json({ error: "Digite um e-mail válido" }, { status: 400 });
    }

    try {
      const [byEmail, byIp] = await Promise.all([passwordResetRatelimit.limit(clean), passwordResetIpRatelimit.limit(getIp(req))]);
      if (!byEmail.success || !byIp.success) {
        return NextResponse.json({ error: "Muitos pedidos seguidos. Espere alguns minutos e tente de novo." }, { status: 429 });
      }
    } catch (rlErr) {
      console.warn("[forgot-password] rate-limit indisponível:", rlErr);
    }

    // Só quem entra no painel (dono, barbeiro, plataforma); cliente não tem senha de uso
    const user = await prisma.user.findFirst({
      where: { email: { equals: clean, mode: "insensitive" }, isBlocked: false, role: { not: "CLIENT" } },
      select: { id: true, name: true, email: true },
    });
    if (!user) return NextResponse.json(DONE);

    const token = newResetToken();
    await prisma.$transaction([
      // Só o link mais novo vale
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } }),
    ]);

    // Endereço fixo do sistema (não o Host da requisição, que pode ser forjado)
    const base = (process.env.NEXTAUTH_URL || req.nextUrl.origin).replace(/\/$/, "");
    await sendPasswordReset({ to: user.email, name: user.name, url: `${base}/redefinir-senha?token=${token}` });
    return NextResponse.json(DONE);
  } catch (err) {
    console.error("[forgot-password] erro:", err);
    return NextResponse.json({ error: "Não foi possível enviar agora. Tente de novo em instantes." }, { status: 500 });
  }
}
