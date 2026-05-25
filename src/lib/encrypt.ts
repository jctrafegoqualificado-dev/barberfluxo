/**
 * encrypt.ts — Criptografia AES-256-GCM para dados sensíveis no banco
 *
 * Usado para proteger tokens de gateways de pagamento (Mercado Pago, etc.)
 * antes de persistir no banco de dados.
 *
 * Formato do ciphertext: "<iv_hex>:<authTag_hex>:<encrypted_hex>"
 *
 * Requisito: ENCRYPTION_KEY no .env (64 chars hex = 32 bytes)
 * Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM    = "aes-256-gcm";
const IV_LENGTH    = 12; // 96 bits — recomendado para GCM
const SEPARATOR    = ":";

// ─── Key loader ───────────────────────────────────────────────────────────────

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) throw new Error("[encrypt] ENCRYPTION_KEY não configurada no .env");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("[encrypt] ENCRYPTION_KEY deve ter exatamente 64 caracteres hex (32 bytes)");
  }
  return key;
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

/**
 * Criptografa uma string usando AES-256-GCM.
 * Cada chamada gera um IV aleatório único — ciphertexts diferentes para o mesmo input.
 */
export function encrypt(plaintext: string): string {
  const key    = getKey();
  const iv     = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 bytes de autenticação (GCM)

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(SEPARATOR);
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────

/**
 * Descriptografa um ciphertext produzido por `encrypt()`.
 * Lança erro se o ciphertext foi adulterado (autenticação GCM falha).
 */
export function decrypt(ciphertext: string): string {
  const key    = getKey();
  const parts  = ciphertext.split(SEPARATOR);

  if (parts.length !== 3) {
    throw new Error("[encrypt] Formato de ciphertext inválido — esperado iv:authTag:encrypted");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const iv        = Buffer.from(ivHex,        "hex");
  const authTag   = Buffer.from(authTagHex,   "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
