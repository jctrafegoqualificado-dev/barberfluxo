# Migrations

## Por que existe um `0_baseline`

Até setembro/2026 o histórico de migrations estava desencontrado nas duas direções:

- Três migrations constavam como aplicadas no banco (`20260510052744_init`,
  `20260514010026_saas_plan_and_whatsapp_multitenant`,
  `20260514194014_add_appointment_services_multi`), mas as pastas delas não
  existiam mais no repositório.
- Duas migrations existiam no repositório sem registro no banco, porque o SQL
  foi aplicado à mão pelo editor do Supabase — que não escreve em
  `_prisma_migrations`.

Nada disso quebrava produção: o banco estava correto e o build não roda
`migrate deploy`. O risco era reconstruir o banco do zero — ambiente novo,
troca de servidor, recuperação — sem ter as receitas completas.

`0_baseline` é o schema inteiro gerado a partir do banco real, conferido com
`prisma migrate diff` (resultado: zero diferenças). Com ele o repositório voltou
a conseguir levantar o banco do zero sozinho.

As três linhas órfãs foram mantidas de propósito: são registros históricos
inofensivos e apagá-las significaria mexer em dado de produção sem necessidade.

## Como aplicar uma migration nova

Prefira o caminho do Prisma, que já carimba o registro:

```bash
npx prisma migrate deploy
```

Se por algum motivo o SQL for aplicado à mão pelo editor do Supabase, **carimbe
em seguida** para o histórico não desencontrar de novo:

```bash
npx prisma migrate resolve --applied <nome_da_pasta_da_migration>
```

Para conferir a qualquer momento se repositório e banco estão alinhados:

```bash
npx prisma migrate status
```
