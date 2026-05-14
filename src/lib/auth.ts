import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

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
  return req.cookies.get("token")?.value || null;
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
