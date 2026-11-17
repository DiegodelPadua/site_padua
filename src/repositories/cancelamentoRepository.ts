import { prisma } from "../../lib/prisma";

import {
  StatusPagamento,
  StatusSolicitacaoCancelamento,
} from "@prisma/client";

export class CancelamentoError extends Error {
  constructor(
    mensagem: string,
    public readonly status: number = 409
  ) {
    super(mensagem);
    this.name = "CancelamentoError";
  }
}

const abertas = [
  StatusSolicitacaoCancelamento.SOLICITADA,
  StatusSolicitacaoCancelamento.EM_ANALISE,
  StatusSolicitacaoCancelamento.APROVADA_PARA_REEMBOLSO,
];

const campos = {
  id: true,
  status: true,
  motivo: true,
  respostaAdmin: true,
  criadoEm: true,
  analisadoEm: true,
} as const;

export async function consultarCancelamentoDoCliente(
  pedidoId: number,
  usuarioId: number
) {
  const pedido = await prisma.pedido.findFirst({
    where: {
      id: pedidoId,
      usuarioId,
    },
    select: {
      pagamentos: {
        where: {
          status: StatusPagamento.APROVADO,
        },
        take: 1,
        select: { id: true },
      },

      solicitacoesCancelamento: {
        orderBy: { id: "desc" },
        take: 1,
        select: campos,
      },
    },
  });

  if (!pedido) {
    throw new CancelamentoError(
      "Pedido não encontrado para este cliente.",
      404
    );
  }

  const solicitacao =
    pedido.solicitacoesCancelamento[0] ?? null;

  return {
    pedidoId,
    podeSolicitar:
      pedido.pagamentos.length > 0 &&
      (
        !solicitacao ||
        solicitacao.status ===
          StatusSolicitacaoCancelamento.RECUSADA
      ),
    solicitacao,
  };
}

export async function registrarSolicitacaoCancelamento(
  pedidoId: number,
  usuarioId: number,
  motivo: string
) {
  return prisma.$transaction(async (tx) => {
    // Serializa envios de outras abas e confere o proprietário.
    const linhas = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM pedidos
      WHERE id = ${pedidoId} AND usuarioId = ${usuarioId}
      FOR UPDATE
    `;

    if (linhas.length !== 1) {
      throw new CancelamentoError(
        "Pedido não encontrado para este cliente.",
        404
      );
    }

    const existente =
      await tx.solicitacaoCancelamento.findFirst({
        where: {
          pedidoId,
          status: { in: abertas },
        },
        orderBy: { id: "desc" },
        select: campos,
      });

    // Reenvio preserva a solicitação e o motivo originais.
    if (existente) {
      return {
        pedidoId,
        solicitacao: existente,
        jaExistia: true,
      };
    }

    const pedido = await tx.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      select: {
        status: true,
        pagamentos: {
          where: {
            status: StatusPagamento.APROVADO,
          },
          take: 1,
          select: { id: true },
        },
      },
    });

    if (pedido.pagamentos.length === 0) {
      throw new CancelamentoError(
        "Não há pagamento aprovado registrado para esta solicitação."
      );
    }

    const solicitacao =
      await tx.solicitacaoCancelamento.create({
        data: {
          pedidoId,
          motivo,
          status:
            StatusSolicitacaoCancelamento.SOLICITADA,
        },
        select: campos,
      });

    await tx.historicoPedido.create({
      data: {
        pedidoId,
        status: pedido.status,
        descricao:
          `Solicitação de cancelamento #${solicitacao.id} registrada pelo cliente #${usuarioId}. Aguardando análise; pedido e pagamento mantidos.`,
      },
    });

    return {
      pedidoId,
      solicitacao,
      jaExistia: false,
    };
  });
}

/* A página deve verificar o administrador antes desta consulta. */
export async function listarCancelamentosDosPedidos(
  pedidoIds: number[]
) {
  if (pedidoIds.length === 0) return [];

  return prisma.pedido.findMany({
    where: {
      id: { in: pedidoIds },
    },
    select: {
      id: true,
      status: true,

      entrega: {
        select: {
          status: true,
          codigoRastreamento: true,
        },
      },

      solicitacoesCancelamento: {
        orderBy: { id: "desc" },
        take: 1,
        select: {
          ...campos,
          atualizadoEm: true,
          administrador: {
            select: { nome: true },
          },
        },
      },
    },
  });
}

export async function registrarAnaliseCancelamento(
  solicitacaoId: number,
  administradorId: number,
  acao: "iniciar" | "aprovar" | "recusar",
  statusEsperado: "SOLICITADA" | "EM_ANALISE",
  resposta: string | null
) {
  if (
    (
      acao !== "iniciar" &&
      acao !== "aprovar" &&
      acao !== "recusar"
    ) ||
    statusEsperado !== (
      acao === "iniciar"
        ? "SOLICITADA"
        : "EM_ANALISE"
    )
  ) {
    throw new CancelamentoError(
      "Transição de análise inválida.",
      400
    );
  }

  // Identifica o pedido antes da transação.
  const referencia =
    await prisma.solicitacaoCancelamento.findUnique({
      where: { id: solicitacaoId },
      select: { pedidoId: true },
    });

  if (!referencia) {
    throw new CancelamentoError(
      "Solicitação não encontrada.",
      404
    );
  }

  const destinos = {
    iniciar: StatusSolicitacaoCancelamento.EM_ANALISE,
    aprovar:
      StatusSolicitacaoCancelamento.APROVADA_PARA_REEMBOLSO,
    recusar: StatusSolicitacaoCancelamento.RECUSADA,
  };

  return prisma.$transaction(async (tx) => {
    // Bloqueia o pedido antes das leituras de estado.
    const linhas = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM pedidos
      WHERE id = ${referencia.pedidoId}
      FOR UPDATE
    `;

    if (linhas.length !== 1) {
      throw new CancelamentoError(
        "Pedido não encontrado.",
        404
      );
    }

    const administrador = await tx.usuario.findUnique({
      where: { id: administradorId },
      select: { perfil: true },
    });

    if (administrador?.perfil !== "ADMIN") {
      throw new CancelamentoError(
        "Acesso administrativo necessário.",
        403
      );
    }

    const atual =
      await tx.solicitacaoCancelamento.findUnique({
        where: { id: solicitacaoId },
        select: {
          pedidoId: true,
          status: true,
          administradorId: true,
          respostaAdmin: true,

          pedido: {
            select: {
              status: true,
              pagamentos: {
                where: {
                  status: StatusPagamento.APROVADO,
                },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      });

    if (
      !atual ||
      atual.pedidoId !== referencia.pedidoId
    ) {
      throw new CancelamentoError(
        "A solicitação mudou. Atualize o painel."
      );
    }

    const destino = destinos[acao];

    // Reenvio da mesma decisão não duplica o histórico.
    if (
      atual.status === destino &&
      atual.administradorId === administradorId &&
      atual.respostaAdmin === resposta
    ) {
      return {
        solicitacaoId,
        pedidoId: atual.pedidoId,
        status: atual.status,
        jaAplicado: true,
      };
    }

    const origemPermitida =
      acao === "iniciar"
        ? StatusSolicitacaoCancelamento.SOLICITADA
        : StatusSolicitacaoCancelamento.EM_ANALISE;

    if (
      atual.status !== statusEsperado ||
      atual.status !== origemPermitida
    ) {
      throw new CancelamentoError(
        "A solicitação já foi atualizada. Confira a situação atual antes de decidir."
      );
    }

    if (
      acao === "aprovar" &&
      atual.pedido.pagamentos.length === 0
    ) {
      throw new CancelamentoError(
        "Não há pagamento aprovado registrado. Confira a situação financeira antes de aprovar para reembolso."
      );
    }

    await tx.solicitacaoCancelamento.update({
      where: { id: solicitacaoId },
      data: {
        status: destino,
        administradorId,
        respostaAdmin: resposta,
        analisadoEm:
          acao === "iniciar" ? null : new Date(),
      },
    });

    const descricao =
      acao === "iniciar"
        ? "Análise iniciada"
        : acao === "recusar"
          ? "Solicitação recusada"
          : "Solicitação aprovada para reembolso; reembolso ainda não realizado";

    await tx.historicoPedido.create({
      data: {
        pedidoId: atual.pedidoId,
        status: atual.pedido.status,
        descricao:
          `Cancelamento #${solicitacaoId}: ${descricao}. Administrador #${administradorId}.`,
      },
    });

    return {
      solicitacaoId,
      pedidoId: atual.pedidoId,
      status: destino,
      jaAplicado: false,
    };
  });
}