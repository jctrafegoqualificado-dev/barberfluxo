# 🚀 Roadmap Estratégico: Dashboard BI (Barberfluxo Premium)

Este documento detalha o plano de ação passo-a-passo para implementar as "6 Grandes Sacadas" de Business Intelligence no painel principal do Barberfluxo. A ordem foi pensada para entregar valor rápido ao usuário (Quick Wins) e deixar as lógicas mais complexas para o final.

---

## 📍 Fase 1: Infraestrutura e Filtro de Período (A Fundação)
**Objetivo:** Preparar o motor para suportar as consultas dinâmicas de data e aplicar o Filtro Dinâmico.
*   [x] **API de Períodos:** Criar uma rota no backend (`/api/dashboard`) que aceite parâmetros de data `?from=...&to=...`. *(Implementado dinamicamente em [/api/barbershop/dashboard](file:///c:/Users/NeoMissio/Documents/barberapp-master/src/app/api/barbershop/dashboard/route.ts) aceitando `period` para cálculo retroativo).*
*   [x] **Componente de Filtro:** Construir o botão seletor dinâmico (Hoje, Últimos 7 dias, Este mês, Personalizado). *(Implementado em [page.tsx](file:///c:/Users/NeoMissio/Documents/barberapp-master/src/app/%28painel%29/painel/page.tsx) com transição de abas premium).*
*   [x] **State Global:** Configurar o estado para que, ao mudar a data no seletor, todo o Dashboard recarregue automaticamente. *(Estado `period` integrado de forma nativa e sincronizado com `useEffect` reativo).*

## 📍 Fase 2: "Raio-X de Hoje" & Status do Robô (Hero Section)
**Objetivo:** Criar impacto visual imediato ao abrir o sistema e tranquilidade operacional.
*   [x] **Design Premium:** Criar o Card gigante com fundo em gradiente moderno. *(Renderizado no Hero com HSL gradients e blur estilizado).*
*   [x] **Próximo Cliente:** Query no banco para pegar o agendamento `PENDING` mais próximo da hora atual no dia e exibir em destaque. *(Query de busca de agenda real-time com lógica horária ativa).*
*   [x] **Métricas do Dia:** Exibir contagem de agendamentos e cálculo financeiro do que está previsto para entrar no caixa até o fim do dia. *(Métricas de `done`, `pending`, `expectedRevenue` e `realRevenue` calculadas perfeitamente).*
*   [x] **Status Pulsante do WhatsApp:** Criar um endpoint que verifica o status na tabela `WhatsAppInstance` e acende a "luz verde pulsante" ou um botão de alerta amarelo se desconectar. *(Sincronizado dinamicamente via backend e exibido com badge ativo na interface).*

## 📍 Fase 3: KPIs de Crescimento & Ticket Médio (Saúde da Barbearia)
**Objetivo:** Exibir se o negócio está crescendo ou caindo através dos "Cards Comparativos".
*   [x] **Matemática do Período Anterior:** Criar uma função que, dado um período X, descobre sozinho o "período anterior" (Ex: Se escolheu Fevereiro, calcula o período equivalente de Janeiro). *(Lógica matemática no backend gerando início/fim comparativo exato).*
*   [x] **Componentização:** Criar os 4 blocos de KPI: Faturamento, Atendimentos, Ticket Médio e Taxa de Retorno. *(Cards analíticos premium com efeitos hover glassmorphism).*
*   [x] **Selos Visuais:** Adicionar a pílula de cor (verde para positivo, vermelho para negativo) com os ícones de setinhas. *(Pílulas de variação integradas de forma elegante).*

## 📍 Fase 4: O "Quadro de Medalhas" (Rankings)
**Objetivo:** Estimular o barbeiro e facilitar ações de marketing com clientes.
*   [x] **Query de Top Clientes:** Desenvolver a consulta SQL/Prisma que soma o `total` de `AppointmentService` por Cliente, ordenando do maior para o menor. *(Agrupamento em Prisma `groupBy` e enriquecimento de dados ativo).*
*   [x] **Query de Top Barbeiros:** Mesma lógica, mas calculando o montante gerado por cada barbeiro, adicionando uma barra visual de porcentagem (comparando ao 1º colocado). *(Gráfico de progresso dinâmico desenhado sob HSL color scale).*
*   [x] **Listagem UI:** Componentizar listas limpas com as iniciais/fotos arredondadas e os valores bem definidos. *(Listas extremamente elegantes com badges ordinais).*

## 📍 Fase 5: O Ecossistema de Avaliações (NPS e Fidelidade)
**Objetivo:** Trazer o futuro para o Barberfluxo, acoplando a ideia de satisfação e recompensas.
*   [x] **Atualização do Banco (Prisma):** Injetar as tabelas de `Review` (Nota de 0 a 10 e Comentário) e `LoyaltyPoint` no sistema oficial. *(Sincronizado com Supabase com integridade referencial).*
*   [x] **Gatilho de Envio:** Fazer com que toda vez que um atendimento mude para `DONE`, a Evolution API mande uma mensagem pro cliente pedindo para ele avaliar o corte. *(Webhook integrado com Vercel hostname dinâmico e link de fidelidade `/avaliar/[id]`).*
*   [x] **Termômetro do Painel:** Adicionar o gráfico em formato de pizza/termômetro no painel listando se a sua barbearia é Nível "EXCELENTE" ou "RUIM" com base na média. *(Termômetro linear e circular de NPS implementado com régua de temperatura e card gamificado de fidelidade).*

---

## 📍 Fase 6: Insights do Concorrente (Roadmap de Expansão de BI)
**Objetivo:** Elevar o Barberfluxo ao patamar das principais ferramentas do mercado (ex: BarberCode) trazendo inteligência preditiva e análise de capacidade.
*   [ ] **Ocupação Média da Equipe (Capacidade Operacional):**
    *   *Lógica:* Calcular a eficiência da barbearia (`Horas Trabalhadas` / `Horas Totais Disponíveis` da equipe ativa no período).
    *   *Interface:* Exibir gráfico gauge (semicircular) de porcentagem e status de capacidade (Ex: Ocupação Baixa, Ideal, Sobrecarga).
*   [ ] **Aniversariantes do Mês (Ações Proativas):**
    *   *Lógica:* Consulta automática de clientes com data de aniversário no mês atual.
    *   *Interface:* Card de aniversariantes listados de forma limpa, permitindo disparar mensagens pré-configuradas no WhatsApp.
*   [ ] **Métricas de Receita Recorrente (Assinaturas e Pacotes):**
    *   *Lógica:* Agrupar faturamento específico gerado por cobranças de mensalidades vs. atendimentos avulsos.
    *   *Interface:* Cards dedicados a "Assinaturas Ativas", "Receita Recorrente Mensal (MRR)" e "Pacotes Vendidos".
*   [ ] **Indicador Físico de Ação Rápida ("Abrir/Fechar Caixa"):**
    *   *Interface:* Botão flutuante ou fixado à margem do painel que abre o fluxo de conciliação de caixa diário (frente de caixa), reduzindo cliques operacionais.
