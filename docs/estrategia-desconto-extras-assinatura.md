# Desconto em Serviços Extras para Assinantes de Plano
### Documento Estratégico — Para alinhamento com CEO

**Versão:** 1.0  
**Data:** 25/05/2026  
**Autor:** Produto & Engenharia  
**Status:** Em discussão — decisão pendente

---

## 1. Contexto e Origem

Durante uma análise de retenção e crescimento de planos de assinatura, surgiu a oportunidade de implementar um **desconto percentual sobre serviços extras** realizados por assinantes — ou seja, serviços que não estão cobertos pelo plano contratado.

**Exemplo prático:**  
O cliente é assinante do plano *Lord Cabelo* (inclui: corte de cabelo).  
Numa visita, ele decide também fazer a barba (não incluída no plano).  
O sistema oferece automaticamente um desconto de X% sobre o valor da barba.

---

## 2. O Problema que a Feature Resolve

| Dor | Impacto |
|-----|---------|
| Assinante percebe pouco valor adicional no plano | Cancelamento / churn |
| Dono da barbearia tem dificuldade em **vender** novos planos | Estagnação de MRR |
| Cliente avulso não tem incentivo para assinar | Baixa conversão |
| Barbeiro não vê diferença em atender assinante vs. avulso | Desmotivação com planos |

---

## 3. A Questão Central: **Quem absorve o desconto?**

Numa plataforma **mono-tenant** (um único negócio), a resposta seria simples: o dono absorve.

Numa plataforma **multi-tenant** como a nossa, existem **4 partes com interesses distintos**:

```
┌─────────────────────────────────────────────────────┐
│                   PLATAFORMA (SaaS)                 │
│         Quer: ↑ MRR, ↑ retenção, ↑ adoção planos   │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │   DONO DA BARBEARIA     │
          │   Quer: ↑ faturamento   │
          │   mas ↓ risco e esforço │
          └──────┬──────────┬───────┘
                 │          │
       ┌─────────▼──┐  ┌────▼──────────┐
       │  BARBEIRO  │  │    CLIENTE    │
       │  Quer:     │  │  Quer:        │
       │  ↑ comissão│  │  ↓ preço      │
       │  garantida │  │  + valor real │
       └────────────┘  └───────────────┘
```

Se o desconto sai **apenas do dono**, ele vai resistir a ativar a feature.  
Se o barbeiro sente que perde, ele **boicota os planos** nas conversas com clientes.  
Se o cliente não percebe valor, ele não assina — e o problema não é resolvido.

---

## 4. Os 3 Modelos Propostos

### 🔴 Modelo A — Dono absorve tudo *(modelo inicial discutido)*

```
Desconto: 20% sobre a barba (R$50 → R$40)
Quem paga: Dono perde R$10 de margem
Barbeiro: não muda (comissão calculada sobre R$50)
Plataforma: não muda
```

**Vantagem:** Simples de implementar.  
**Problema:** O dono não tem incentivo para ativar. Pode perceber como "perda sem contrapartida". Em barbearias com margens apertadas (comum no segmento), um desconto de 20% pode inviabilizar o mês.

---

### 🟡 Modelo B — Rateio entre Plataforma e Dono *(co-investimento)*

```
Desconto: 20% sobre a barba (R$50 → R$40)
Quem paga: Plataforma cobre 10% (R$5) + Dono cobre 10% (R$5)
Barbeiro: não muda (comissão calculada sobre R$50)
Plataforma: absorve como custo de crescimento (CAC/retenção)
```

**Vantagem:** O dono sente que a plataforma "investe junto". Aumenta percepção de valor da assinatura da plataforma.  
**Problema:** Requer contabilidade separada por atendimento extra. A plataforma precisa configurar sua taxa de co-participação por tier de contrato.  
**Quando usar:** Pode ser um **benefício exclusivo de contratos Premium** da plataforma — diferenciador para fechar barbearias maiores.

---

### 🟢 Modelo C — Desconto embutido no preço do plano *(auto-sustentável)*

```
Plano atual: R$80/mês → inclui: corte
Plano novo:  R$95/mês → inclui: corte + "20% off em extras"
Diferença de R$15 vai para um fundo de desconto gerenciado pela plataforma
```

O cliente paga mais pelo plano, mas percebe valor real em cada visita.  
A plataforma gerencia o fundo e garante que desconto oferecido ≤ fundo disponível.

**Vantagem:** Ninguém perde. O desconto é **pago pelo cliente com antecedência** através do plano mais caro. Barbeiro não perde. Dono não perde margem. Plataforma ganha em diferenciação.  
**Problema:** Exige que o dono reformule os planos. Comunicação mais complexa para o cliente entender o novo valor.

---

## 5. Recomendação de Produto

### Caminho sugerido: **Modelo A com proteção ao barbeiro + evolução para Modelo C**

**Fase 1 (MVP — rápido de implementar):**
- Campo `extraDiscount` (0–100%) no modelo `Plan`
- Desconto aplicado sobre o preço cobrado do cliente
- **Comissão do barbeiro calculada sobre o preço CHEIO** (não descontado)
- A diferença (desconto) é absorvida pelo dono como decisão de negócio
- Dono vê claramente no financeiro: "Descontos dados este mês: R$ X"

**Por que proteger o barbeiro primeiro:**  
O barbeiro é o principal ponto de contato com o cliente. Se ele sentir que perde, ele vai — conscientemente ou não — desincentivar o cliente de assinar planos. **O barbeiro precisa ser aliado da feature, não adversário.**

**Fase 2 (Crescimento):**
- Criar planos com tier "Premium" que incluem desconto em extras
- A plataforma co-participa do desconto para contratos acima de X barbearias (Modelo B)
- Dashboard do dono mostra ROI: "Você deu R$X de desconto → reteve Y assinantes → gerou R$Z a mais de MRR"

---

## 6. Impacto nos Barbeiros — O Argumento Definitivo

> **A preocupação do barbeiro é real mas baseada em percepção, não em matemática.**

| Cenário | Cliente Avulso | Cliente Assinante (com desconto extra) |
|---------|---------------|----------------------------------------|
| Frequência mensal | 1x | 2–3x |
| Valor por visita (barba) | R$50 | R$40 (com 20% off) |
| Comissão por visita (50%) | R$25 | R$25 *(protegida — calculada sobre R$50)* |
| **Comissão total no mês** | **R$25** | **R$50–R$75** |

O assinante com desconto **vale 2–3x mais por mês** para o barbeiro do que um cliente avulso.

**Material de comunicação sugerido para donos explicarem aos barbeiros:**
> *"O desconto não sai do seu bolso — sua comissão é calculada sempre sobre o preço cheio.  
> E o cliente que economiza nas extras volta mais vezes.  
> Hoje você tem 20 clientes de plano. Se cada um vier 2x por mês, são 40 atendimentos garantidos."*

---

## 7. Implicações Técnicas (Resumo)

| O que muda | Complexidade |
|-----------|-------------|
| Campo `extraDiscount` no model `Plan` (Prisma) | Baixa |
| UI de criação/edição de plano (Admin) | Baixa |
| Cálculo no modal de confirmação do barbeiro | Média |
| Exibir preço original riscado + preço com desconto | Baixa |
| Comissão do barbeiro calculada sobre preço cheio (campo `extraBasePrice`) | Média |
| Relatório financeiro: "Total de descontos concedidos no mês" | Média |
| WhatsApp pós-atendimento: "Você economizou R$ X hoje" | Baixa |
| Modelo C (fundo de desconto embutido no plano) | Alta |

---

## 8. Perguntas para o CEO

1. **Modelo de negócio da plataforma:** A plataforma quer co-investir no desconto como diferencial competitivo (Modelo B), ou deixar 100% na decisão do dono (Modelo A)?

2. **Segmentação por tier:** O desconto pode ser um benefício exclusivo de contratos Premium da plataforma? (Ex: plano Basic → Modelo A; plano Pro → Modelo B com co-participação)

3. **Prioridade de curto prazo:** O gargalo hoje é **adquirir** novos assinantes para os donos, ou **reter** quem já assinou? A resposta define qual sprint priorizar.

4. **Comunicação:** A plataforma quer criar um material de apoio para os donos comunicarem o benefício aos barbeiros, ou deixa para cada barbearia se virar?

---

## 9. Próximos Passos

- [ ] CEO define o modelo (A, B ou C)
- [ ] Produto especifica o sprint 1 com base na decisão
- [ ] Engenharia estima o esforço técnico do modelo escolhido
- [ ] Criar script de comunicação para donos → barbeiros
- [ ] Definir métricas de sucesso: `↑ uses/assinante/mês`, `↓ churn de planos`, `↑ ticket médio por assinante`

---

*Documento gerado para alinhamento estratégico. Não representa decisão técnica final.*
