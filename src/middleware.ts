import { NextRequest, NextResponse } from "next/server";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Proteger rotas de painel
  if (pathname.startsWith("/painel")) {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // 2. Proteção API v1 externa
  if (pathname.startsWith("/api/v1/") && pathname !== "/api/v1/openapi") {
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/api/:path*"],
};
