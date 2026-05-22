import crypto from "crypto";

export function generateApiKey() {
  const randomPart = crypto.randomBytes(32).toString("hex");
  const token = `bf_${randomPart}`;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const prefix = token.slice(0, 12);
  return { token, hash, prefix };
}

export function hashApiKey(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
