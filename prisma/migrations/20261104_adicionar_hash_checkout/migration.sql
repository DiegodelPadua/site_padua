-- Armazena o SHA-256 dos dados da tentativa de checkout.
-- A coluna aceita NULL para preservar os pedidos antigos.
ALTER TABLE `pedidos`
ADD COLUMN `hashCheckout` VARCHAR(64) NULL;