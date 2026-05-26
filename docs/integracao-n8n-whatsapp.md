# Documento de Integração: IaDeBarbearia ↔ N8N ↔ Evolution API

**Data:** 26/05/2026  
**Versão:** 1.0 — MVP  
**Participantes:** Dev N8N (João Costa) · Dev CRM (IaDeBarbearia)

---

## 1. Contexto e Situação Atual

### O que cada sistema faz hoje

| Sistema | Responsabilidade |
|---|---|
| **CRM (IaDeBarbearia)** | Gestão de barbearias, agendamentos, clientes, pagamentos, assinaturas, lembretes automáticos via WhatsApp |
| **Evolution API** (no VPS) | Gerencia as conexões WhatsApp de cada barbearia |
| **N8N** (no VPS) | Contém o workflow do assistente de IA que conversa com os clientes |

### Infraestrutura levantada no VPS

- **N8N:** `docker.n8n.io/n8nio/n8n` rodando na porta `5678`
- **URL pública do N8N:** `https://n8n.joaocostaestrategiaeads.com.br`
- **Banco do N8N:** PostgreSQL (`evolution_postgres`, user: `evolution`)
- **Workflow ativo:** `Lord of Barba - Assistente` → webhook path: `evolution-webhook`
- **Webhook URL ativa do N8N:**  
  `https://n8n.joaocostaestrategiaeads.com.br/webhook/evolution-webhook`

### O problema identificado

Quando o dono de uma barbearia conecta o WhatsApp pelo **menu do CRM** (escaneando o QR Code), o sistema cria uma instância no Evolution API com o webhook apontando para **nossa rota antiga**:

```
❌ HOJE:
WhatsApp → Evolution → https://barberfluxo.vercel.app/api/evolution/webhook (bot antigo)

✅ DEVERIA SER:
WhatsApp → Evolution → https://n8n.joaocostaestrategiaeads.com.br/webhook/[path] → N8N (IA)
```

---

## 2. O Problema de Escala — Por que não podemos continuar manual

O processo manual atual funciona assim:
1. Cliente escaneia QR Code → nova instância no Evolution
2. Dev N8N vai ao Evolution, pega o nome da instância
3. Dev N8N duplica o workflow no N8N manualmente
4. Configura o novo workflow para aquela instância
5. Repete isso para cada novo cliente

**Isso não escala.** Para 50 barbearias, são 50 intervenções manuais. Para 200, inviável.

---

## 3. Arquitetura Proposta — Workflow Único Genérico

### A inversão de lógica

Em vez de **1 workflow por barbearia**, ter **1 workflow genérico** que, ao receber uma mensagem, consulta o CRM para saber como se comportar com aquela barbearia específica.

```
CLIENTE envia mensagem
        ↓
   Evolution API
        ↓
   N8N (1 workflow único)
        ↓
   Lê instanceName do payload da Evolution
        ↓
   GET /api/v1/barbershops/{slug}/ai-config  ← chama nossa API
        ↓
   Recebe: nome, personalidade, instruções, horários de funcionamento
        ↓
   LLM processa com o contexto certo da barbearia
        ↓
   Se precisar de dados dinâmicos (agenda, serviços):
   GET /api/v1/barbershops/{slug}/slots      ← function calling
   GET /api/v1/barbershops/{slug}/services   ← function calling
        ↓
   Evolution API envia resposta ao cliente ✅
```

### O que não muda

Os **lembretes automáticos** continuam funcionando pelo CRM, sem passar pelo N8N:

```
Cron CRM (a cada 15min) → Evolution API → WhatsApp do cliente
```

Isso já está funcionando e não deve ser alterado.

---

## 4. API do CRM disponível para o N8N

### Autenticação

Todas as chamadas devem incluir o header:

```
x-api-key: [PUBLIC_API_KEY]
```

A chave será fornecida pelo time do CRM e configurada como variável de ambiente no N8N.

**⚠️ Observação de segurança:** Por ora, há uma chave única para todas as barbearias (MVP). Isso será migrado para chaves por instância quando escalar para 30-50 clientes.

---

### 4.1 Endpoint de Configuração da IA (NOVO — a criar)

> **Este endpoint ainda não existe. Será criado após alinhamento desta reunião.**

```
GET /api/v1/barbershops/{slug}/ai-config
Header: x-api-key: [chave]
```

**Resposta esperada:**

```json
{
  "barbershop": {
    "name": "Lord of Barba",
    "slug": "lord-of-barba",
    "phone": "5511999998888",
    "address": "Rua das Barbearias, 123 — São Paulo/SP",
    "bookingUrl": "https://app.iadebarbearia.com.br/agendar/lord-of-barba"
  },
  "ai": {
    "assistantName": "Barba Bot",
    "personality": "Somos uma barbearia descontraída de bairro. Chame o cliente de 'parceiro'. Seja direto e simpático. Sempre ofereça um horário alternativo se o pedido não estiver disponível.",
    "greetingDirective": "Se for a primeira mensagem do dia do cliente, cumprimente com entusiasmo e pergunte como pode ajudar. Não use a saudação como resposta literal — use como tom.",
    "fallbackMessage": "Opa, não entendi direito. Você quer agendar um horário, ver nossos serviços ou falar sobre outro assunto?"
  },
  "businessHours": [
    { "dayOfWeek": 0, "isOpen": false },
    { "dayOfWeek": 1, "isOpen": true, "openTime": "09:00", "closeTime": "19:00" },
    { "dayOfWeek": 2, "isOpen": true, "openTime": "09:00", "closeTime": "19:00" },
    { "dayOfWeek": 3, "isOpen": true, "openTime": "09:00", "closeTime": "19:00" },
    { "dayOfWeek": 4, "isOpen": true, "openTime": "09:00", "closeTime": "19:00" },
    { "dayOfWeek": 5, "isOpen": true, "openTime": "09:00", "closeTime": "20:00" },
    { "dayOfWeek": 6, "isOpen": true, "openTime": "09:00", "closeTime": "16:00" }
  ],
  "meta": {
    "instanceName": "lord-of-barba-a1b2c3",
    "timezone": "America/Sao_Paulo",
    "ttlSeconds": 300
  }
}
```

**Nota sobre cache:** O N8N deve cachear essa resposta por **5 minutos (TTL 300s)** para não sobrecarregar a API. Se o dono alterar a configuração no CRM, o cache expira naturalmente no próximo ciclo.

---

### 4.2 Endpoints Dinâmicos (já existem no sistema)

Esses endpoints **já estão em produção** e o N8N pode chamar sob demanda (function calling):

#### Serviços da barbearia
```
GET /api/v1/barbershops/{slug}/services
Header: x-api-key: [chave]
```

```json
{
  "services": [
    {
      "id": "svc_abc123",
      "name": "Corte Masculino",
      "description": "Corte social ou degradê",
      "price": 45.00,
      "durationMinutes": 45,
      "active": true
    },
    {
      "id": "svc_def456",
      "name": "Barba",
      "price": 30.00,
      "durationMinutes": 30,
      "active": true
    }
  ]
}
```

#### Barbeiros disponíveis
```
GET /api/v1/barbershops/{slug}/barbers
Header: x-api-key: [chave]
```

```json
{
  "barbers": [
    {
      "id": "brb_abc123",
      "name": "Carlos Silva",
      "avatarUrl": "https://..."
    }
  ]
}
```

#### Horários disponíveis
```
GET /api/v1/barbershops/{slug}/slots?date=2026-05-28&barberId=brb_abc123&serviceId=svc_abc123
Header: x-api-key: [chave]
```

```json
{
  "date": "2026-05-28",
  "dayOfWeek": 3,
  "duration": 45,
  "slots": ["09:00", "09:45", "10:30", "14:00", "14:45", "15:30"]
}
```

#### Agendamentos futuros do cliente
```
GET /api/v1/barbershops/{slug}/appointments?clientPhone=5511999998888
Header: x-api-key: [chave]
```

#### Criar agendamento
```
POST /api/v1/barbershops/{slug}/appointments
Header: x-api-key: [chave]
Content-Type: application/json
```

```json
{
  "date": "2026-05-28",
  "startTime": "14:00",
  "barberId": "brb_abc123",
  "serviceId": "svc_abc123",
  "clientPhone": "5511999998888",
  "clientName": "João Cliente",
  "paymentMethod": "CASH"
}
```

**Resposta de sucesso (201):**
```json
{
  "appointment": {
    "id": "apt_xyz789",
    "date": "2026-05-28",
    "startTime": "14:00",
    "endTime": "14:45",
    "status": "CONFIRMED",
    "service": { "name": "Corte Masculino" },
    "barber": { "name": "Carlos Silva" }
  }
}
```

**Resposta de conflito (409):** horário já ocupado, fora do horário de funcionamento ou barbeiro de folga.

#### Cancelar agendamento
```
PATCH /api/v1/barbershops/{slug}/appointments/{id}/cancel
Header: x-api-key: [chave]
```

---

## 5. Como identificar a barbearia a partir da instância Evolution

O payload que a Evolution envia ao N8N contém o campo `instance` com o nome da instância. Nosso sistema cria instâncias com o padrão:

```
{slug-da-barbearia}-{6 primeiros chars do ID}
Exemplo: lord-of-barba-a1b2c3
```

O N8N pode extrair o `slug` do campo `instance` para chamar os endpoints usando uma das abordagens:

**Opção A (recomendada):** Chamar `GET /api/v1/barbershops/{instanceName}/ai-config` passando o `instanceName` completo. O CRM faz o lookup internamente pelo campo `evolutionInstanceName` do banco.

**Opção B:** Separar o slug extraindo tudo antes do último `-` + 6 chars.

Recomendamos a **Opção A** para não criar dependência no padrão de nome de instância.

---

## 6. O que muda no código do CRM

### Mudança imediata (1 linha)

**Arquivo:** `src/app/api/whatsapp/provision/route.ts` — linha 6

```typescript
// ANTES
const WEBHOOK_URL = "https://barberfluxo.vercel.app/api/evolution/webhook";

// DEPOIS (a URL única do N8N workflow genérico)
const WEBHOOK_URL = process.env.N8N_EVOLUTION_WEBHOOK_URL || "";
```

E no `.env`:
```env
N8N_EVOLUTION_WEBHOOK_URL="https://n8n.joaocostaestrategiaeads.com.br/webhook/evolution-webhook"
```

Isso faz com que **toda nova barbearia** que conectar o WhatsApp pelo CRM já aponte automaticamente para o N8N.

### Novos campos no banco (migração Prisma)

```prisma
// Adicionar ao model Barbershop
aiAssistantName     String?  @db.VarChar(50)
aiPersonality       String?  @db.Text        // Vai direto para o system prompt do LLM
aiGreetingDirective String?  @db.Text        // Diretriz de saudação (não string literal)
```

**Nota:** Deliberadamente **sem** campo `aiTone` (formal/informal). O tom já está embutido no texto livre de `aiPersonality`. Ter os dois geraria conflito quando o dono escolhesse "formal" mas escrevesse uma personalidade descontraída.

### Nova tela no CRM

Aba **"Assistente IA"** nas configurações da barbearia, onde o dono preenche:

- **Nome do assistente** (ex: "Barba Bot", "Assistente da Lord of Barba")
- **Personalidade e tom de voz** — campo de texto livre, máx. 500 caracteres  
  *Dica exibida na tela: "Descreva como seu assistente deve falar. Ex: 'Sou uma barbearia descontraída, chamo o cliente de parceiro, falo de forma direta e simpática.'"*
- **Diretriz de saudação** — campo de texto livre, máx. 200 caracteres  
  *Dica: "Como o assistente deve se apresentar na primeira mensagem. Ex: 'Cumprimente com entusiasmo e pergunte em que pode ajudar.'"*

---

## 7. Perguntas que precisam ser respondidas pelo dev N8N

Estas respostas definem o que é possível construir e em qual ordem:

### ❓ Pergunta 1 — Workflow genérico com roteamento por instância

> O workflow consegue receber o `instanceName` no payload da Evolution e, a partir dele, buscar a configuração da barbearia correta na nossa API? Em outras palavras: um único workflow serve todas as barbearias?

*Se sim → podemos mudar o webhook URL no CRM e eliminar o processo manual imediatamente.*  
*Se não → precisamos rever a arquitetura antes de codar.*

### ❓ Pergunta 2 — Function calling (múltiplos endpoints durante a conversa)

> O LLM no N8N consegue chamar endpoints diferentes da nossa API durante a mesma conversa? Por exemplo:  
> 1. Buscar lista de serviços (`/services`)  
> 2. Buscar horários disponíveis (`/slots`)  
> 3. Criar agendamento (`POST /appointments`)  
> — tudo dentro de uma única sessão de conversa com o cliente?

*Se sim → a arquitetura com endpoints separados funciona.*  
*Se não → precisamos discutir um endpoint consolidado ou outra abordagem.*

### ❓ Pergunta 3 — Injeção da API Key

> Como você vai configurar a `PUBLIC_API_KEY` do CRM no N8N para chamar nossa API? Variável de ambiente no workflow? Credential do N8N?

*Precisamos garantir que a chave não fique exposta nos logs do N8N.*

### ❓ Pergunta 4 — Fallback quando a API do CRM cair

> Se nossa API retornar erro (timeout, 500), o que o workflow faz? Existe uma resposta genérica de fallback armazenada no N8N para manter o bot respondendo mesmo sem a config?

*Exemplo de fallback aceitável: "Olá! Nosso sistema está passando por instabilidade. Por favor, tente novamente em alguns minutos."*

---

## 8. Ordem de execução recomendada

```
ETAPA 1 — HOJE (sem código)
Responder as 4 perguntas acima
Confirmar se o workflow genérico é viável tecnicamente
Alinhar o formato exato do JSON do /ai-config

ETAPA 2 — CRM (após alinhamento)
Criar endpoint GET /api/v1/barbershops/{slug}/ai-config
Adicionar campos ai* no banco (migração Prisma)
Mudar WEBHOOK_URL no provision/route.ts → variável de ambiente

ETAPA 3 — N8N (em paralelo ou após Etapa 2)
Refatorar o workflow "Lord of Barba - Assistente" para ser genérico
Configurar roteamento por instanceName
Testar com 2 barbearias diferentes

ETAPA 4 — CRM (após N8N validado)
Criar tela "Assistente IA" no painel do dono da barbearia
```

---

## 9. O que NÃO fazer no MVP (dívida técnica registrada)

| Item | Motivo para adiar | Quando fazer |
|---|---|---|
| API keys por instância (hoje é uma chave global) | Pouco risco com poucos clientes | Fase 30-50 clientes |
| Invalidação de cache via webhook (CRM avisa N8N quando config muda) | Cache TTL de 5min resolve | Fase 30-50 clientes |
| Audit trail de alterações de config | Pouco volume de suporte no início | Fase 30-50 clientes |
| Versionamento de workflows N8N | Complexidade desnecessária agora | Fase 100+ clientes |

---

## 10. Resumo executivo

| | Antes | Depois |
|---|---|---|
| **Novo cliente conecta WhatsApp** | Dev N8N duplica workflow manualmente (10 min) | Automático ao escanear QR Code |
| **Personalidade do assistente** | Hardcoded no workflow N8N | Configurável pelo dono no CRM |
| **Escalabilidade** | 1 workflow por barbearia | 1 workflow para todas |
| **Dependência manual** | Dev N8N é gargalo em cada venda | Zero intervenção por cliente |

---

*Documento gerado com base na análise do código-fonte do CRM, inspeção da infraestrutura do VPS e discussões de arquitetura realizadas em 26/05/2026.*
