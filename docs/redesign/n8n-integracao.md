# n8n: confirmação do lembrete e atendimento humano

Duas mudanças no fluxo do assistente de WhatsApp. O lado do sistema já está pronto na branch `feat/redesign`. No n8n é preciso fazer duas coisas: **consultar uma rota antes de responder** e **chamar duas rotas em momentos específicos**.

Todas as rotas são da API v1 que o fluxo já usa: mesma base, mesmo header `x-api-key` (`PUBLIC_API_KEY`) e `{slug}` da barbearia. A documentação interativa fica em `/api-docs`, tag **Conversation**.

`phone` aceita o número com ou sem DDI e máscara (`5541999990000`, `41 99999-0000`…). Pode mandar o que vem no `remoteJid`, sem o `@s.whatsapp.net`.

---

## 1. Antes de responder qualquer mensagem: a IA está pausada?

```
GET /api/v1/barbershops/{slug}/ai-status?phone=5541999990000
→ 200 { "aiPaused": true, "until": "2026-10-17T02:10:00.000Z", "reason": "Pediu desconto…" }
```

- `aiPaused: true` → **não responda**. A conversa está com a barbearia: a IA passou a conversa ou o dono pausou pelo painel.
- `aiPaused: false` → siga normalmente.

A pausa acaba sozinha (padrão de 12h) ou quando o dono clica em "Devolver para a IA" no painel.

## 2. Resposta ao lembrete (SIM / NÃO)

O sistema envia o lembrete pedindo *"Responda SIM para confirmar ou NÃO para cancelar"*. A resposta do cliente chega no n8n.

**Ordem do fluxo:** logo depois do passo 1 e antes de mandar a mensagem para o LLM, repasse a mensagem:

```
POST /api/v1/barbershops/{slug}/reminder-reply
{ "phone": "5541999990000", "text": "Sim, obrigado!" }
```

Resposta (sempre 200):

| `result` | O que fazer |
|---|---|
| `CONFIRMED` | Enviar `replyText` ao cliente e encerrar. O horário ficou confirmado. |
| `CANCELLED` | Enviar `replyText` e encerrar. O horário foi cancelado e a lista de espera já foi avisada. |
| `CANCEL_BLOCKED` | Enviar `replyText` e encerrar. As regras da barbearia não permitem o cliente cancelar, então a conversa **já foi passada** para a barbearia. |
| `NOT_UNDERSTOOD` / `NOT_FOUND` / `DISABLED` | Não era resposta ao lembrete. **Seguir com a IA normalmente.** |

O próprio sistema interpreta o texto. Ele só aceita respostas curtas e claras ("sim", "Sim, obrigado!", "não vou poder", 👍). Pergunta ou frase com outro assunto ("sim, mas dá pra ser às 15h?") volta `NOT_UNDERSTOOD`, e a IA conversa. Se o n8n já tiver interpretado, pode mandar `"answer": "YES"` ou `"NO"` no lugar de `text`.

`replyText` é uma sugestão pronta, por exemplo *"Perfeito, Gabriel! Seu horário hoje às 14:30 com Pedrão está confirmado. Até lá! 💈"*. Pode enviar como está ou passar pelo tom do assistente.

## 3. Passar a conversa para a barbearia

Quando a IA não deve ou não consegue resolver, por exemplo:
- o cliente pede desconto;
- o cliente reclama;
- o cliente pede para falar com uma pessoa;
- é um assunto fora do agendamento;
- a IA não sabe a resposta.

```
POST /api/v1/barbershops/{slug}/handoff
{ "phone": "5541999990000", "reason": "Pediu desconto para levar os 2 filhos", "name": "Pedro Henrique" }
→ 200 { "ok": true, "aiPausedUntil": "2026-10-17T02:10:00.000Z" }
```

- `reason` (obrigatório): uma frase curta. É o que o dono lê no painel.
- `pauseHours` (opcional): padrão 12, máximo 72.
- Depois de chamar, envie ao cliente algo como *"Já chamei a equipe, eles te respondem aqui em instantes"*. A partir daí o passo 1 vai retornar `aiPaused: true`.

Dica para o prompt do assistente: uma *tool* `chamar_humano(reason)` que chama esta rota funciona bem. O LLM decide quando usar.

---

## Fluxo resumido

```
mensagem do cliente
  └─ GET ai-status ── aiPaused? ── sim → não responde
                         │
                         não
                         └─ POST reminder-reply ── CONFIRMED / CANCELLED / CANCEL_BLOCKED → envia replyText, fim
                                    │
                                    NOT_UNDERSTOOD / NOT_FOUND / DISABLED
                                    └─ IA responde normalmente
                                         └─ (se precisar) POST handoff → avisa o cliente, fim
```

## O que já acontece sozinho no sistema

- O cancelamento pela rota que já existe (`PATCH …/appointments/{id}/cancel`) também avisa a lista de espera. Nada muda nessa chamada.
- O lembrete só pede SIM/NÃO quando a barbearia deixa ligado "Pedir confirmação" em Configurações → Lembretes (vem ligado por padrão).

## Quando dá para testar

As três rotas **só passam a existir em produção quando o redesign for lançado**. Até lá dá para montar o fluxo no n8n, mas não para testar de ponta a ponta. Para não quebrar nada no lançamento:

- Coloque os passos novos atrás de uma condição (ex.: variável `usarConfirmacao = false`). Assim o fluxo atual segue igual até a gente avisar.
- O passo 1 (`ai-status`) é seguro desde já: antes do lançamento a rota responde 404, e o fluxo deve tratar 404 como `aiPaused: false`.
- No dia do lançamento a gente avisa, você liga a condição e testamos juntos numa barbearia de teste.
