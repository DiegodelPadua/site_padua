CREATE TABLE `reembolsos_cancelamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitacaoId` INTEGER NOT NULL,
    `pagamentoId` INTEGER NOT NULL,
    `administradorId` INTEGER NOT NULL,
    `chaveIdempotencia` VARCHAR(100) NOT NULL,
    `orderId` VARCHAR(120) NOT NULL,
    `transacaoId` VARCHAR(150) NOT NULL,
    `vendedorId` VARCHAR(50) NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `status` ENUM(
        'CONSULTA_NECESSARIA',
        'CONFIRMADO'
    ) NOT NULL DEFAULT 'CONSULTA_NECESSARIA',
    `identificadorExterno` VARCHAR(150) NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmadoEm` DATETIME(3) NULL,

    UNIQUE INDEX `reembolsos_cancelamento_solicitacaoId_key` (`solicitacaoId`),
    UNIQUE INDEX `reembolsos_cancelamento_pagamentoId_key` (`pagamentoId`),
    UNIQUE INDEX `reembolsos_cancelamento_chaveIdempotencia_key` (`chaveIdempotencia`),
    UNIQUE INDEX `reembolsos_cancelamento_identificadorExterno_key` (`identificadorExterno`),
    INDEX `reembolsos_cancelamento_status_criadoEm_idx` (`status`, `criadoEm`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `reembolsos_cancelamento`
ADD CONSTRAINT `reembolsos_cancelamento_solicitacaoId_fkey`
FOREIGN KEY (`solicitacaoId`)
REFERENCES `solicitacoes_cancelamento` (`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `reembolsos_cancelamento`
ADD CONSTRAINT `reembolsos_cancelamento_pagamentoId_fkey`
FOREIGN KEY (`pagamentoId`)
REFERENCES `pagamentos` (`id`)
ON DELETE RESTRICT ON UPDATE CASCADE;