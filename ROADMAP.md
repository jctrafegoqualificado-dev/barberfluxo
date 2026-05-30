# Roadmap — IaDeBarbearia

> Gerado pela C-Level Squad (Vision Chief + COO + CTO + CMO + CIO + CAIO)
> Avaliação: maio/2026

---

## H1 — Ações Imediatas (0–90 dias)

### 🔧 CTO — Qualidade & Dívida Técnica

- [x] **Renomear identidade no codebase** — `package.json name: "iadebarbearia"`; OpenAPI spec title: "IaDeBarbearia Public API"; emails sintéticos migrados para `@cliente.iadebarbearia.com`; lookups retrocompat para domínios antigos
- [x] **Remover código morto** — `src/app/(painel)/painel/financeiro/page_old_poe.tsx` deletado
- [x] **CI/CD pipeline** — `.github/workflows/ci.yml`: lint + `npx tsc --noEmit` + build em cada PR; bloqueia merge se falhar
- [x] **Testes críticos** — Vitest v4; 18 testes cobrindo auth (login/refresh), booking (novo cliente, existente, double-booking, assinante, 404s) e webhook MP (approved/rejected/cancelled/HMAC); todos passando
- [x] **ADR: Evolution API** — `docs/adr/001-evolution-api.md`; custo zero/mensagem, setup por QR, sem template approval, multi-instância por barbearia; gatilho de revisão documentado
- [x] **ADR: N8N como orquestrador** — `docs/adr/002-n8n-orquestrador.md`; iteração de prompt sem deploy, visibilidade de execução, sem cold start serverless, separação CRM ↔ IA

### 🖥️ CIO — Segurança & LGPD

- [x] **Security headers middleware** — `next.config.ts` com: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- [x] **Proteção de `isPlatformAdmin`** — rotas de update auditadas; OWNER não pode alterar `isPlatformAdmin` nem `role` de contas PLATFORM_ADMIN
- [x] **Política de retenção de WhatsApp** — `cron/whatsapp-retention`: TTL 365 dias (ajustável via `WHATSAPP_RETENTION_DAYS`); job apaga `WhatsAppMessage` com mais de 12 meses; LGPD art. 15
- [x] **WAF para endpoints públicos** — `bookingReadRatelimit` (60/min por IP) em todos os GETs de booking; `phoneLookupRatelimit` (15/5min) em `/cliente`, `/subscriber`, `/meus-agendamentos` e cancel público; ambos no middleware Edge

### ⚙️ COO — Operações & Métricas

- [x] **Dashboard de saúde dos crons** — `/api/plataforma/cron-health` registra último run + status de todos os crons (`reminders`, `mark-noshow`, `subscription-renewal`, `check-saas-expiry`, `whatsapp-retention`, `client-retention`); exibido no painel `/plataforma`
- [x] **Instrumentar CAC/LTV no painel da plataforma** — `/api/plataforma/stats` retorna: `arpu`, `ltv`, `avgTenureMonths`, `weeklyGrowth`, `conversionRate`, `churnRate`; exibido no `/plataforma`

### 📣 CMO — Marketing & Crescimento

- [x] **"Powered by IaDeBarbearia" no portal de booking** — rodapé em `agendar/[slug]/page.tsx` com link PLG passivo para captação de novos donos

---

## H2 — Próximas Funcionalidades (1–6 meses)

### 🤖 CAIO — IA & Automação

- [x] **Predictive No-Show** — Laplace smoothing sobre histórico de `NOSHOW` por cliente; badge "risco" (âmbar ≥20%) e "alto risco" (vermelho ≥50%) na Agenda de Hoje; hover mostra percentual e histórico; `src/lib/noshow-risk.ts`
- [x] **Client Retention AI Trigger** — `cron/client-retention`: detecta clientes sem agendamento há N dias (configurável por barbearia), dispara WhatsApp personalizado; `ClientRetention` controla cooldown para evitar spam
- [x] **Revenue Forecast** — `/api/barbershop/financeiro/forecast`: projeção 30/60/90 dias baseada em MRR de assinaturas + frequência histórica de atendimentos; tab "Previsão de Receita" em `/painel/financeiro/indicadores`

### 🔧 CTO — Observabilidade

- [ ] **SLOs básicos** — definir e monitorar: uptime do booking portal, latência do webhook Evolution, tempo de resposta da API v1; alertar via Sentry ou similar quando violados
- [ ] **Distributed tracing** — instrumentar fluxo crítico: `POST /booking/book` → criação de Appointment → disparo WhatsApp; facilita debug de falhas silenciosas

### 🖥️ CIO — Compliance LGPD Formal

- [x] **Privacy policy pública** — `/privacidade`: dados coletados, finalidade, retenção, direitos do titular
- [ ] **Data Processing Agreement (DPA) template** — documento para barbearias assinarem declarando que são controladoras dos dados dos clientes delas
- [ ] **DPO designado** — nomear responsável pelo tratamento de dados (pode ser o próprio fundador no estágio atual); registrar contato no site

### 📣 CMO — Retenção & Fidelidade

- [x] **Fechar loop de fidelidade** — `/painel/fidelidade`: OWNER gerencia pontos e resgates; `/avaliar/[id]`: cliente vê saldo e progresso; API `/api/barbershop/fidelidade` com ranking e resgate de desconto
- [ ] **NPS loop completo** — após review coletado, enviar mensagem de agradecimento via WhatsApp; clientes com nota ≥ 9 receber pedido de indicação; clientes com nota ≤ 6 receber contato proativo do dono

### ⚙️ COO — Processos

- [ ] **OKRs trimestrais** — definir 3 objetivos de empresa com 2-3 key results cada; revisar mensalmente; sugestão inicial: crescimento de tenants ativos, retenção de tenants 3+ meses, NPS médio das barbearias

---

## H3 — Visão de Longo Prazo (6–24 meses)

### 📣 CMO — Aquisição

- [ ] **Landing page com SEO** — site institucional separado do app; conteúdo para rankear em "sistema para barbearia", "agenda online barbearia", "WhatsApp para barbearia"; blog com casos de uso
- [ ] **Content strategy** — 1 case study por mês de barbearia cliente com resultado mensurável; distribuir no Instagram + LinkedIn do produto

### 🤖 CAIO — Data Moat

- [ ] **Pipeline de dados proprietário** — consolidar `WhatsAppMessage + Appointment + Review + LoyaltyPoint` em data warehouse analítico; esse dataset de comportamento de clientes de barbearia brasileiros é o ativo de longo prazo mais valioso da empresa
- [ ] **Fine-tuning / RAG** — quando a base de FAQs, políticas e catálogos das barbearias atingir volume suficiente, migrar assistente de prompt engineering puro para RAG com base de conhecimento por barbearia

### 🔧 CTO — Infraestrutura

- [ ] **WhatsApp Business API oficial** — avaliar migração do Evolution API (self-hosted, risco operacional) para 360dialog ou Twilio para WhatsApp; gatilho: primeiro incidente de downtime que impacta receita de cliente
- [ ] **Multi-tenant isolation** — avaliar separação de schema Postgres por tenant (Supabase RLS) para compliance enterprise quando chegar nos primeiros clientes grandes

### 📣 CMO — Expansão

- [ ] **Expansão vertical** — validar fit do produto para: estúdios de tatuagem, nail design, estéticas; o core (agenda + WhatsApp + planos + financeiro) é genérico o suficiente
- [ ] **Marketplace de integrações** — API pública robusta (`/api/v1/`) como plataforma para parceiros (sistemas de POS, ERPs locais, contabilidade)

---

## Concluído

- [x] Drag & drop na agenda do admin (mover agendamento entre barbeiros e horários)
- [x] Toggle "Em Férias" no card do barbeiro (painel admin)
- [x] Vender produto avulso no fluxo de caixa
- [x] Drag & drop na agenda do barbeiro (mover horário, single-column)
- [x] Clicar em slot vazio na agenda do barbeiro abre modal pré-preenchido com o horário
- [x] **[P1] Dia de vencimento nas assinaturas** — campo `billingDay`; badge "todo dia X"; select no modal
- [x] **[P2] Barbeiro pode cadastrar assinante** — POST `/subscriptions` aceita role BARBER; página `/barbeiro/assinaturas`
- [x] **[P3] Autocomplete de cliente no agendamento** — busca debounced por nome/telefone; seleção preenche campos
- [x] **[Notificações] Drag & drop notifica cliente** — WhatsApp "Agendamento Remarcado" ao mover na agenda
- [x] **[Notificações] Mensagens configuráveis** — `aiMensagemCancelamento` e `aiMensagemConfirmacaoAgendamento` com fallback para texto padrão
- [x] **[SaaS] Vencimento de plano** — `saasExpiresAt`, cron `check-saas-expiry`, enforcement no layout, banner 5 dias antes
- [x] **[Onboarding] Wizard guiado** — 6 passos; gate no layout redireciona para `/onboarding` se incompleto
- [x] **[Retenção] Client Retention AI** — cron detecta inatividade e dispara WhatsApp personalizado
- [x] **[Agenda] Predictive No-Show** — badge de risco na agenda do dia com Laplace smoothing
- [x] **[Financeiro] Revenue Forecast** — projeção 30/60/90 dias no dashboard financeiro
- [x] **[Fidelidade] Loop completo** — pontos por corte, resgate de desconto, ranking, página do cliente
- [x] **[LGPD] Privacy policy** — página pública `/privacidade`
- [x] **[Segurança] Security headers** — CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy no `next.config.ts`
- [x] **[Segurança] isPlatformAdmin protegido** — OWNER não pode escalar privilégios via API
- [x] **[Operações] WhatsApp retention cron** — TTL 365 dias, job de limpeza de PII
- [x] **[Operações] Cron health dashboard** — último run + status de todos os jobs no painel plataforma
- [x] **[Plataforma] Unit economics** — ARPU, LTV, tenure médio, weekly growth no `/plataforma`
- [x] **[PLG] "Powered by IaDeBarbearia"** — rodapé no portal de booking
- [x] **[CI/CD] Pipeline** — GitHub Actions com lint + tsc + build em cada PR
- [x] **[Identidade] Renomear para IaDeBarbearia** — package.json, OpenAPI spec, emails sintéticos
