import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { validateApiKey } from "./api-keys/middleware";

const _JWT_SECRET = process.env.JWT_SECRET;
if (!_JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}
const JWT_SECRET: string = _JWT_SECRET;

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: object) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as {
    id: string;
    email: string;
    role: string;
    barbershopId?: string;
  };
}

export function getTokenFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookieToken = req.cookies.get("token")?.value;
  if (cookieToken) return cookieToken;
  const urlToken = req.nextUrl.searchParams.get("token");
  if (urlToken) return urlToken;
  return null;
}

export function requireAuth(req: NextRequest, allowedRoles?: string[]) {
  const token = getTokenFromRequest(req);
  if (!token) throw new Error("UNAUTHORIZED");
  const payload = verifyToken(token);
  if (allowedRoles && !allowedRoles.includes(payload.role)) {
    throw new Error("FORBIDDEN");
  }
  return payload;
}

export async function requireAuthWithApiKey(
  req: NextRequest,
  allowedRoles?: string[]
): Promise<{ id: string; email: string; role: string; barbershopId?: string; source: "jwt" | "api_key" }> {
  const auth = req.headers.get("authorization");
  const rawToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (rawToken?.startsWith("bf_")) {
    const result = await validateApiKey(req);
    if (!result.valid) throw new Error("UNAUTHORIZED");
    return {
      id: "api_key",
      email: "",
      role: "API_KEY",
      barbershopId: result.barbershopId,
      source: "api_key",
    };
  }

  const payload = requireAuth(req, allowedRoles);
  return { ...payload, source: "jwt" };
}
