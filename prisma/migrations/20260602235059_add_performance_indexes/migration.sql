-- Performance: índices em FK e campos de filtro frequente

-- Barber: listagem por barbearia e filtragem por ativo
CREATE INDEX IF NOT EXISTS "Barber_barbershopId_idx" ON "Barber"("barbershopId");
CREATE INDEX IF NOT EXISTS "Barber_barbershopId_active_idx" ON "Barber"("barbershopId", "active");

-- Service: listagem por barbearia e filtragem por ativo
CREATE INDEX IF NOT EXISTS "Service_barbershopId_idx" ON "Service"("barbershopId");
CREATE INDEX IF NOT EXISTS "Service_barbershopId_active_idx" ON "Service"("barbershopId", "active");

-- Plan: listagem de planos por barbearia
CREATE INDEX IF NOT EXISTS "Plan_barbershopId_idx" ON "Plan"("barbershopId");
CREATE INDEX IF NOT EXISTS "Plan_barbershopId_active_idx" ON "Plan"("barbershopId", "active");

-- Product: listagem por barbearia e filtragem por ativo
CREATE INDEX IF NOT EXISTS "Product_barbershopId_idx" ON "Product"("barbershopId");
CREATE INDEX IF NOT EXISTS "Product_barbershopId_active_idx" ON "Product"("barbershopId", "active");

-- Subscription: busca por cliente (histórico, cancelamento)
CREATE INDEX IF NOT EXISTS "Subscription_clientId_idx" ON "Subscription"("clientId");

-- Payment: relatórios financeiros por barbearia, status e data
CREATE INDEX IF NOT EXISTS "Payment_barbershopId_status_createdAt_idx" ON "Payment"("barbershopId", "status", "createdAt");

-- ProductSale: comissões por barbeiro dentro de uma barbearia
CREATE INDEX IF NOT EXISTS "ProductSale_barbershopId_barberId_idx" ON "ProductSale"("barbershopId", "barberId");

-- CommissionPayment: relatório de comissões por mês e por barbeiro
CREATE INDEX IF NOT EXISTS "CommissionPayment_barbershopId_month_idx" ON "CommissionPayment"("barbershopId", "month");
CREATE INDEX IF NOT EXISTS "CommissionPayment_barbershopId_barberId_month_idx" ON "CommissionPayment"("barbershopId", "barberId", "month");

-- CommissionVale: vales por barbeiro e mês
CREATE INDEX IF NOT EXISTS "CommissionVale_barbershopId_barberId_month_idx" ON "CommissionVale"("barbershopId", "barberId", "month");

-- Meta: metas por barbearia e por barbeiro
CREATE INDEX IF NOT EXISTS "Meta_barbershopId_idx" ON "Meta"("barbershopId");
CREATE INDEX IF NOT EXISTS "Meta_barbershopId_barberId_idx" ON "Meta"("barbershopId", "barberId");

-- ScheduleBlock: bloqueios de agenda por barbeiro e data
CREATE INDEX IF NOT EXISTS "ScheduleBlock_barberId_date_idx" ON "ScheduleBlock"("barberId", "date");

-- Task: tarefas por status e por barbeiro dentro da barbearia
CREATE INDEX IF NOT EXISTS "Task_barbershopId_status_idx" ON "Task"("barbershopId", "status");
CREATE INDEX IF NOT EXISTS "Task_barbershopId_barberId_idx" ON "Task"("barbershopId", "barberId");

-- Review: avaliações por barbeiro (NPS por profissional)
CREATE INDEX IF NOT EXISTS "Review_barbershopId_barberId_idx" ON "Review"("barbershopId", "barberId");

-- LoyaltyPoint: pontos por cliente e por data (extrato, dashboard fidelidade)
CREATE INDEX IF NOT EXISTS "LoyaltyPoint_barbershopId_clientId_idx" ON "LoyaltyPoint"("barbershopId", "clientId");
CREATE INDEX IF NOT EXISTS "LoyaltyPoint_barbershopId_createdAt_idx" ON "LoyaltyPoint"("barbershopId", "createdAt");

-- CashFlowEntry: entradas por sessão de caixa
CREATE INDEX IF NOT EXISTS "CashFlowEntry_sessionId_idx" ON "CashFlowEntry"("sessionId");
