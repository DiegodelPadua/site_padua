-- CreateTable
CREATE TABLE `movimentacoes_estoque` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `varianteId` INTEGER NOT NULL,
    `pedidoId` INTEGER NULL,
    `tipo` ENUM('ENTRADA', 'SAIDA', 'RESERVA', 'LIBERACAO_RESERVA', 'AJUSTE') NOT NULL,
    `quantidade` INTEGER NOT NULL,
    `motivo` VARCHAR(255) NULL,
    `saldoAnterior` INTEGER NOT NULL,
    `saldoPosterior` INTEGER NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `movimentacoes_estoque_varianteId_criadoEm_idx`(`varianteId`, `criadoEm`),
    INDEX `movimentacoes_estoque_pedidoId_idx`(`pedidoId`),
    INDEX `movimentacoes_estoque_tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `movimentacoes_estoque` ADD CONSTRAINT `movimentacoes_estoque_varianteId_fkey` FOREIGN KEY (`varianteId`) REFERENCES `variantes_produto`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimentacoes_estoque` ADD CONSTRAINT `movimentacoes_estoque_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

