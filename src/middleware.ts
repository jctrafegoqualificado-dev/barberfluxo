import { NextRequest, NextResponse } from "next/server";
import { apiV1Ratelimit, bookingReadRatelimit, phoneLookupRatelimit, getIp } from "@/lib/ratelimit";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Proteger rotas de painel
  if (pathname.startsWith("/painel")) {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 1b. Proteger páginas do admin da plataforma (gate de borda).
  // Só exige presença de sessão; a validação de PLATFORM_ADMIN é feita no
  // layout (client) e, definitivamente, em requirePlatformAdmin nas APIs.
  if (pathname.startsWith("/plataforma")) {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 2. Proteção API v1 externa
  const isPublicCancelRoute = /^\/api\/v1\/barbershops\/[^/]+\/appointments\/[^/]+\/cancel$/.test(pathname);
  if (pathname.startsWith("/api/v1/") && pathname !== "/api/v1/openapi" && !isPublicCancelRoute) {
    const expected = process.env.PUBLIC_API_KEY;
    if (!expected) {
      return NextResponse.json({ error: "Servidor sem PUBLIC_API_KEY configurada" }, { status: 500 });
    }
    const provided = req.headers.get("x-api-key");
    if (!provided || !timingSafeEqual(provided, expected)) {
      return NextResponse.json(
        { error: "API key ausente ou inválida" },
        { status: 401, headers: { "WWW-Authenticate": "ApiKey" } }
      );
    }

    // Rate limit por slug — 120 req/min por barbearia (cobre ~12 conversas N8N simultâneas)
    const slugMatch = pathname.match(/^\/api\/v1\/barbershops\/([^/]+)/);
    if (slugMatch) {
      const { success } = await apiV1Ratelimit.limit(slugMatch[1]);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit excedido. Tente novamente em instantes." },
          { status: 429 }
        );
      }
    }
  }

  // 3. Proteção básica para /api/barbershop/ (só checa se existe auth na header ou cookie,
  // a validação real do JWT é feita no requireAuth de cada endpoint)
  if (pathname.startsWith("/api/barbershop/")) {
    const hasAuthHeader = req.headers.has("authorization");
    const hasCookie = req.cookies.has("token");
    if (!hasAuthHeader && !hasCookie) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  // 4. WAF: endpoints públicos de booking — scraping e enumeração de PII
  if (pathname.startsWith("/api/booking/") && req.method === "GET") {
    const ip = getIp(req);

    const { success } = await bookingReadRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento." },
        { status: 429 },
      );
    }

    // Limite adicional mais agressivo nos endpoints que expõem PII por telefone
    const SENSITIVE_SUFFIX = ["/cliente", "/subscriber", "/meus-agendamentos"];
    if (SENSITIVE_SUFFIX.some((s) => pathname.endsWith(s))) {
      const { success: ok } = await phoneLookupRatelimit.limit(ip);
      if (!ok) {
        return NextResponse.json(
          { error: "Muitas tentativas. Aguarde alguns minutos." },
          { status: 429 },
        );
      }
    }
  }

  // 5. WAF: endpoint público de cancelamento (/api/v1/.../cancel sem API key)
  if (isPublicCancelRoute) {
    const ip = getIp(req);
    const { success } = await phoneLookupRatelimit.limit(`cancel:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos." },
        { status: 429 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/plataforma/:path*", "/api/:path*"],
};
