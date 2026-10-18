import { createHash, randomBytes } from "crypto";

/** Validade do link de "Esqueci a senha". */
export const RESET_TTL_MS = 60 * 60 * 1000;
export const MIN_PASSWORD = 6; // mesma regra da troca de senha nas Configurações

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newResetToken = () => randomBytes(32).toString("base64url");
