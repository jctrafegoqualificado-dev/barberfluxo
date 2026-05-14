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

  if (pathname === "/api/v1/openapi") {
    return NextResponse.next();
  }

  const expected = process.env.PUBLIC_API_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "Servidor sem PUBLIC_API_KEY configurada" },
      { status: 500 }
    );
  }

  const provided = req.headers.get("x-api-key");
  if (!provided || !timingSafeEqual(provided, expected)) {
    return NextResponse.json(
      { error: "API key ausente ou inválida" },
      { status: 401, headers: { "WWW-Authenticate": "ApiKey" } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
