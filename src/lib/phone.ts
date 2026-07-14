/**
 * Normalização de telefone BR — evita cadastros duplicados quando o mesmo número
 * é digitado de formas diferentes (com/sem DDI 55, com/sem o 9º dígito).
 *
 * Contexto: clientes eram encontrados por match EXATO dos dígitos. Um número
 * digitado como "5541998276617" e depois "41998276617" gerava dois cadastros,
 * e a assinatura ficava presa em um deles — o agendamento no outro fechava avulso.
 *
 * `phoneVariants` é PRECISO: gera só variações estruturais do MESMO número, para
 * busca exata (indexável) — sem risco de casar pessoas diferentes.
 * `canonicalPhone` é uma chave LOSSY (DDD + últimos 8 dígitos), usada apenas para
 * AGRUPAR candidatos a duplicata em rotinas revisadas manualmente (merge).
 */

export function onlyDigits(raw?: string | null): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Remove o DDI 55 quando o comprimento indica um número BR completo (12 ou 13 dígitos). */
function national(digits: string): string {
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Chave canônica para AGRUPAR números equivalentes: DDD (2) + últimos 8 dígitos.
 * Ignora DDI 55 e o 9º dígito. É lossy (um fixo e um celular com os mesmos 8
 * dígitos finais colidem) — use só em rotinas com revisão humana (ex.: merge).
 */
export function canonicalPhone(raw?: string | null): string | null {
  const n = national(onlyDigits(raw));
  if (n.length < 10) return null;
  return n.slice(0, 2) + n.slice(-8);
}

/**
 * Variações plausíveis do MESMO número para busca exata (com/sem DDI 55,
 * com/sem 9º dígito). Preserva a estrutura completa do número — seguro para
 * usar em `where: { phone: { in: phoneVariants(x) } }`.
 * Se o número for curto demais para ser um telefone BR, devolve só os dígitos crus.
 */
export function phoneVariants(raw?: string | null): string[] {
  const digits = onlyDigits(raw);
  const n = national(digits);
  if (n.length < 10) return digits ? [digits] : [];

  const ddd = n.slice(0, 2);
  const last8 = n.slice(-8);
  const without9 = ddd + last8;        // 10 dígitos (DDD + 8)
  const with9 = ddd + "9" + last8;     // 11 dígitos (DDD + 9 + 8)

  const set = new Set<string>([n, without9, with9]);
  // Acrescenta as versões com DDI 55 de cada variação nacional
  for (const v of [...set]) set.add("55" + v);
  return [...set];
}
