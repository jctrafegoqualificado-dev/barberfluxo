# Cliente com assinatura que não paga — pode agendar?

> ✅ **Recurso implementado em 30/06/2026.** Disponível no painel em **Configurações → "Bloqueio de Assinante Inadimplente"**.

## Resumo em uma frase

Agora existe um **botão** que decide o que acontece quando o cliente da assinatura está em atraso: **ligado** = ele não agenda de jeito nenhum; **desligado** (padrão) = ele agenda pagando como avulso, sem o benefício do plano.

---

## Como o sistema detecta o atraso

Todo dia de manhã o sistema verifica as assinaturas. Se a data de cobrança passou e não houve pagamento, a assinatura é marcada como **"em atraso"** e uma cobrança pendente é gerada automaticamente. Isso vale tanto para quem paga no cartão automático (Mercado Pago) quanto para quem paga no PIX/dinheiro.

## O botão de bloqueio

| Estado do botão | O que acontece com o cliente em atraso |
| --- | --- |
| 🔴 **Ligado** | **Não consegue agendar** até regularizar. Ao tentar, vê a mensagem: *"Sua assinatura está em atraso. Regularize para voltar a agendar."* |
| ⚪ **Desligado** (padrão) | **Agenda normalmente, pagando o valor de avulso** (sem o benefício do plano). É como o sistema já funcionava antes. |

Cada dono liga ou desliga na sua própria barbearia — o botão já vem **desligado**.

Quando o dono recebe o pagamento e dá baixa, o cliente **volta a agendar automaticamente**.

## Avisos automáticos por WhatsApp

O cliente é avisado pelo WhatsApp da própria barbearia (funciona em qualquer plano, com ou sem IA):

1. **1 dia antes de vencer** — lembrete de que a assinatura vence amanhã.
2. **Quando entra em atraso** — aviso de que a assinatura ficou em aberto, com o valor a pagar.
3. **Quando a cobrança automática falha** — aviso de falha no pagamento.
4. **Se tentar agendar estando bloqueado** — aviso na hora de que não foi possível agendar por estar em atraso, com a orientação para regularizar.

## Ponto de atenção (transparência)

O bloqueio identifica o cliente pelo nome e telefone. Um cliente mal-intencionado poderia tentar driblar usando outro telefone. Não é 100% à prova de fraude — mas resolve a grande maioria dos casos.
