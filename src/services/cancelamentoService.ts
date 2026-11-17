import {
  CancelamentoError,
  consultarCancelamentoDoCliente,
  registrarSolicitacaoCancelamento,
  listarCancelamentosDosPedidos,
  registrarAnaliseCancelamento,
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
export async function listarSolicitacoesAdministrativas(
  pedidoIds: number[]
) {
  if (
    !Array.isArray(pedidoIds) ||
    pedidoIds.length > 20 ||
    pedidoIds.some(
      (id) =>
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        id > 2147483647
    )
  ) {
    throw new CancelamentoError(
      "Lista de pedidos inválida.",
      400
    );
  }

  const pedidos = await listarCancelamentosDosPedidos(
    [...new Set(pedidoIds)]
  );

  return pedidos.flatMap((pedido) =>
    pedido.solicitacoesCancelamento.map((item) => ({
      id: item.id,
      pedidoId: pedido.id,
      status: item.status,
      motivo: item.motivo,
      respostaAdmin: item.respostaAdmin,
      administradorNome:
        item.administrador?.nome ?? null,
      criadoEm: item.criadoEm.toISOString(),
      atualizadoEm: item.atualizadoEm.toISOString(),
      analisadoEm:
        item.analisadoEm?.toISOString() ?? null,
      situacaoPedido: pedido.status,
      situacaoEntrega:
        pedido.entrega?.status ?? null,
      codigoRastreamento:
        pedido.entrega?.codigoRastreamento ?? null,
    }))
  );
}

export async function analisarSolicitacaoComoAdministrador(
  solicitacaoId: number,
  administradorId: number,
  acao: unknown,
  statusEsperado: unknown,
  resposta: unknown
) {
  validarIdentificacao(
    solicitacaoId,
    administradorId
  );

  if (
    acao !== "iniciar" &&
    acao !== "aprovar" &&
    acao !== "recusar"
  ) {
    throw new CancelamentoError(
      "Ação inválida.",
      400
    );
  }

  if (
    (
      statusEsperado !== "SOLICITADA" &&
      statusEsperado !== "EM_ANALISE"
    ) ||
    statusEsperado !== (
      acao === "iniciar"
        ? "SOLICITADA"
        : "EM_ANALISE"
    )
  ) {
    throw new CancelamentoError(
      "Situação inicial inválida para esta ação.",
      400
    );
  }

  if (
    typeof resposta !== "string" ||
    resposta.trim().length > 1000 ||
    (
      acao !== "iniciar" &&
      resposta.trim().length < 10
    ) ||
    (
      acao === "iniciar" &&
      resposta.trim().length !== 0
    )
  ) {
    throw new CancelamentoError(
      "Para aprovar ou recusar, escreva uma resposta ao cliente com 10 a 1.000 caracteres.",
      400
    );
  }

  return registrarAnaliseCancelamento(
    solicitacaoId,
    administradorId,
    acao,
    statusEsperado,
    acao === "iniciar" ? null : resposta.trim()
  );
}