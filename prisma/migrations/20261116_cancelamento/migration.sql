-- Criar a tabela de solicitações de cancelamento.
CREATE TABLE `solicitacoes_cancelamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedidoId` INTEGER NOT NULL,
    `status` ENUM(
        'SOLICITADA',
        'EM_ANALISE',
        'RECUSADA',
        'APROVADA_PARA_REEMBOLSO'
    ) NOT NULL DEFAULT 'SOLICITADA',
    `motivo` VARCHAR(1000) NOT NULL,
    `respostaAdmin` VARCHAR(1000) NULL,
    `administradorId` INTEGER NULL,
    `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizadoEm` DATETIME(3) NOT NULL,
    `analisadoEm` DATETIME(3) NULL,

    INDEX `solicitacoes_cancelamento_pedidoId_criadoEm_idx`
        (`pedidoId`, `criadoEm`),

    INDEX `solicitacoes_cancelamento_status_criadoEm_idx`
        (`status`, `criadoEm`),

    INDEX `solicitacoes_cancelamento_administradorId_idx`
        (`administradorId`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Vincular cada solicitação ao pedido.
ALTER TABLE `solicitacoes_cancelamento`
ADD CONSTRAINT `solicitacoes_cancelamento_pedidoId_fkey`
FOREIGN KEY (`pedidoId`)
REFERENCES `pedidos`(`id`)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Vincular a análise ao administrador responsável.
ALTER TABLE `solicitacoes_cancelamento`
ADD CONSTRAINT `solicitacoes_cancelamento_administradorId_fkey`
FOREIGN KEY (`administradorId`)
REFERENCES `usuarios`(`id`)
ON DELETE RESTRICT
ON UPDATE CASCADE;