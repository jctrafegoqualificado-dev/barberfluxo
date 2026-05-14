# Auditoria Técnica BarberFluxo — Squad de Especialistas

> **Como usar:** Cole este prompt inteiro no Antigravity (modo agente, com acesso ao código). Aguarde a auditoria completa antes de pedir correções. O objetivo é DIAGNÓSTICO, não execução de fixes.

---

## CONTEXTO DO PROJETO

**BarberFluxo** é um SaaS multi-tenant B2B para barbearias, em estágio pré-lançamento. Já há código rodando em produção (Vercel) com uma barbearia real (Barbearia Demo) conectada e operacional.

**Modelo comercial:** dois planos — `BASIC` (só sistema de gestão) e `PREMIUM` (sistema + WhatsApp dedicado via Evolution API multi-instance).

**Estado atual:**
- Arquitetura multi-tenant 100% implementada e validada para o módulo WhatsApp (sessão anterior entregou: enum SaasPlan, model WhatsAppInstance, isolamento de WhatsAppContact e WhatsAppMessage por barbershopId, webhook valida apikey contra token do banco, fluxo de provisionamento self-service, UI de gerenciamento)
- Barbearia Demo conectada ao WhatsApp recebendo mensagens normalmente
- Mercado Pago ainda não implementado (placeholder)
- Aguardando rotação de 9 credenciais (foi pausada até MP estar pronto para fazer tudo de uma vez)

---

## STACK

- **Frontend/Backend:** Next.js 16 + TypeScript + Prisma
- **Banco:** Supabase Postgres via Transaction Pooler (porta 6543, pgbouncer)
- **Deploy:** Vercel (https://barberfluxo.vercel.app)
- **WhatsApp:** Evolution API v2.2.3 em VPS Hostinger (https://api.joaocostaestrategiaeads.com.br)
- **VPS Stack:** Docker (postgres, redis, tinyproxy, evolution_api, nginx-proxy-manager)
- **IDE:** Antigravity

---

## MANDATO DA SQUAD

Você vai operar como **6 personas especializadas em sequência**. Cada uma é um profissional sênior do seu domínio. Cada uma analisa o código sob seu próprio ângulo SEM redundância com as outras. Ao final, sintetiza um relatório executivo unificado.

**Regra fundamental:** esta é uma auditoria de **diagnóstico**. NÃO modifique código, NÃO crie branches, NÃO rode migrations. Apenas leia, analise e reporte.

---

## 1. ARQUITETO DE SOFTWARE (Tech Lead)

### Mandato
Avaliar coesão, separação de responsabilidades, consistência de padrões e robustez da arquitetura multi-tenant.

### Checklist
- [ ] **Multi-tenancy completo:** todo endpoint que lê ou escreve dados de tenant filtra por `barbershopId`? Existe risco de vazamento cross-tenant em algum lugar (ex.: `findMany` sem `where`)?
- [ ] **Schema Prisma:** índices em FKs e queries hot path, cascade deletes corretos, constraints UNIQUE compostos coerentes, enums vs strings livres
- [ ] **Camadas:** separação clara entre `src/app/api/*` (transport), `src/lib/*` (domain/business), e componentes React. Há lógica de negócio vazando para route handlers? Há acesso direto a Prisma em componentes?
- [ ] **DRY:** tipos compartilhados frontend/backend (interfaces de response, payloads). Cada endpoint tem seu próprio tipo redefinido ou existe uma fonte de verdade?
- [ ] **Naming:** convenções consistentes (camelCase vs snake_case, plural vs singular, prefixos)
- [ ] **Prisma usage:** uso do singleton em `src/lib/prisma.ts` é universal? Algum endpoint ainda instancia `new PrismaClient()` direto?
- [ ] **Transações:** operações multi-step usam `prisma.$transaction` ou estão soltas (risco de estado inconsistente)?
- [ ] **N+1 queries:** loops fazendo queries individuais
- [ ] **Componentes Server vs Client:** uso de `"use client"` é justificado ou está sendo aplicado por hábito?

### Output esperado
Lista numerada de findings arquiteturais com referência `arquivo:linha`, severidade (P0/P1/P2/P3), e proposta de remediação em 1-2 linhas.

---

## 2. SECURITY ENGINEER

### Mandato
Identificar vulnerabilidades de segurança, vazamentos de dados, controles de acesso fracos e exposição de credenciais.

### Checklist
- [ ] **Autenticação:** `JWT_SECRET` sem fallback (✓ já confirmado), tempo de expiração razoável, rotação implementada, refresh token? Cookie httpOnly + SameSite + Secure em prod?
- [ ] **Autorização:** todo endpoint sensível chama `requireAuth` com role correta? Há endpoints sem proteção?
- [ ] **Isolamento multi-tenant:** é possível um OWNER da barbearia A acessar dados da barbearia B através de algum parâmetro de query/body? Procurar por `findUnique({ where: { id }})` sem cruzar com `barbershopId`
- [ ] **Webhook Evolution:** validação de apikey contra token do banco (✓ já confirmado). Há rate limit? Há proteção contra replay (timestamp + nonce)?
- [ ] **Credenciais em código:** procurar por strings que parecem secrets em arquivos versionados (tokens, senhas, URLs com auth)
- [ ] **Logs:** algum `console.log` que imprime PII, tokens, JWTs, headers `Authorization`?
- [ ] **Input validation:** uso de schema validation (zod, valibot, joi) ou validação manual? Endpoints aceitam body sem validar shape?
- [ ] **SQL/Prisma injection:** uso de `prisma.$queryRaw` sem parameterização? `$executeRawUnsafe`?
- [ ] **CORS:** configuração restritiva ou aberta?
- [ ] **Headers de segurança:** CSP, HSTS, X-Frame-Options, X-Content-Type-Options configurados (`next.config.js` ou middleware)?
- [ ] **`.env`:** está no `.gitignore`? Existe `.env.example` sem segredos? Algum `.env*` versionado por acidente?
- [ ] **`process.env.*` no client bundle:** alguma var sensível com prefixo `NEXT_PUBLIC_` que não deveria estar?
- [ ] **Erro vazando stack trace ou estrutura interna pro cliente em produção**
- [ ] **Mercado Pago (placeholder):** quando integrado, vai precisar de webhook signature validation, idempotency keys

### Output esperado
Lista de vulnerabilidades classificadas em **Crítica / Alta / Média / Baixa** com CVE-like description, evidência (`arquivo:linha`), impacto e remediação proposta.

---

## 3. BACKEND ENGINEER

### Mandato
Avaliar qualidade de implementação dos endpoints, libs, lógica de negócio e integração com banco/serviços externos.

### Checklist
- [ ] **Error handling:** padrão consistente entre endpoints? Algum endpoint sem `try/catch` em chamadas async externas?
- [ ] **Status codes HTTP:** 200/201/400/401/403/404/409/422/500/502 usados corretamente?
- [ ] **Idempotência:** operações que poderiam ser duplicadas (provision, payment) têm proteção?
- [ ] **Timeouts:** fetch para Evolution tem `AbortSignal.timeout`? Cold start na Vercel pode estourar serverless limits — qual é o limite por endpoint?
- [ ] **Retries:** quando faz sentido retentar (rede instável)? Há implementação ou cada erro propaga direto?
- [ ] **Logging estruturado:** logs com contexto (barbershopId, requestId)? Ou só `console.log` solto?
- [ ] **Validação de input:** todo endpoint valida `req.body` antes de usar? Tipos TypeScript em runtime?
- [ ] **`process-incoming.ts`:** lida com `@lid` vs `@s.whatsapp.net` (item conhecido na lista de débito)?
- [ ] **`send.ts`:** ainda usa env var fixa `EVOLUTION_INSTANCE_NAME` (não-multi-tenant)? Quanta refatoração custa pra receber `barbershopId`?
- [ ] **Singleton Prisma:** todos os arquivos importam de `src/lib/prisma.ts`? Listar quem não importa
- [ ] **Connection pool:** uso correto do Transaction Pooler do Supabase, `?pgbouncer=true&connection_limit=1` na URL
- [ ] **Dead code:** endpoints/funções não chamados em lugar nenhum
- [ ] **TODOs/FIXMEs no código**

### Output esperado
Lista por arquivo (ordenado por criticidade), com snippet do problema e diff sugerido em pseudocódigo.

---

## 4. FRONTEND ENGINEER

### Mandato
Avaliar UX, acessibilidade básica, performance percebida, padrões React e qualidade do código de interface.

### Checklist
- [ ] **Estados:** todo fluxo tem loading, error e empty state? Algum lugar com flash of unstyled content?
- [ ] **Feedback ao usuário:** toasts/banners de erro são claros? Sucesso é confirmado?
- [ ] **Forms:** validação client + server, mensagens de erro próximas do campo, disable de submit em loading?
- [ ] **Acessibilidade básica:** alt em imagens significativas, `aria-label` em botões só com ícone, contraste de cores aceitável, navegação via teclado funciona?
- [ ] **Mobile responsivo:** breakpoints do Tailwind usados consistentemente? Há viewport meta tag? Layout quebra em telas pequenas?
- [ ] **Performance:** bundle size, code splitting, imagens otimizadas (Next Image), fontes carregando corretamente
- [ ] **Server vs Client Components:** uso de `"use client"` é justificado? Páginas que poderiam ser RSC estão como CC?
- [ ] **`useEffect` patterns:** cleanups corretos, dependências, race conditions
- [ ] **Hydration mismatch:** algum risco real (Date.now, Math.random, locale-dependent formatting sem `suppressHydrationWarning`)?
- [ ] **Dark mode / theming:** suportado? Consistente?
- [ ] **Sidebar e navegação:** painel já existe — está consistente com a nova página `/configuracoes/whatsapp`? Link na sidebar?
- [ ] **Reutilização de componentes:** existe `src/components/ui/` ou cada página reinventa botões/cards/inputs?

### Output esperado
Lista de issues de UX/frontend agrupada por **Bloqueador / Polish / Nice-to-have**, com referência ao arquivo e screenshot mental do problema.

---

## 5. DEVOPS / SRE

### Mandato
Avaliar infra, deploy, observabilidade, gestão de configuração e robustez operacional.

### Checklist
- [ ] **Env vars:** comparar `.env.example` (se existir), `.env` local, e Vercel — todas as vars usadas estão documentadas? Há vars órfãs (ex.: `EVOLUTION_API_KEY` antiga sem uso)?
- [ ] **Secrets management:** segredos no Vercel dashboard (não em código). Algum `.env*` versionado por acidente?
- [ ] **CI/CD:** existe pipeline (GitHub Actions, Vercel checks)? Testes rodam antes do merge? Lint?
- [ ] **Branches/PRs:** estratégia (main direto vs feature branches)? Preview deployments na Vercel?
- [ ] **Migrations Prisma:** estratégia de migration em prod (manual via `migrate deploy`? automática no build?)
- [ ] **Backups Postgres:** Supabase faz automático, mas há backup off-site dos dumps críticos (item conhecido na lista)?
- [ ] **VPS Hostinger:**
  - `docker-compose.yml` tem atributo `version:` obsoleto (item conhecido)
  - Kernels antigos acumulando (item conhecido)
  - Backup dos volumes do Postgres/Redis do Evolution
  - Logs do Docker fazendo rotação ou enchendo disco?
  - Healthchecks dos containers
  - Firewall (UFW/iptables) só com portas necessárias abertas
  - SSH key auth obrigatório, root login desabilitado, fail2ban
- [ ] **DNS/SSL:** certificados Let's Encrypt do nginx-proxy-manager renovando automaticamente?
- [ ] **Monitoring:** existe alguma observabilidade (Sentry, Better Stack, healthchecks.io)? Quem é avisado se Evolution cair?
- [ ] **Logs centralizados:** logs da Vercel, logs do Docker e logs do nginx vão pra algum lugar pesquisável?

### Output esperado
Risk matrix de infraestrutura: cada item com Probabilidade × Impacto × Esforço de remediação.

---

## 6. PRODUCT MANAGER (visão de produto e gaps de MVP)

### Mandato
Avaliar o produto sob a ótica do cliente final (dono de barbearia) — o que está pronto pra vender, o que falta, onde o usuário pode tropeçar.

### Checklist
- [ ] **Onboarding de nova barbearia:** existe fluxo self-service ou ainda é manual no banco? Quanto tempo o dono leva da assinatura até a primeira mensagem WhatsApp?
- [ ] **Telas existentes vs faltando:** dashboard, agendamentos, barbeiros, serviços, planos, assinantes, financeiro, ocupação, metas, comissões, kanban, produtos, clientes, configurações — quais estão completas, quais são placeholders?
- [ ] **Fluxo de pagamento Mercado Pago:** ainda não existe — qual é o caminho mínimo viável (criar assinatura, processar webhook, atualizar `saasPlan` automaticamente)?
- [ ] **Upgrade BASIC → PREMIUM:** existe fluxo na UI? Hoje o dono BASIC consegue clicar em "Quero WhatsApp" e ser direcionado pro upgrade?
- [ ] **Mensagens de erro user-friendly:** "Failed to create instance: Forbidden" não é uma mensagem que dono de barbearia entende. Existe camada de tradução de erros técnicos → linguagem do cliente?
- [ ] **Documentação pro usuário final:** tem help inline? Tooltip? FAQ?
- [ ] **Suporte:** existe canal pro dono pedir ajuda (chat embedded, e-mail visível)?
- [ ] **Termos de uso e política de privacidade:** existem? LGPD considerada?
- [ ] **Página de marketing/login:** primeira impressão. Está fora do escopo do app ou existe?

### Output esperado
Lista de **gaps pro MVP comercial** ordenados por: impacto na conversão / esforço / dependência de outras tasks.

---

## REGRAS DE OPERAÇÃO

1. **NÃO modifique nenhum arquivo.** Esta é uma auditoria de leitura.
2. **NÃO rode migrations, npm install, build ou outros comandos destrutivos.** Comandos read-only (`git log`, `git status`, `ls`, `grep`, `find`) são permitidos.
3. **NÃO exponha valores de secrets** em nenhuma parte do output. Se precisar referenciar uma var, use `EVOLUTION_***` mascarado.
4. **Use referências de arquivo:linha** sempre que possível. Vago não ajuda.
5. **Não invente problemas.** Se uma persona não achar nada relevante em sua área, escrever "Sem findings críticos nesta auditoria" é uma resposta válida.
6. **Não vá além do escopo de cada persona.** Resista a sobreposição.
7. **Contexto multi-tenant é central.** Qualquer feature/bug que envolva isolamento entre barbearias é P0/Crítico por default.
8. **Produção já está rodando** (Barbearia Demo conectada). Avalie risco de quebrar prod ao aplicar cada remediação.

---

## CRITÉRIOS DE SEVERIDADE

| Nível | Definição | Exemplo |
|-------|-----------|---------|
| **P0 / Crítico** | Quebra prod, vazamento de dados, exposição de credencial, bypass de auth | Endpoint que retorna dados de outra barbearia |
| **P1 / Alto** | Bug que vai pegar em escala, vulnerabilidade explorável, débito que bloqueia próximas features | `send.ts` não multi-tenant antes de onboardar 2ª barbearia paga |
| **P2 / Médio** | Polish importante, débito técnico que vai doer em 3-6 meses | Falta de validação Zod nos endpoints |
| **P3 / Baixo** | Nice-to-have, refatoração estética | Renomear variáveis, remover comentários obsoletos |

## CRITÉRIOS DE ESFORÇO

| Tamanho | Definição |
|---------|-----------|
| **S** | < 1h, 1 arquivo |
| **M** | 1-4h, poucos arquivos |
| **L** | 1-2 dias, refatoração média |
| **XL** | > 2 dias, mudança transversal |

---

## FORMATO DO RELATÓRIO FINAL

Ao final das 6 análises, sintetize **um único documento markdown** estruturado assim:

```markdown
# Relatório de Auditoria BarberFluxo — [Data]

## 1. Sumário Executivo
Parágrafo de 3-5 linhas sobre saúde geral do projeto.
Top 3 riscos atuais. Top 3 forças.

## 2. Quick Wins (alto impacto, baixo esforço)
Lista de 5-10 itens P0-P1 com tamanho S, em ordem de execução.

## 3. Findings por Persona
### 3.1 Arquitetura
### 3.2 Segurança
### 3.3 Backend
### 3.4 Frontend
### 3.5 DevOps
### 3.6 Produto

(Cada seção: tabela com #, Finding, Severidade, Esforço, Arquivo:linha, Remediação)

## 4. Roadmap Proposto em 3 fases
### Fase 1 — Crítico (esta semana)
### Fase 2 — Importante (próximas 2 semanas)
### Fase 3 — Polish (próximo mês)

## 5. Itens que NÃO devem ser feitos agora
Lista de coisas que pareceriam tentadoras mas têm baixo ROI no estado atual.

## 6. Apêndice: Lista completa de findings (planilha)
```

---

## EXTRA: VERIFICAÇÕES TRANSVERSAIS

Antes de iniciar, rode rapidamente:

```bash
# Inventário do projeto
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | wc -l
find src/app -type d | sort
cat package.json | head -50

# Sanity checks de segurança
git log --all --oneline | head -20
git ls-files | grep -E "\.env"
grep -rn "process.env" src/ --include="*.ts" --include="*.tsx" | wc -l

# Sinais de débito conhecido
grep -rn "TODO\|FIXME\|HACK\|XXX" src/ --include="*.ts" --include="*.tsx"
grep -rn "console.log\|console.error" src/ --include="*.ts" --include="*.tsx" | wc -l
grep -rn "any" src/ --include="*.ts" --include="*.tsx" | grep -v "//" | wc -l
```

Esses números entram no Sumário Executivo como contexto quantitativo.

---

## CONSTRAINTS FINAIS

- **Tom do relatório:** profissional, direto, sem floreios. Foco em ação, não em descrição.
- **Tamanho do relatório:** denso. Cliente vai ler de cima a baixo, não tem paciência pra fofice.
- **Honestidade:** se o projeto está bem em algum aspecto, diga. Se está mal, diga. Não suaviza nem dramatiza.
- **Português brasileiro:** o cliente é brasileiro, o relatório é em PT-BR.