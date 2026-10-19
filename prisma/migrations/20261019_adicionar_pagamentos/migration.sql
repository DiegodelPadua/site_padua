-- CreateTable
CREATE TABLE `pagamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedidoId` INTEGER NOT NULL,
    `metodo` ENUM('PIX', 'CARTAO') NOT NULL,
    `status` ENUM('PENDENTE', 'PROCESSANDO', 'APROVADO', 'RECUSADO', 'CANCELADO', 'EXPIRADO', 'ESTORNADO') NOT NULL DEFAULT 'PENDENTE',
    `valor` DECIMAL(10, 2) NOT NULL,
    `identificadorExterno` VARCHAR(191) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `pagoEm` DATETIME(3) NULL,

    INDEX `pagamentos_pedidoId_idx`(`pedidoId`),
    INDEX `pagamentos_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transacoes_pagamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pagamentoId` INTEGER NOT NULL,
    `tipo` VARCHAR(50) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `identificadorExterno` VARCHAR(191) NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `transacoes_pagamento_pagamentoId_idx`(`pagamentoId`),
    INDEX `transacoes_pagamento_identificadorExterno_idx`(`identificadorExterno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `pedidos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transacoes_pagamento` ADD CONSTRAINT `transacoes_pagamento_pagamentoId_fkey` FOREIGN KEY (`pagamentoId`) REFERENCES `pagamentos`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

