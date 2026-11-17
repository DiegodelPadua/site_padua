import {
  ReposicaoError,
  consultarReposicaoNoBanco,
  reporEstoqueNoBanco,
} from "../repositories/reposicaoEstoqueRepository";

export { ReposicaoError };

function validarId(id: number) {
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    throw new ReposicaoError(
      "Identificação inválida.",
      400
    );
  }
}

export async function consultarReposicao(
  pedidoId: number
) {
  validarId(pedidoId);

  return consultarReposicaoNoBanco(
    pedidoId
  );
}

export async function confirmarReposicao(
  pedidoId: number,
  administradorId: number,
  origem: unknown,
  observacao: unknown,
  conferido: unknown
) {
  validarId(pedidoId);
  validarId(administradorId);

  if (
    (
      origem !== "NAO_ENVIADO" &&
      origem !== "DEVOLVIDO"
    ) ||
    conferido !== true ||
    typeof observacao !== "string" ||
    observacao.trim().length < 10 ||
    observacao.trim().length > 1000
  ) {
    throw new ReposicaoError(
      "Confirme a conferência física e descreva a reposição com 10 a 1.000 caracteres.",
      400
    );
  }

  return reporEstoqueNoBanco(
    pedidoId,
    administradorId,
    origem,
    observacao.trim()
  );
}