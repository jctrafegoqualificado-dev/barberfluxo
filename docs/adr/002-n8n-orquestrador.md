# ADR-002: N8N como orquestrador do assistente de IA

**Data:** 2026-05-30  
**Status:** Aceito  
**Autores:** João Costa (Dev)

---

## Contexto

O IaDeBarbearia oferece um assistente de IA que conversa com clientes via WhatsApp — responde perguntas, consulta slots disponíveis, cria agendamentos. Este assistente precisa:

1. Receber mensagens do WhatsApp (via Evolution API)
2. Consultar dados do CRM (agenda, serviços, horários) via `/api/v1/`
3. Chamar um LLM (OpenAI, Claude, etc.) com o contexto montado
4. Enviar a resposta de volta pelo WhatsApp

Existem duas formas de implementar esse pipeline:

**Opção A — Chamada direta no código do CRM:**  
O webhook do Evolution chama uma rota do Next.js, que monta o contexto, chama o LLM via SDK, escreve no banco e responde pelo WhatsApp. Tudo em código TypeScript dentro do app.

**Opção B — N8N como orquestrador:**  
O webhook do Evolution aponta para o N8N. Um workflow visual no N8N monta o contexto (chamando `/api/v1/`), chama o LLM, e devolve via Evolution API. O CRM expõe apenas uma API REST — não sabe da existência do LLM.

---

## Decisão

Usar **N8N** como orquestrador do assistente de IA.

O N8N roda no VPS junto com o Evolution API (`https://n8n.joaocostaestrategiaeads.com.br`). O workflow ativo é `Lord of Barba - Assistente`, que recebe webhooks da Evolution, consulta o CRM via `/api/v1/` (header `x-api-key`) e devolve respostas pelo WhatsApp.

---

## Motivos

**1. Iteração de prompt sem deploy**  
Mudar como o assistente responde (tom, instruções, formato da mensagem) é feito diretamente no workflow do N8N — sem tocar no código do CRM, sem novo build, sem tempo de deploy no Vercel. Em fase de ajuste de produto isso acontece várias vezes por semana.

**2. Visibilidade de execução**  
O N8N registra cada execução do workflow: o input recebido, cada chamada de API intermediária, a resposta do LLM, e a mensagem final enviada. Quando um cliente reclama que o bot "respondeu errado", dá pra rastrear o que aconteceu sem precisar de logs estruturados no CRM.

**3. Separação de responsabilidades**  
O CRM gerencia dados de barbearia — agenda, pagamentos, clientes. O N8N gerencia a conversação. Essa separação permite evoluir os dois independentemente: trocar de LLM (OpenAI → Claude → Gemini) sem alterar nenhum código do CRM.

**4. Composição de passos sem código**  
O pipeline de IA frequentemente precisa de passos intermediários: buscar slots disponíveis, verificar se cliente tem assinatura, formatar a data no padrão BR. No N8N esses passos são nós visuais conectados. No código seria lógica imperativa misturada com chamadas de API.

**5. Sem cold start no Vercel**  
Fluxos de IA com múltiplas chamadas de API podem levar 5–15 segundos. Funções serverless no Vercel têm limite de 10s (plano Hobby) ou 60s (Pro). No N8N rodando em VPS não há esse limite.

---

## Consequências e riscos

**Risco operacional — VPS como single point of failure:**  
Se o VPS cair, o assistente de IA para de funcionar para todas as barbearias. O CRM em si continua funcionando (agenda, pagamentos, painel). Mitigação: monitoramento via cron health dashboard; o assistente de IA é feature adicional, não core do produto.

**Curva de aprendizado do N8N:**  
Workflows complexos no N8N podem ficar difíceis de manter — especialmente lógica condicional aninhada. Regra prática: lógica de negócio pesada (validações, cálculos) vai para o CRM via endpoint próprio; o N8N só orquestra.

**Ponto de migração futuro (ADR-002-rev):**  
Reavaliar migração para código direto no CRM quando: (a) o assistente precisar de lógica muito complexa que o N8N torna difícil de testar, ou (b) o VPS apresentar instabilidade recorrente.

---

## Alternativas rejeitadas

**Chamada direta ao LLM no CRM (Next.js route):** Descartada pela fricção de iteração de prompt (requer deploy) e pelo risco de timeout em serverless. Correta se o assistente fosse uma feature simples e estável — não é o caso em fase de ajuste de produto.

**LangChain / LangGraph hospedado:** Descartado por complexidade de setup sem benefício claro sobre N8N para o volume atual. Reavaliar se o assistente precisar de memória de longo prazo ou RAG com base de conhecimento por barbearia.
