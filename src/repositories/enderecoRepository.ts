
import { prisma } from "../../lib/prisma";

/* =========================================================
   REPOSITORY DE ENDEREÇOS - PÁDUA CULTURE
   =========================================================
   Responsável exclusivamente pelas operações de banco
   de dados relacionadas aos endereços dos clientes.
   ========================================================= */

export type DadosEndereco = {
  apelido?: string | null;
  destinatario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  principal?: boolean;
};

/* Lista somente os endereços do usuário autenticado. */
export async function listarEnderecosPorUsuario(usuarioId: number) {
  return prisma.endereco.findMany({
    where: { usuarioId },
    orderBy: [
      { principal: "desc" },
      { criadoEm: "desc" },
    ],
  });
}

/* Consulta um endereço, verificando também seu proprietário. */
export async function buscarEnderecoDoUsuario(
  enderecoId: number,
  usuarioId: number
) {
  return prisma.endereco.findFirst({
    where: {
      id: enderecoId,
      usuarioId,
    },
  });
}

/* Cadastra um endereço associado ao usuário autenticado. */
export async function criarEndereco(
  usuarioId: number,
  dados: DadosEndereco
) {
  return prisma.endereco.create({
    data: {
      usuarioId,
      ...dados,
    },
  });
}

/* Atualiza apenas endereços pertencentes ao usuário. */
export async function atualizarEndereco(
  enderecoId: number,
  usuarioId: number,
  dados: Partial<DadosEndereco>
) {
  return prisma.endereco.updateMany({
    where: {
      id: enderecoId,
      usuarioId,
    },
    data: dados,
  });
}

/* Exclui apenas endereços pertencentes ao usuário. */
export async function excluirEndereco(
  enderecoId: number,
  usuarioId: number
) {
  return prisma.endereco.deleteMany({
    where: {
      id: enderecoId,
      usuarioId,
    },
  });
}


/* =========================================================
   CADASTRAR ENDEREÇO COM CONTROLE TRANSACIONAL
   =========================================================

   OBJETIVO:
   Garantir que somente o primeiro endereço cadastrado
   seja definido automaticamente como principal.

   ESTRATÉGIA:
   1. Iniciar uma transação no MySQL.
   2. Bloquear a linha do usuário durante o cadastro.
   3. Verificar se já existe endereço principal.
   4. Cadastrar o novo endereço.
   5. Finalizar a transação.

   O bloqueio na tabela usuarios evita que dois cadastros
   simultâneos do mesmo cliente sejam processados juntos.
   ========================================================= */

export async function criarEnderecoComTransacao(
  usuarioId: number,
  dados: DadosEndereco
) {
  return prisma.$transaction(async (tx) => {

    /* -----------------------------------------------------
       BLOQUEAR O REGISTRO DO USUÁRIO
       -----------------------------------------------------

       SELECT ... FOR UPDATE impede que outra transação
       que utilize o mesmo bloqueio prossiga até que a
       transação atual seja concluída.
    */

    const usuarios = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM usuarios
      WHERE id = ${usuarioId}
      FOR UPDATE
    `;

    // Não permite cadastro para um usuário inexistente.
    if (usuarios.length === 0) {
      throw new Error("Usuário não encontrado.");
    }

    /* -----------------------------------------------------
       VERIFICAR ENDEREÇOS EXISTENTES
       ----------------------------------------------------- */

    const quantidade = await tx.endereco.count({
      where: {
        usuarioId,
      },
    });

    /* -----------------------------------------------------
       CADASTRAR O ENDEREÇO
       -----------------------------------------------------

       O primeiro endereço será principal.

       Os demais serão cadastrados como secundários.
       Não confiamos no valor de principal enviado pelo
       navegador.
    */

    const endereco = await tx.endereco.create({
      data: {
        ...dados,
        usuarioId,
        principal: quantidade === 0,
      },
    });

    return endereco;
  });
}
