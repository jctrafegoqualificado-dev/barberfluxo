# Integração CRM ↔ n8n — Quem faz o quê e onde configurar

> Contrato de responsabilidades entre o **CRM (IaDeBarbearia)** e o **workflow do n8n**,
> para evitar duplicidade de mensagens e deixar claro onde cada coisa se configura.
>
> Última revisão: 2026-07-01

---

## 1. Princípio que rege tudo

**Cada mensagem tem UM dono.** Não existe trava técnica impedindo mensagem duplicada:
CRM e n8n disparam no **mesmo servidor Evolution**, no **mesmo número**, e um não sabe do outro.
A separação é lógica:

| Natureza | Dono | Por quê |
|---|---|---|
| **Reativo** (o cliente mandou mensagem, precisa de resposta) | **n8n** | É conversa em tempo real; o n8n tem o modelo de linguagem e o contexto do diálogo. |
| **Proativo / agendado** (disparo por evento ou por tempo) | **CRM** | O dado (agenda, assinatura, vencimento) vive no banco do CRM. O cron lê direto, com deduplicação e janela de tempo já implementadas. |

Regra de bolso: **se o gatilho é uma mensagem do cliente → n8n. Se o gatilho é um evento do sistema ou um horário → CRM.**

---

## 2. Fluxo de ENTRADA (cliente → sistema)

```
Cliente (WhatsApp)
      │
      ▼
Evolution API  ──(webhook)──►  destino depende do plano:
                                 ├─ COM IA  → n8n
                                 └─ SEM IA  → CRM /api/evolution/webhook (só salva, não responde)
```

- O destino do webhook é decidido em [`resolveWebhookUrl`](../src/lib/evolution/webhook-target.ts).
- Para loja **com IA**: aponta para `N8N_EVOLUTION_WEBHOOK_URL`.
- Para loja **sem IA**: aponta para a nossa rota, que apenas **persiste** a mensagem (o bot interno está desativado — ver [`process-incoming.ts`](../src/lib/whatsapp/process-incoming.ts)).

### O que o n8n faz ao receber uma mensagem
1. `GET /api/v1/barbershops/{slug}/ai-config` (header `x-api-key`) → pega personalidade, textos, `aiEnabled`, `businessHours`. Cachear por `ttlSeconds` (300s).
2. **Gate B:** se `aiEnabled === false` → **não responde nada** (o campo já embute plano + toggle; ver §6).
3. `GET /api/v1/barbershops/{slug}/next-slots?serviceId=...` → horários livres para sugerir.
4. Cria agendamento: `POST /api/v1/barbershops/{slug}/appointments` (nasce com status **PENDING**).
5. Cancela: `PATCH /api/v1/barbershops/{slug}/appointments/{id}/cancel`.

> ⚠️ Os endpoints v1 de agendar/cancelar **não disparam WhatsApp** — quem avisa o cliente nesse caminho é o **próprio n8n**, na conversa. Por isso não há duplicidade com o CRM.

---

## 3. Fluxo de SAÍDA (sistema → cliente) — tudo pelo CRM

```
Evento no CRM (agendamento / cancelamento / cron)
      │
      ▼
sendWhatsAppNotification() / sendMessage()
      │  POST {EVOLUTION_API_URL}/message/sendText/{instance}   (header: apikey)
      ▼
Evolution API ──► WhatsApp do cliente
```

- Implementação: [`notifications.ts`](../src/lib/notifications.ts) e [`evolution/client.ts`](../src/lib/evolution/client.ts).
- **O n8n não participa da saída proativa.** É HTTP direto CRM → Evolution.
- Pré-requisito: a instância Evolution da barbearia precisa estar **CONNECTED** (senão o envio é pulado, sem erro).
- Característica atual: **fire-and-forget, sem retry**. Cada cron tem sua própria deduplicação (ex.: flag `reminderSent`).

---

## 4. Tabela mestra — quem dispara cada mensagem

| Mensagem | Dono | Gatilho | Texto configurável em | Campo / arquivo |
|---|---|---|---|---|
| Resposta conversacional | **n8n** | cliente escreve | CRM › Assistente IA | `aiPersonality`, `aiGreetingDirective`, `aiAssistantName`, `aiIdioma`, `aiObservacoesAdicionais` |
| Boas-vindas (1º contato) | **n8n** | primeiro contato do cliente | CRM › Assistente IA | `aiMensagemBoasVindas` |
| Ausência (fora do horário) | ⚠️ **ninguém hoje** | cliente escreve fora do horário | CRM › Assistente IA (hoje **no-op**) | `aiMensagemAusencia` — ver §7 |
| Confirmação de agendamento | **n8n** (agendou pelo bot) **/ CRM** (agendou pelo painel) | agendamento criado | n8n (via GET) **e** CRM › Assistente IA | `aiMensagemConfirmacaoAgendamento` |
| Cancelamento | **n8n** (bot) **/ CRM** (painel) | cancelamento | n8n (via GET) **e** CRM › Assistente IA | `aiMensagemCancelamento` |
| Remarcação | **CRM** | remarcação no painel | fixo no código | [`appointments/route.ts`](../src/app/api/barbershop/appointments/route.ts) |
| Lembrete de agendamento (X min antes) | **CRM** (cron `reminders`) — **só Gestão + Assistente** (`hasAI`) | horário se aproximando | CRM › Configurações | `reminderEnabled`, `reminderMinutes`, `reminderMessage` |
| Lembrete de pré-vencimento da assinatura | **CRM** (cron `subscription-prebilling`, diário) — **só Gestão + Assistente** (`hasAI`) | N dias antes do vencimento (pagamento manual) | CRM › Configurações | `prebillingReminderEnabled`, `prebillingReminderDays` |

> **Confirmação/Cancelamento têm dono dividido por caminho, mas sem sobreposição:**
> se o agendamento nasceu **pelo bot (n8n)**, quem avisa é o n8n; se nasceu **pelo painel (dono)**,
> quem avisa é o CRM ([`appointments/route.ts`](../src/app/api/barbershop/appointments/route.ts)).
> Os dois caminhos nunca disparam para o mesmo agendamento.

---

## 5. Onde cada coisa se configura

### 5.1 No CRM (tela do dono)
- **Configurações › Assistente IA** → todos os campos `ai*` (personalidade, textos, toggle "Assistente ativo").
- **Configurações › Lembretes/Agendamento** → `reminderEnabled`, `reminderMinutes`, `reminderMessage`, `prebillingReminderEnabled`, `prebillingReminderDays`, `cancelByClientEnabled`, `minCancelHours`.

### 5.2 Variáveis de ambiente (infra)
| Variável | Usada para |
|---|---|
| `EVOLUTION_API_URL` | base das chamadas do CRM ao Evolution (envio, instância, webhook) |
| `EVOLUTION_GLOBAL_API_KEY` | `apikey` global usada pelo CRM nos disparos |
| `EVOLUTION_SERVER_URL` | validação opcional de origem no webhook de entrada |
| `N8N_EVOLUTION_WEBHOOK_URL` | destino do webhook Evolution para lojas **com IA** |
| `NEXT_PUBLIC_APP_URL` / `APP_URL` | destino do webhook "save-only" para lojas **sem IA** |
| `NEXTAUTH_URL` | monta o `bookingUrl` devolvido no `ai-config` |
| `PUBLIC_API_KEY` | `x-api-key` que o **n8n** usa para consumir a API v1 |
| `CRON_SECRET` | protege todos os endpoints de cron |

### 5.3 No n8n (workflow)
- Buscar config sempre via `GET /api/v1/barbershops/{slug}/ai-config` (não hardcodar prompt).
- Respeitar `aiEnabled` antes de responder.
- Cachear a config por 300s.

---

## 6. Gate de IA (`aiEnabled`) — como funciona

O endpoint `ai-config` devolve:

```
aiEnabled = hasAI(plano) && aiAtendimentoAtivo(toggle do dono)
```

- `hasAI` vem de [`getEntitlements`](../src/lib/entitlements.ts): **só é `true` no plano com Assistente (Gestão + Assistente) ativo/em carência.**
- Ou seja: **plano sem IA → `aiEnabled` é sempre `false` automaticamente.** O toggle do dono não consegue forçar `true`.
- O n8n **confia 100% nessa flag** — não precisa checar plano por conta própria.

---

## 7. Pontos de atenção em aberto (para a squad)

1. **Ausência é no-op.** `aiMensagemAusencia` está exposto na tela, mas o n8n não implementa. Decidir: **n8n implementa** (tem `businessHours` + timezone no GET) **ou esconder o campo** no CRM. *(Na loja de teste o campo está vazio — dá para decidir sem quebrar ninguém.)*
2. **Confirmação — texto único?** Confirmar se o n8n usa o campo `aiMensagemConfirmacaoAgendamento` do GET ou gera texto próprio. Se gera próprio, o campo do CRM só vale para agendamento feito pelo painel.
3. **Status PENDING vs CONFIRMED.** Agendamento feito pelo n8n (v1) nasce **PENDING**; pelo painel nasce **CONFIRMED**. O cliente ouve "confirmado" mas a agenda mostra pendente. Não gera overbooking (PENDING já bloqueia o slot). Decidir se o bot deve criar como CONFIRMED.
4. **Lembrete pede "SIM/NÃO" mas quem processa a resposta?** O cron `reminders` do CRM manda "responda SIM para confirmar / NÃO para cancelar". A resposta chega **inbound → n8n**. Alinhar que o n8n saiba tratar esse SIM/NÃO (confirmar/cancelar o agendamento), senão a resposta do cliente não faz nada.
5. **Webhook das lojas SEM IA.** Confirmar em produção que a instância Evolution de loja sem IA aponta para o CRM (save-only) e não para o n8n.
6. **Tela de config no plano sem IA.** No plano Gestão, mostrar só os campos que o CRM realmente envia (Confirmação/Cancelamento/Lembretes — que funcionam sem IA) e travar/ocultar os campos exclusivos de IA (personalidade, saudação, boas-vindas, ausência, toggle).

---

## 8. Decisão registrada

**Os disparos proativos (confirmação, cancelamento, remarcação, lembrete de agendamento e lembrete de vencimento) permanecem no CRM — não migram para o n8n.**
Motivos: o dado vive no CRM; os crons já têm deduplicação e janela de tempo; disparo agendado não pode depender de uma conversa ativa; e dois sistemas disparando o mesmo aviso, sem trava entre eles, geraria mensagens duplicadas.
