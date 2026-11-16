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