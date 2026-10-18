import { prisma } from "@/lib/prisma";

/**
 * Configurações da própria plataforma (tabela PlatformSetting, chave/valor).
 * Editadas em /plataforma/configuracoes; lidas pela página de vendas (/).
 */
export const PLATFORM_KEYS = {
  whatsapp: "contact.whatsapp", // só dígitos, com DDI 55 (ex.: 5541999990000)
  email: "contact.email",
} as const;

export interface PlatformContact { whatsapp: string | null; email: string | null }

export async function getPlatformContact(): Promise<PlatformContact> {
  try {
    const rows = await prisma.platformSetting.findMany({ where: { key: { in: Object.values(PLATFORM_KEYS) } } });
    const get = (k: string) => rows.find((r) => r.key === k)?.value || null;
    return { whatsapp: get(PLATFORM_KEYS.whatsapp), email: get(PLATFORM_KEYS.email) };
  } catch {
    return { whatsapp: null, email: null }; // a página de vendas nunca quebra por isso
  }
}

/** "41 99999-0000" / "+55 (41) 99999-0000" → "5541999990000"; null se não parecer um celular. */
export function normalizeWhatsapp(raw: unknown): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return null;
  const withDdi = d.length === 10 || d.length === 11 ? "55" + d : d;
  return /^55\d{10,11}$/.test(withDdi) ? withDdi : null;
}

export const waLink = (number: string, text?: string) =>
  `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
