ALTER TABLE `reembolsos_cancelamento`
    ADD COLUMN `estoqueConferidoPorId` INTEGER NULL,
    ADD COLUMN `estoqueRepostoEm` DATETIME(3) NULL,
    ADD COLUMN `observacaoEstoque` VARCHAR(1000) NULL,
    ADD COLUMN `origemReposicao` VARCHAR(30) NULL;