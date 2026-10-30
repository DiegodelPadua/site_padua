-- AlterTable
ALTER TABLE `entregas` ADD COLUMN `melhorEnvioId` VARCHAR(150) NULL;

-- CreateTable
CREATE TABLE `historico_pedidos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedidoId` INTEGER NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `descricao` VARCHAR(255) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `historico_pedidos_pedidoId_criadoEm_idx`(`pedidoId`, `criadoEm`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `entregas_melhorEnvioId_key` ON `entregas`(`melhorEnvioId`);

-- AddForeignKey
ALTER TABLE `historico_pedidos` ADD CONSTRAINT `historico_pedidos_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
