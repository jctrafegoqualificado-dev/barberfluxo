# Checklist de Definições de Produto — BarberFluxo

Este documento serve como guia para alinhar as regras de negócio entre o desenvolvedor e o idealizador do sistema.

---

### 1. Financeiro & Comissões (Fase 1)
*   **Múltiplos Serviços:** Se o cliente faz Cabelo (R$ 50) e Barba (R$ 30), a comissão é uma porcentagem fixa sobre o total ou pode variar por serviço (ex: 50% em corte e 30% em barba)?
*   **Descontos:** Se o barbeiro der um desconto manual na comanda, esse valor sai do faturamento bruto da barbearia, da comissão do barbeiro, ou é rateado entre ambos?
*   **Taxas de Cartão:** A taxa da maquininha deve ser descontada do valor antes de calcular a comissão ou a barbearia assume esse custo integralmente?
*   **Fechamento:** O barbeiro deve ver sua produção/comissão em tempo real ou apenas após o dono "aprovar/encerrar" o dia financeiro?

### 2. WhatsApp & Auto-atendimento (Fase 2)
*   **Tom de Voz:** O bot deve ser formal ("Olá, como posso ajudar?") ou informal ("E aí, bora dar um tapa no visual?")?
*   **Fluxo de Agendamento:** Quando o bot identificar um pedido de agenda, ele deve enviar o link para o cliente escolher ou deve tentar perguntar o horário ali mesmo no chat?
*   **Horário de Funcionamento:** O bot deve responder 24h ou apenas fora do horário comercial quando não houver atendimento humano?
*   **Inteligência de Retenção:** Com quantos dias de ausência consideramos um cliente "sumido" para disparar a mensagem de retorno? (Padrão sugerido: 20-30 dias).

### 3. Pagamentos Online (Mercado Pago - Fase 3)
*   **Tipo de Cobrança:** Vamos exigir pagamento total antecipado, apenas um sinal (reserva) ou o pagamento online será opcional para o cliente?
*   **Política de Cancelamento:** Se o cliente pagar antecipadamente e não aparecer (no-show), o valor fica com a barbearia ou o estorno é automático?
*   **Prazo de Recebimento:** O idealizador prefere receber o dinheiro na hora (taxas maiores) ou aguardar os prazos padrão do Mercado Pago (taxas menores)?

### 4. Fidelidade & Performance
*   **Regras de Pontuação:** O sistema de pontos será por valor gasto (ex: R$ 1 = 1 ponto) ou por número de visitas (ex: a cada 10 cortes, ganha 1)?
*   **Premiação:** O que o cliente resgata? Um serviço grátis, um desconto em reais ou um produto físico da barbearia?
*   **Metas de Barbeiros:** O dono deseja cadastrar metas de faturamento para os barbeiros e exibir o progresso para eles no painel?

---

### 💡 Dicas para a Reunião:
1.  **Peça Exemplos:** Sempre peça um exemplo real. "Se eu cobrar R$ 100 no PIX, quanto exatamente vai para o barbeiro e quanto fica para a casa?".
2.  **Valide o "Pior Cenário":** "E se o cliente cancelar faltando 5 minutos, o que o sistema deve fazer?".
3.  **Foco no MVP:** Se a definição for muito complexa, sugira começar com a regra mais simples e evoluir depois.
