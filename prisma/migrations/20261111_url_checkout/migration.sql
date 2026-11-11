-- Guarda o link recebido na criação da Order.
-- Os pagamentos existentes permanecem com checkoutUrl vazio.
ALTER TABLE `pagamentos`
ADD COLUMN `checkoutUrl` TEXT NULL;