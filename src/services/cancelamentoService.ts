import {
  CancelamentoError,
  consultarCancelamentoDoCliente,
  registrarSolicitacaoCancelamento,
} from "../repositories/cancelamentoRepository";

export { CancelamentoError };

function validarIdentificacao(
  pedidoId: number,
  usuarioId: number
) {
  if (
    ![pedidoId, usuarioId].every(
      (id) =>
        Number.isSafeInteger(id) &&
        id > 0 &&
        id <= 2147483647
    )
  ) {
    throw new CancelamentoError(
      "Identificação inválida.",
      400
    );
  }
}

export async function consultarSolicitacaoDoCliente(
  pedidoId: number,
  usuarioId: number
) {
  validarIdentificacao(pedidoId, usuarioId);

  return consultarCancelamentoDoCliente(
    pedidoId,
    usuarioId
  );
}

export async function solicitarCancelamentoDoCliente(
  pedidoId: number,
  usuarioId: number,
  motivo: unknown
) {
  validarIdentificacao(pedidoId, usuarioId);

  if (
    typeof motivo !== "string" ||
    motivo.trim().length < 10 ||
    motivo.trim().length > 1000
  ) {
    throw new CancelamentoError(
      "Descreva o motivo com 10 a 1.000 caracteres.",
      400
    );
  }

  return registrarSolicitacaoCancelamento(
    pedidoId,
    usuarioId,
    motivo.trim()
  );
}