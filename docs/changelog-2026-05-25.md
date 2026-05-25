# O que mudou no sistema em 25/05/2026

Este documento explica, em linguagem simples, tudo o que foi feito hoje no sistema da barbearia. Está organizado em três blocos:

- **Adicionado** — coisas que não existiam antes
- **Modificado** — coisas que já existiam e foram melhoradas
- **Corrigido** — problemas que foram resolvidos

---

## Adicionado (novidades)

### 1. Desconto na comanda

Agora o barbeiro (ou o administrador) pode aplicar um desconto percentual no momento de fechar o atendimento. Por exemplo: o cliente pediu corte + barba, mas pagou só o corte com 10% off porque era amigo da casa. O sistema:

- Registra o **percentual aplicado** e o **motivo** do desconto.
- Mostra no relatório de comissões quanto de desconto cada barbeiro deu no mês.
- Calcula a comissão sobre o valor **já descontado** (o barbeiro divide o desconto com a barbearia, de forma proporcional).
- Permite que o administrador defina um **teto máximo de desconto** nas configurações (ex: ninguém pode dar mais de 20%).
- Permite definir um **desconto extra por plano de assinatura** (ex: assinantes do plano Premium ganham 5% off em qualquer serviço extra).

### 2. Cobrança automática recorrente da assinatura

Antes, todo mês a barbearia precisava cobrar manualmente cada assinante. Agora o sistema usa o **Mercado Pago Preapproval** — o cliente autoriza uma vez e a cobrança é feita automaticamente todo mês, sem intervenção. Se o cartão falhar, o sistema marca como atrasado e avisa.

### 3. Exportação de dados pessoais (LGPD)

Novo botão "Exportar dados (LGPD)" na tela de clientes. Em um clique, o cliente recebe um arquivo com **todos os seus dados pessoais** (cadastro, histórico de agendamentos, assinatura, pagamentos). Isso atende ao Art. 18 da LGPD, que obriga empresas a fornecer esses dados quando solicitado.

### 4. Marcação automática de "não compareceu"

O sistema agora marca automaticamente como "Faltou" os agendamentos que ficaram pendentes depois de um certo tempo. O administrador da barbearia pode:

- **Ligar ou desligar** essa automação.
- **Configurar a janela de tolerância** (ex: marca como faltou só 3 horas depois do horário).

### 5. Reabrir e excluir agendamentos cancelados ou perdidos

Antes, se o cliente faltasse ou cancelasse, o agendamento ficava "preso" naquele status. Agora:

- **Barbeiro** pode reabrir um agendamento marcado como "Faltou" (caso o cliente tenha chegado atrasado) ou excluí-lo definitivamente.
- **Administrador** pode reabrir e excluir tanto "Faltou" quanto "Cancelado".
- **Administrador** ganhou um botão **"Faltou"** na lista, para marcar manualmente sem esperar a automação.

Quando um agendamento de assinante é excluído ou cancelado, o sistema **devolve o uso** para o ciclo da assinatura (o cliente não perde aquele atendimento do mês).

### 6. Limite de tentativas no login (proteção contra ataques)

Se alguém errar a senha várias vezes seguidas, o sistema bloqueia temporariamente novas tentativas vindas daquele IP. Isso impede que robôs fiquem testando senhas em massa. Em caso de problema técnico (servidor de cache fora do ar), o sistema **libera o acesso** em vez de derrubar o login — preferimos um cuidado a menos a deixar usuários legítimos sem entrar.

### 7. Renovação silenciosa do login

Antes, o usuário ficava logado por 7 dias seguidos (um risco, se o aparelho fosse perdido). Agora o login dura **24 horas**, mas o sistema **renova sozinho** enquanto o usuário está usando — ele não precisa fazer login de novo. Se ficar 1 dia sem mexer, aí sim precisa entrar novamente.

### 8. Aviso de mensalidade atrasada

Novo processo automático que, todos os dias, identifica assinantes com mensalidade vencida e marca a assinatura como "atrasada". Isso prepara o terreno para regras futuras (ex: bloquear agendamento de inadimplente).

---

## Modificado (melhorias em coisas existentes)

### 1. Painel da Plataforma (visão master)

A tela de gestão dos assinantes da plataforma (onde a empresa-mãe enxerga todas as barbearias contratantes) ganhou uma reforma grande:

- Mais informações em cada cliente.
- Histórico de pagamentos mais completo.
- Ações de gestão organizadas.

### 2. Webhook do Mercado Pago mais seguro

O endereço que o Mercado Pago chama para informar pagamentos passou a **validar uma assinatura criptográfica**. Antes, qualquer pessoa que descobrisse o endereço poderia enviar um "pagamento falso". Agora só requisições verdadeiramente vindas do MP são aceitas.

### 3. Configuração de no-show por barbearia

A automação de "marcar como faltou" antes era global e fixa. Agora cada barbearia configura o seu jeito — uma pode preferir 1 hora de tolerância, outra 4 horas, e uma terceira desligar completamente.

### 4. Padronização das tarefas automáticas (crons)

Todas as tarefas agendadas do sistema agora usam o **mesmo método de proteção** (chave secreta no cabeçalho). Isso evita que alguém de fora dispare essas tarefas indevidamente.

---

## Corrigido (problemas resolvidos)

### 1. Vazamento entre barbearias (10 vulnerabilidades de isolamento)

Foram identificados e corrigidos **10 pontos** onde, em tese, um administrador de uma barbearia poderia acessar dados de outra (agendamentos, barbeiros, clientes, comissões, assinaturas). Em todos esses pontos, o sistema agora exige que o dado consultado pertença à barbearia do usuário logado.

### 2. Token de sessão na URL

O sistema passava o token de login dentro da URL em alguns relatórios financeiros. URLs ficam gravadas em vários lugares (histórico do navegador, logs do servidor, cabeçalho de referência). Agora o token só vai pelo cabeçalho seguro da requisição.

### 3. Exclusão de cliente entre barbearias

Era possível, manipulando o endereço, deletar o cliente de outra barbearia. Agora o sistema confere se aquele cliente realmente pertence à barbearia de quem está pedindo a exclusão.

### 4. Busca de telefone vazava existência cross-barbearia

Ao cadastrar um cliente, o sistema verificava o telefone em **todas as barbearias**, o que poderia revelar se aquele número já era cliente de uma concorrente. A verificação agora é feita apenas dentro da própria barbearia.

### 5. Revogação de acesso administrativo demorava a fazer efeito

Se um administrador de plataforma fosse rebaixado, ele ainda podia agir como admin até o token expirar (até 7 dias). Agora, a cada requisição importante, o sistema **confere no banco** se a pessoa continua sendo admin. Revogação passou a ser imediata.

### 6. Tarefa automática antiga sem uso

Foi removida uma tarefa antiga ("check-bills") que não estava agendada, tinha login quebrado e enviava mensagens fictícias. Limpeza de código.

### 7. Erro 500 no login quando o cache estava fora

Em testes, descobriu-se que se o servidor de cache (usado pelo limite de tentativas) ficasse offline, o login retornava erro genérico. Foi ajustado para **liberar o login** nesse caso, em vez de bloquear todo mundo.

---

## Resumo em uma frase

O dia entregou um sistema mais **seguro** (10+ vulnerabilidades corrigidas, login com renovação automática e limite de tentativas), mais **automatizado** (cobrança recorrente, marcação de faltas, aviso de inadimplência), mais **completo** (descontos na comanda, exportação LGPD, gestão de cancelamentos) e mais **operável no dia a dia** (botões de reabrir/excluir/marcar faltou diretamente nas telas, sem precisar mexer no banco).

---

**Total de mudanças no dia:** 20 entregas implantadas em produção.
