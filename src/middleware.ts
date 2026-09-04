import { NextRequest, NextResponse } from "next/server";
import {
  apiV1Ratelimit,
  bookingReadRatelimit,
  phoneLookupRatelimit,
  phoneLookupShopRatelimit,
  phoneLookupTargetRatelimit,
  phoneLookupOffOriginRatelimit,
  getIp,
} from "@/lib/ratelimit";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * A requisição partiu da própria página pública de agendamento?
 *
 * Navegador manda Referer em GET de mesma origem; curl e scripts externos não
 * mandam nada. Não serve como autenticação (header é forjável) e por isso não
 * bloqueia — apenas separa o tráfego real do automatizado para aplicar cotas
 * diferentes, sem quebrar quem navega com o Referer removido.
 */
function isSameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  for (const header of ["origin", "referer"]) {
    const value = req.headers.get(header);
    if (!value) continue;
    try {
      return new URL(value).host === host;
    } catch {
      return false;
    }
  }
  return false;
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
    const slug = pathname.split("/")[3] || "unknown";

    // Rotas que expõem PII por telefone. São públicas por necessidade: quem chama
    // é o navegador do cliente na página de agendamento, antes de qualquer login —
    // exigir API key aqui a colocaria no bundle JS e abriria todos os /api/v1/.
    // A defesa possível é limitar em várias dimensões, para que nenhuma delas
    // sozinha permita varredura.
    const SENSITIVE_SUFFIX = ["/cliente", "/subscriber", "/meus-agendamentos"];
    const isSensitive = SENSITIVE_SUFFIX.some((suffix) => pathname.endsWith(suffix));

    // Rodam em paralelo: são chamadas de rede ao Redis e o resultado só interessa
    // no agregado (basta uma estourar). Em série, somariam latência a cada consulta
    // de telefone — e a página faz duas por número digitado.
    const checks = [bookingReadRatelimit.limit(ip)];

    if (isSensitive) {
      // Por IP — uso normal da página
      checks.push(phoneLookupRatelimit.limit(ip));

      // Por barbearia — teto contra enumeração distribuída em IPs rotativos
      checks.push(phoneLookupShopRatelimit.limit(slug));

      // Por telefone consultado — corta monitoramento persistente de um cliente
      const targetPhone = (req.nextUrl.searchParams.get("phone") ?? "").replace(/\D/g, "");
      if (targetPhone.length >= 10) {
        checks.push(phoneLookupTargetRatelimit.limit(`${slug}:${targetPhone}`));
      }

      // Fora da página de agendamento (curl, bot, integração de terceiro): cota
      // mínima — dá para concluir um agendamento, não para varrer a base.
      // Integrações devem usar /api/v1/, protegida por API key.
      if (!isSameOrigin(req)) {
        checks.push(phoneLookupOffOriginRatelimit.limit(ip));
      }
    }

    const results = await Promise.all(checks);
    if (results.some((r) => !r.success)) {
      return NextResponse.json(
        {
          error: isSensitive
            ? "Muitas tentativas. Aguarde alguns minutos."
            : "Muitas requisições. Aguarde um momento.",
        },
        { status: 429 },
      );
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
