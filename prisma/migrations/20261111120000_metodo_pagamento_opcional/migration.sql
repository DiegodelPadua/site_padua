-- Permite aguardar a escolha do meio de pagamento no Mercado Pago.
-- Mantém os valores PIX e CARTAO dos registros existentes.
ALTER TABLE `pagamentos`
MODIFY `metodo` ENUM('PIX', 'CARTAO') NULL;