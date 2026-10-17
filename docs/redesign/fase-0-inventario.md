# Redesign — Fase 0: inventário

Comparação das 50 telas de `docs/design/` com o código atual (branch `redesign`, out/2026).
Nada foi alterado no código nesta fase.

**Resumo:** das 50 telas, **todas têm rota correspondente** no sistema. O redesign é, na
maior parte, troca de visual. Há **8 pontos em que a tela nova mostra algo que o banco
ainda não guarda**. Esses pontos pedem decisão antes da fase da tela (ver o fim do documento).

Legenda: ✅ existe — a tela nova só troca o visual · 🟡 parcial — existe, mas a tela nova
traz um recurso a mais · ⛔ falta dado — precisa de campo/tabela nova (migration)

## 01 Dashboard

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Main` (desktop) | `/painel` | ✅ | Previsão do dia, "se todos vierem" e "perdido com falta" saem dos agendamentos. "Meta do dia" = meta mensal ÷ dias abertos. |
| `Dashboard-celular` | `/painel` | ✅ | Mesma rota, versão responsiva. |

## 02 Agendamentos

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Agenda-desktop` / `Agenda-celular` | `/painel/agendamentos` | 🟡 | Botão **"Chegou"** (check-in) não existe. Ver pendência 2. |
| `Novo-agendamento` | modal em `/painel/agendamentos` | ✅ | Toggle "Enviar confirmação pelo WhatsApp" é comportamento, não dado. |
| `Concluir-atendimento` | comanda em `/painel/agendamentos` | ⛔ | **Gorjeta** não existe. Produtos, desconto e forma de pagamento já existem. Ver pendência 1. |

## 03 Profissional

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Profissional-desktop` / `-celular` (Minha agenda) | `/barbeiro` | ✅ | "Horários livres hoje" é calculado. |
| `Inicio-profissional-desktop` / `-celular` | `/barbeiro` | ⛔ | **Recados da barbearia** (dono → equipe) não existe. Ver pendência 3. |
| `Producao-celular` (Ganhos) | `/barbeiro/producao` + `/barbeiro/comissoes` | ⛔ | Linha **Gorjetas** depende da pendência 1. |

## 04 Clientes

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Clientes-desktop` / `-celular` | `/painel/clientes` | ✅ | "Costuma vir", "sumidos" e "gastou" já são calculados. Importar planilha já existe. |
| `Ficha-cliente-celular` | `/painel/clientes` (detalhe) | ⛔ | **Observações do cliente** não existem (só há notas por agendamento). "Prefere" é calculado. Ver pendência 4. |

## 05 Financeiro

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Financeiro-desktop` / `-celular` | `/painel/financeiro` | 🟡 | "Exportar planilha" é recurso novo (sem dado novo). |
| `Caixa-desktop` | `/painel/fluxo-caixa` | ✅ | Retirar/colocar = SANGRIA/SUPRIMENTO, que já existem. "Aberto por Carlos": o caixa não guarda quem abriu; dá para mostrar sem o nome. |
| `Comissoes-desktop` | `/painel/comissoes` | ⛔ | Coluna **Gorjetas** depende da pendência 1. Vales e recibo já existem. |

## 06 Agendamento online (cliente)

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Online-1` a `Online-5` | `/agendar/[slug]` | 🟡 | **Lista de espera** (passo 3) não existe (pendência 5). "Repita o último corte" é calculado. Nota e nº de avaliações já existem. |
| `Cancelar-agendamento-celular` | `/agendar/[slug]/cancelar` | 🟡 | Hoje só cancela; **remarcar** é recurso novo. "Motivo do cancelamento" pode ir no histórico de auditoria, sem campo novo. |

## 07 Landing

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Landing-desktop` / `-celular` | `/` | ✅ | Só conteúdo e visual. |

## 08 Planos e assinantes

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Assinantes-desktop` / `-celular` | `/painel/assinaturas` | ✅ | "Cobranças de hoje" e "em atraso" saem de `nextBillingDate` + pagamentos. |
| `Planos-desktop` | `/painel/planos` | ✅ | Dependentes, barbeiros permitidos, comissão e desconto em extras já existem. |

## 09 WhatsApp e IA

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `WhatsApp-desktop` / `-celular` | `/painel/whatsapp` | ⛔ | **"Precisam de você"**, **pausar/devolver a IA por conversa**, resumo da conversa e "horários marcados pela IA" não existem. Dependem do n8n. Ver pendência 6. |
| `Atendente-IA-desktop` | `/painel/configuracoes/assistente-ia` | 🟡 | "Regras da casa" cabe em `aiObservacoesAdicionais`. **Gatilhos para passar a conversa** dependem da pendência 6. |
| `Lembretes-desktop` | `/painel/configuracoes/lembretes` | ⛔ | **Pedir confirmação SIM/NÃO** e as métricas "% que confirmaram" não existem. Ver pendência 7. "Avisar o barbeiro" já existe. |

## 10 Configurações

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Config-geral-desktop` | `/painel/configuracoes` | ✅ | Dados, horários, regras de cancelamento e descontos já existem. |
| `Config-marca-desktop` | `/painel/configuracoes/marca` | ✅ | Logo, cores, frase e favicon já existem. |
| `Config-pagamentos-desktop` | `/painel/configuracoes/pagamentos` | ✅ | Mercado Pago por barbearia já existe. |

## 11 Catálogo

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Profissionais-desktop` | `/painel/barbeiros` | ✅ | Folga, horário próprio e férias já existem. |
| `Servicos-desktop` | `/painel/servicos` | ⛔ | **"Fora do agendamento online"** (esconder serviço do link) não existe. Ver pendência 8. |
| `Produtos-desktop` | `/painel/produtos` | ✅ | "Precisa repor" é calculado pelo ritmo de vendas. |

## 12 Crescimento

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Fidelidade-desktop` | `/painel/fidelidade` | ✅ | +10 pts por avaliação, limite e desconto já existem. |
| `Metas-desktop` | `/painel/metas` | ✅ | Metas mensais e semanais, da casa e por profissional. |
| `Ocupacao-desktop` | `/painel/ocupacao` | ✅ | Mapa de calor e retorno de clientes são calculados. |

## 13 Gestão

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Indicadores-desktop` | `/painel/financeiro/indicadores` | ✅ | Pote das assinaturas já existe (`poeOwnerPct`, taxas). |
| `Kanban-desktop` | `/painel/kanban` (+ `/barbeiro/tarefas`) | ✅ | |
| `Meu-negocio-desktop` | `/painel/meu-negocio` | ✅ | ⚠️ Repete quase tudo de `Config-marca`. Ver decisão A. |

## 14 Conta

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Login-desktop` | `/login` | 🟡 | **"Esqueci a senha"** não existe hoje (recurso novo; precisa guardar o token de redefinição). |
| `Onboarding-desktop` | `/onboarding` | ✅ | |
| `Minha-assinatura-desktop` | `/painel/assinatura` | 🟡 | A tela cobra **por barbeiro extra** (2 inclusos + R$ 33,90 cada). Hoje o preço é fixo por plano. Ver decisão B. |
| `Cancelar-agendamento-celular` | ver seção 06 | | |

## 15 Plataforma (admin SaaS)

| Tela | Rota atual | Status | Observação |
|---|---|---|---|
| `Plataforma-desktop` | `/plataforma` | ✅ | MRR, churn e conversão de teste saem de pagamentos e status. "Barbeiros extras" depende da decisão B. |
| `Plataforma-cliente-desktop` | `/plataforma/clientes/[id]` | ✅ | Pagamentos e registro manual já existem (`api/plataforma/tenants/[id]/payments`). |

---

## Pendências de dados (precisam de migration)

| # | O quê | Telas | Mudança no banco | Tamanho |
|---|---|---|---|---|
| 1 | **Gorjeta** na comanda | Concluir atendimento, Comissões, Ganhos | `Appointment.tipAmount` (+ entra no "a receber" do barbeiro) | Pequeno |
| 2 | **"Chegou"** (check-in) | Agenda, Minha agenda, Dashboard | `Appointment.arrivedAt` (data/hora) | Pequeno |
| 3 | **Recados da barbearia** | Início do profissional | Tabela nova `Announcement` (texto, autor, data, lido por) | Médio |
| 4 | **Observações do cliente** | Ficha do cliente | Tabela `ClientNote` por barbearia (o cliente é global entre barbearias) | Pequeno |
| 5 | **Lista de espera** | Agendamento online passo 3 | Tabela nova `Waitlist` + aviso quando abrir vaga | Grande |
| 6 | **Passar conversa para humano** | WhatsApp, Atendente IA | `WhatsAppContact.aiPausedAt`, `needsHumanReason`; origem do agendamento (`createdBy: AI`) | Grande — depende do n8n |
| 7 | **Confirmação SIM/NÃO** do lembrete | Lembretes, Agenda, Dashboard | `Barbershop.reminderAskConfirmation`; registrar quem confirmou e por onde | Médio — depende do webhook do WhatsApp |
| 8 | **Serviço fora do link online** | Serviços, Agendamento online | `Service.onlineBooking` (padrão `true`) | Pequeno |

### Grupo 1 — ✅ implementado (16/10/2026, migration `20261016120000_redesign_grupo1`)

- **1. Gorjeta**: `Appointment.tipAmount` + `tipPaymentMethod`. Campo na comanda do painel e do barbeiro, para avulso e assinante. Entra 100% no "líquido a pagar" do barbeiro (Comissões, recibo, CSV, Minhas comissões, Produção) e fica fora do faturamento e da base de comissão.
  - Corrigido junto: antes havia um campo "Gorgeta" só para assinante que somava o valor ao `extraPrice`. A gorjeta virava faturamento da barbearia e o barbeiro recebia só a % de comissão sobre ela.
- **2. Chegou**: `Appointment.arrivedAt`. Botão "Chegou" nos cards e na lista da agenda, e "Cliente chegou / desfazer" na comanda do painel e do barbeiro. Ícone ✓ no card de quem já chegou.
- **4. Observações do cliente**: tabela `ClientNote` + `GET/PUT /api/barbershop/clientes/[id]/nota`. Campo na Ficha do Cliente, com "atualizado em … por …".
- **8. Serviço fora do link online**: `Service.onlineBooking`. Opção no cadastro do serviço e selo "Fora do agendamento online". O link público não lista nem aceita esse serviço; pelo painel continua agendável.

### Grupo 2

- **3. Recados da equipe** — ✅ implementado (16/10/2026, migration `20261016130000_recados_equipe`). Tabelas `TeamNotice` + `TeamNoticeRead`; API `/api/barbershop/recados` (GET/POST), `/recados/[id]` (DELETE), `/recados/lidos` (POST). O dono tem a tela `/painel/recados` (menu Análises → Recados): publica, opcionalmente avisa a equipe no WhatsApp, vê "lido por X de Y" e quem falta. O barbeiro vê o quadro "Recados da barbearia" no início (últimos 30 dias), com "N novos" e "Marcar como lidos".
- **5. Lista de espera** — ✅ implementado (16/10/2026, migration `20261016140000_lista_espera`). Decisão: aviso automático (opção A).
  - Tabela `WaitlistEntry`. Lógica em `src/lib/waitlist.ts`.
  - **Cliente**: no link, etapa de horário → "Não achou horário? Entre na lista de espera" (dia, nome, WhatsApp, "pode ser com outro profissional"). `POST /api/booking/[slug]/waitlist`, sem duplicar a mesma pessoa no mesmo dia.
  - **Vaga abre** quando um horário futuro é cancelado no painel, excluído, ou cancelado pelo cliente/robô (`/api/v1/.../cancel`): os 3 primeiros da fila do dia (mesmo profissional ou "qualquer um") recebem WhatsApp com o link e viram "Avisado". Quem agendar primeiro leva; quem foi avisado e não pegou continua na fila, atrás de quem nunca foi avisado.
  - **Baixa automática**: quem agenda aquele dia (pelo link ou pelo painel) sai da fila como "Agendou".
  - **Painel**: botão "Lista de espera (N)" na agenda do dia, com a fila, chamar no WhatsApp e tirar da fila. `GET/DELETE /api/barbershop/lista-espera`.
- **6 e 7. Atendimento humano e confirmação SIM/NÃO**: ✅ lado do sistema (16/10/2026, migration `20261016150000_confirmacao_e_atendimento_humano`). ⏳ Falta o n8n plugar, com guia em `docs/redesign/n8n-integracao.md`.
  - Lógica em `src/lib/whatsapp/atendimento.ts`, com testes em `src/__tests__/reminder-answer.test.ts`.
  - Rotas v1 (n8n): `reminder-reply`, `handoff`, `ai-status` (também na `/api-docs`).
  - SIM confirma (`Appointment.confirmedAt/confirmedVia`). NÃO cancela e avisa a lista de espera, seguindo as regras do cancelamento pelo link; se a regra impede, passa a conversa para a barbearia.
  - Painel: "Precisam de você" na tela do WhatsApp (devolver para a IA), opção "Pedir confirmação" e números do mês em Lembretes, selo "Confirmou no WhatsApp" na agenda.
  - Lembrete (cron): com "Pedir confirmação" ligado, garante a pergunta SIM/NÃO no fim da mensagem.

## Bugs encontrados em produção (corrigir na `main`, fora do redesign)

1. **Desconto em avulso não é aplicado no preço** (comanda do painel do dono): a comanda manda o preço cheio junto, e a API só aplica o desconto quando o preço não vem.
2. **Lembrete sai ~3h antes do configurado**: `cron/reminders` monta o horário do agendamento com `setHours` no fuso do servidor (UTC na Vercel), e não no de São Paulo.

Corrigidos no redesign (entram em produção no lançamento):

3. **Rota pública do link devolvia o cadastro inteiro da barbearia** (`GET /api/booking/[slug]`): CNPJ, instruções da IA e IDs de cobrança. Agora só os campos públicos (fase 4).
4. **"Novo cliente" e "Importar planilha" criavam o cliente sem vínculo com a barbearia**, e ele sumia da lista (que só mostra quem agendou ou assinou). Nova tabela `ShopClient`, migration `20261017120000_vinculo_cliente_barbearia` (fase 5). O `POST` de cliente também deixou de devolver o registro inteiro (com o hash da senha).
5. **Bloquear cliente vale só para o atendente do WhatsApp**: o link de agendamento não confere `isBlocked`, e o bloqueio é global (o cadastro do cliente é compartilhado entre barbearias). Não mexido — precisa decidir se o bloqueio passa a ser por barbearia.

## Decisões de produto

- **A. `Meu negócio` × `Config-marca`** — ✅ **decidido (15/10/2026):** fica só Configurações → Marca. `/painel/meu-negocio` passa a redirecionar para ela e sai do menu. Feito na fase das Configurações.
- **B. Cobrança por barbeiro extra** — ✅ **decidido (15/10/2026):** `Minha assinatura` mostra só o plano atual. O bloco "barbeiros extras" fica de fora até o modelo de preço ser decidido. O mesmo vale para "Barbeiros extras" no painel da plataforma.
- **C. Escopo do lançamento**: sugestão de lançar o redesign com as pendências pequenas (1, 2, 4, 8) e deixar 3, 5, 6 e 7 como evolução posterior. As telas aparecem sem esses blocos até lá.

## Ordem das fases

0. ✅ Inventário (este documento)
1. ✅ Fundação (16/10/2026): paleta em `globals.css` (`bg-ground`, `text-ink`, `border-line`, `bg-positive-soft`…), fontes Bricolage/Schibsted, menu lateral novo (com Recados; Marca em Configurações), barra inferior no celular, componentes base `Button`, `Card`, `Badge`/`Pill`, `Input`, `Modal`, `Chip`, `Table`. A tela de marca agora mora em `/painel/configuracoes/marca`, e `/painel/meu-negocio` redireciona para lá. Base aproveitada da branch antiga `redesign/dashboard`.
2. Agendamentos (+ pendências 1 e 2)
3. Dashboard
4. Agendamento online (+ pendência 8)
5. Clientes (+ pendência 4)
6. Financeiro, Caixa e Comissões
7. Restante: profissional, planos, WhatsApp, configurações, catálogo, crescimento, gestão, conta, plataforma, landing
