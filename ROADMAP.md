# Roadmap — BarberApp

## Backlog

Sem itens pendentes no momento.

---

## Concluído

- [x] Drag & drop na agenda do admin (mover agendamento entre barbeiros e horários)
- [x] Toggle "Em Férias" no card do barbeiro (painel admin)
- [x] Vender produto avulso no fluxo de caixa
- [x] Drag & drop na agenda do barbeiro (mover horário, single-column)
- [x] Clicar em slot vazio na agenda do barbeiro abre modal pré-preenchido com o horário
- [x] **[P1] Dia de vencimento nas assinaturas** — campo `billingDay` no schema; cálculo de data com clamp por mês; badge "todo dia X" na tabela e extrato; select no modal de cadastro/edição
- [x] **[P2] Barbeiro pode cadastrar assinante** — POST `/subscriptions` aceita role BARBER; nova página `/barbeiro/assinaturas` com cards e modal de cadastro
- [x] **[P3] Autocomplete de cliente no agendamento** — endpoint `GET /api/barbershop/clients`; busca debounced por nome/telefone nos modais do admin e do barbeiro; seleção preenche nome e telefone automaticamente
