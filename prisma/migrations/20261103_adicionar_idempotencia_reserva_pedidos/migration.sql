-- AlterTable
ALTER TABLE `pagamentos` ADD COLUMN `chaveIdempotencia` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `pedidos` ADD COLUMN `chaveIdempotencia` VARCHAR(100) NULL,
    ADD COLUMN `reservaExpiraEm` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `pagamentos_chaveIdempotencia_key` ON `pagamentos`(`chaveIdempotencia`);

-- CreateIndex
CREATE UNIQUE INDEX `pedidos_chaveIdempotencia_key` ON `pedidos`(`chaveIdempotencia`);

