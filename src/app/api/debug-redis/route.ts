import { NextResponse } from "next/server";

// Endpoint temporário de diagnóstico — REMOVER após debugar
export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return NextResponse.json({
      ok: false,
      error: "Variáveis não encontradas",
      url: url ? "presente" : "AUSENTE",
      token: token ? "presente" : "AUSENTE",
    });
  }

  try {
    // Faz um PING direto na REST API do Upstash
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      response: body,
      url: url.slice(0, 30) + "...",
    });
  } catch (e: unknown) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
