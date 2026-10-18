# IA de Barbearia — Handoff do redesign para o código

Pasta `design/` = 50 telas do canvas "Barber Fluxo — Redesign" (arquivos `.dc.html`) + `canvas.json` (índice com título e seção de cada tela).
Estes arquivos são **referência visual**, não código de produção: dados fictícios, estado local, sem Supabase. O trabalho é portar o visual para os componentes Next.js existentes, mantendo a lógica/queries que você já tem.

## Como usar no VS Code
1. Descompacte e copie a pasta `design/` para a raiz do projeto (ex.: `docs/design/`). Adicione ao `.gitignore` se não quiser versionar.
2. Crie uma branch: `git checkout -b redesign`.
3. Cole o prompt abaixo no Claude Code **uma fase por vez**. Revise e teste cada fase antes da próxima.

## Tokens do design (extraídos das telas)
| Papel | Cor |
|---|---|
| Fundo da página | `#F5F3EE` |
| Superfície (cards) | `#FFFFFF` |
| Superfície alternativa | `#EFEBE3` / `#F1EDE6` |
| Texto principal / fundo escuro | `#1B1916` |
| Texto secundário | `#57524A` |
| Texto terciário | `#6F685D` |
| Borda | `#E7E2D8` · controles `#E2DCD1` |
| Accent (marca, configurável) | `#C94F0C` — opções: `#A16207`, `#2F6B4F`, `#1F4E8C` |
| Sucesso | texto `#1D6B40` · fundo `#E8F4EC` |
| Alerta | texto `#6E5210` · fundo `#F5EEDC` |
| Erro | texto `#9B2C22` · fundo `#FBECEA` |

Fontes (Google Fonts / `next/font/google`): **Bricolage Grotesque** 600/700 nos títulos · **Schibsted Grotesk** 400–700 no corpo. `font-variant-numeric: tabular-nums` nos números.
Raios: 10px (botões), 12–14px (cards), 18px (cards de destaque). Toque mínimo 44px. Ícones = traço estilo Lucide (`lucide-react` casa 1:1).

## Mapa de telas (seção → arquivos)
- 01 Dashboard: `Main` (desktop), `Dashboard-celular`
- 02 Agendamentos: `Agenda-desktop`, `Agenda-celular`, `Novo-agendamento`, `Concluir-atendimento`
- 03 Profissional: `Profissional-*`, `Inicio-profissional-*`, `Producao-celular`
- 04 Clientes: `Clientes-*`, `Ficha-cliente-celular`
- 05 Financeiro: `Financeiro-*`, `Caixa-desktop`, `Comissoes-desktop`
- 06 Agendamento online (cliente): `Online-1` a `Online-5`
- 07 Landing: `Landing-desktop`, `Landing-celular`
- 08 Planos/assinantes: `Assinantes-*`, `Planos-desktop`
- 09 WhatsApp/IA: `WhatsApp-*`, `Atendente-IA-desktop`, `Lembretes-desktop`
- 10 Configurações: `Config-geral`, `Config-marca`, `Config-pagamentos`
- 11 Catálogo: `Profissionais`, `Servicos`, `Produtos`
- 12 Crescimento: `Fidelidade`, `Metas`, `Ocupacao`
- 13 Gestão: `Indicadores`, `Kanban`, `Meu-negocio`
- 14 Conta: `Login`, `Onboarding`, `Minha-assinatura`, `Cancelar-agendamento-celular`
- 15 Plataforma (admin SaaS): `Plataforma-desktop`, `Plataforma-cliente-desktop`

---

## Prompt para o Claude Code (cole no VS Code)

```
Contexto: tenho um redesign completo do app em docs/design/ (arquivos .dc.html,
um por tela, + canvas.json com o índice). São mockups HTML com estilos inline,
dados fictícios e um bloco <script> com lógica de demonstração — NÃO copie esse
código nem os dados; use-os só como referência visual exata (layout, espaçamento,
cores, tipografia, estados). Leia docs/design/LEIA-ME-HANDOFF.md para os tokens
e o mapa de telas.

Regras:
- Preserve TODA a lógica existente: queries Supabase, server actions, auth, RLS,
  rotas, validações. Só muda a camada visual.
- Nada de dados mockados no código final; ligue cada elemento ao dado real que já
  existe. Se a tela nova mostra algo que o banco ainda não tem, NÃO invente:
  liste no final como "pendência de dados".
- Trabalhe em fases e pare ao fim de cada uma para eu revisar.

Fase 0 — Inventário (não altere nada): leia o projeto e me devolva uma tabela
tela do design → rota/componente atual → status (existe / parcial / não existe)
→ dados necessários que faltam.

Fase 1 — Fundação: tokens (CSS variables + tema do Tailwind, se usado), fontes
via next/font, accent configurável por barbearia (variável CSS), e componentes
base: Button, Card, Badge/Status, Chip de filtro, Input, Tabela, BottomNav
mobile, Sidebar desktop. Mostre o diff.

Fase 2+ — Telas, uma seção por vez, na ordem: Agendamentos → Dashboard →
Agendamento online → Clientes → Financeiro → (o resto). Cada tela deve ser
responsiva (as versões desktop e celular do design são a mesma rota).
```
