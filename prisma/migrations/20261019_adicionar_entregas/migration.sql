-- CreateTable
CREATE TABLE `entregas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedidoId` INTEGER NOT NULL,
    `transportadora` VARCHAR(100) NULL,
    `modalidadeFrete` VARCHAR(100) NULL,
    `codigoRastreamento` VARCHAR(150) NULL,
    `urlRastreamento` VARCHAR(1000) NULL,
    `status` ENUM('PENDENTE', 'PREPARANDO', 'POSTADO', 'EM_TRANSITO', 'SAIU_PARA_ENTREGA', 'ENTREGUE', 'FALHA_ENTREGA', 'DEVOLVIDO', 'CANCELADO') NOT NULL DEFAULT 'PENDENTE',
    `previsaoEntrega` DATETIME(3) NULL,
    `dataPostagem` DATETIME(3) NULL,
    `dataEntrega` DATETIME(3) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,

    UNIQUE INDEX `entregas_pedidoId_key`(`pedidoId`),
    INDEX `entregas_status_idx`(`status`),
    INDEX `entregas_codigoRastreamento_idx`(`codigoRastreamento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `entregas` ADD CONSTRAINT `entregas_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

