/**
 * Cor principal clara (amarelo, areia…): texto branco some em cima dela. Devolve o CSS que
 * troca o texto branco dos elementos com fundo na cor principal por texto escuro — igual
 * ao que a tela de Marca promete ("os botões vão usar texto escuro").
 */
export function lightPrimaryCss(hex?: string | null): string {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return "";
  const lum = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const l = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
  if (1.05 / (l + 0.05) >= 3) return ""; // branco já é legível
  return `.bg-primary.text-white, .bg-primary .text-white, .bg-primary > svg { color: #1B1916 !important; }`;
}
