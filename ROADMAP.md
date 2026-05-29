# Roadmap — IaDeBarbearia

> Gerado pela C-Level Squad (Vision Chief + COO + CTO + CMO + CIO + CAIO)
> Avaliação: maio/2026

---

## H1 — Ações Imediatas (0–90 dias)

### 🔧 CTO — Qualidade & Dívida Técnica

- [ ] **Renomear identidade no codebase** — `package.json` `name: "barberfluxo"` → `"iadebarbearia"`; título da OpenAPI spec (`/api/v1/openapi`) → "IaDeBarbearia Public API"; eliminar qualquer referência residual a "BarberFluxo"
- [ ] **Remover código morto** — deletar `src/app/(painel)/painel/financeiro/page_old_poe.tsx`
- [ ] **CI/CD pipeline** — GitHub Actions: lint + build + `npx tsc --noEmit` em cada PR; bloquear merge se falhar
- [ ] **Testes críticos** — cobertura mínima nos fluxos de maior risco: autenticação (login/refresh), criação de agendamento, webhook do Mercado Pago
- [ ] **ADR: Evolution API** — documentar por que Evolution em vez de WhatsApp Business API oficial (custo, controle, risco); serve para futuras decisões de migração
- [ ] **ADR: N8N como orquestrador** — documentar por que N8N em vez de chamada direta à API de LLM

### 🖥️ CIO — Segurança & LGPD

- [ ] **Security headers middleware** — adicionar `next.config` com headers: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`
- [ ] **Proteção de `isPlatformAdmin`** — auditar todas as rotas de update de usuário (`PATCH /api/barbershop/profile`, registro) para garantir que `isPlatformAdmin` e `role` não podem ser alterados pelo próprio usuário
- [ ] **Política de retenção de WhatsApp** — definir TTL para `WhatsAppMessage` (ex: 12 meses); `rawPayload Json` armazena PII não estruturado — criar job de limpeza ou mascarar dados sensíveis
- [ ] **WAF para endpoints públicos** — aplicar rate limiting mais agressivo em `/api/booking/[slug]` e `/api/v1/` (atualmente apenas Upstash geral)

### ⚙️ COO — Operações & Métricas

- [ ] **Dashboard de saúde dos crons** — instrumentar `cron/reminders`, `cron/mark-noshow`, `cron/subscription-renewal`, `cron/check-saas-expiry` com último run + status no painel `/plataforma`; alertar se job não rodou no prazo esperado
- [ ] **Instrumentar CAC/LTV no painel da plataforma** — adicionar no `/api/plataforma/stats`: custo por tenant ativo, receita média por barbearia, churn mensal de tenants

### 📣 CMO — Marketing & Crescimento

- [ ] **"Powered by IaDeBarbearia" no portal de booking** — rodapé discreto em `/booking/[slug]` com link para página de cadastro; captura donos de barbearia que chegam como clientes de outras barbearias (PLG passivo)

---

## H2 — Próximas Funcionalidades (1–6 meses)

### 🤖 CAIO — IA & Automação

- [ ] **Predictive No-Show** — modelo de classificação usando histórico de status `NOSHOW` por cliente; exibir no painel do admin/barbeiro o risco de falta do próximo agendamento; dados já existem no schema
- [ ] **Client Retention AI Trigger** — detectar clientes sem agendamento há N dias (configurável), disparar mensagem WhatsApp personalizada automaticamente; usar `aiMensagemAusencia` como template base
- [ ] **Revenue Forecast** — previsão de receita 30/60/90 dias com base em assinaturas ativas + frequência histórica de atendimentos; exibir no dashboard financeiro

### 🔧 CTO — Observabilidade

- [ ] **SLOs básicos** — definir e monitorar: uptime do booking portal, latência do webhook Evolution, tempo de resposta da API v1; alertar via Sentry ou similar quando violados
- [ ] **Distributed tracing** — instrumentar fluxo crítico: `POST /booking/book` → criação de Appointment → disparo WhatsApp; facilita debug de falhas silenciosas

### 🖥️ CIO — Compliance LGPD Formal

- [ ] **Privacy policy pública** — página `/privacidade` documentando: dados coletados, finalidade, retenção, direitos do titular; obrigatório para LGPD
- [ ] **Data Processing Agreement (DPA) template** — documento para barbearias assinarem declarando que são controladoras dos dados dos clientes delas
- [ ] **DPO designado** — nomear responsável pelo tratamento de dados (pode ser o próprio fundador no estágio atual); registrar contato no site

### 📣 CMO — Retenção & Fidelidade

- [ ] **Fechar loop de fidelidade** — criar área do cliente (app web ou via WhatsApp) para visualizar e resgatar pontos de `LoyaltyPoint`; sem isso o incentivo de +10 pontos no NPS é promessa vazia
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
