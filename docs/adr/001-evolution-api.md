# ADR-001: Evolution API como gateway WhatsApp

**Data:** 2026-05-30  
**Status:** Aceito  
**Autores:** João Costa (Dev)

---

## Contexto

O IaDeBarbearia precisa enviar e receber mensagens WhatsApp em nome de cada barbearia cadastrada. As barbearias já usam WhatsApp pessoal ou Business para se comunicar com clientes — a expectativa é que o sistema se integre ao mesmo número, sem exigir migração.

Existem três caminhos principais para integração com WhatsApp:

| Opção | Modelo | Custo | Tempo de setup |
|---|---|---|---|
| **WhatsApp Business API (Meta/Cloud)** | API oficial, hospedada pela Meta | US$ 0,05–0,08 por conversa iniciada pela empresa (+ aprovação de templates) | Semanas (verificação de empresa, aprovação WABA) |
| **BSP (Business Solution Provider)** | Revendedor oficial (360dialog, Twilio, etc.) | Taxa mensal + custo por mensagem | Dias a semanas, depende do BSP |
| **Evolution API (self-hosted)** | Automação do WhatsApp Web via multi-device | Custo fixo de VPS (~R$ 100–200/mês total) | Horas (docker + QR scan) |

---

## Decisão

Usar **Evolution API** self-hosted no VPS como gateway WhatsApp para todas as barbearias.

Cada barbearia conecta seu número escaneando um QR Code dentro do painel do CRM. A instância é criada via `POST /instance/create` na Evolution API, com webhook configurado para o N8N (`https://n8n.joaocostaestrategiaeads.com.br/webhook/evolution-webhook`).

---

## Motivos

**1. Custo zero por mensagem**  
A API oficial cobra por conversa iniciada pela empresa (lembretes, confirmações). Com a base atual de barbearias enviando lembretes diários para todos os clientes, o custo mensal na API oficial seria proibitivo antes de atingir escala suficiente para absorvê-lo.

**2. Setup em minutos, sem burocracia**  
A API oficial exige conta Meta Business verificada, aprovação de templates (processo que leva dias e pode ser rejeitado), e verificação da empresa. Evolution API funciona com QR scan — o próprio dono da barbearia conecta em segundos dentro do painel.

**3. Sem restrição de templates**  
A API oficial exige que toda mensagem proativa use um template pré-aprovado pela Meta. Evolution API permite envio de texto livre, o que viabiliza as mensagens personalizadas de retenção de clientes (geradas por IA, conteúdo variável por cliente).

**4. Multi-instância por barbearia**  
Cada barbearia tem sua própria instância Evolution com seu próprio número. O cliente recebe a mensagem do número que já conhece, não de um número genérico da plataforma.

---

## Consequências e riscos

**Risco operacional — dependência do VPS:**  
Se o VPS cair, nenhuma barbearia envia/recebe WhatsApp. Mitigação atual: monitoramento via cron health dashboard. Gatilho de revisão: primeiro incidente que cause perda de receita de cliente pagante.

**Risco de ToS:**  
Evolution API opera em zona cinzenta dos Termos de Uso do WhatsApp. A Meta pode banir números que detectar como automatizados. Risco baixo em volumes normais de uso (lembretes, confirmações), mas real se volume escalar muito.

**Ponto de migração futuro (ADR-001-rev):**  
Reavaliar migração para API oficial (via 360dialog ou similar) quando: (a) MRR cobrir o custo por mensagem + margem, ou (b) ocorrer primeiro incidente de ban de número de cliente.

---

## Alternativas rejeitadas

**WhatsApp Business API oficial direta:** Descartada pelo custo e burocracia no estágio atual. Correta para escala enterprise, prematura agora.

**360dialog / Twilio para WhatsApp:** Descartada pelo mesmo motivo de custo. Adiciona complexidade de integração sem benefício operacional imediato.
