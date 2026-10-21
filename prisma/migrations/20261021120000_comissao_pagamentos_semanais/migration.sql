-- Avulsos passam a ser pagos por semana: o mesmo profissional pode ter vários
-- pagamentos de comissão no mesmo mês. Sai a trava de "um pagamento por mês e tipo".
ALTER TABLE "CommissionPayment" DROP CONSTRAINT IF EXISTS "CommissionPayment_barberId_month_type_key";
DROP INDEX IF EXISTS "CommissionPayment_barberId_month_type_key";
CREATE INDEX IF NOT EXISTS "CommissionPayment_barberId_month_type_idx" ON "CommissionPayment"("barberId", "month", "type");
