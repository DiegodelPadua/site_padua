import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { CancelamentoError } from "./cancelamentoRepository";

const selecao = {
  id: true,
  pedidoId: true,
  status: true,
  reembolso: true,

  pedido: {
    select: {
      id: true,
      status: true,
      valorTotal: true,

      pagamentos: {
        take: 2,
        orderBy: { id: "desc" as const },

        select: {
          id: true,
          status: true,
          valor: true,
          pagoEm: true,
          identificadorExterno: true,

          transacoes: {
            take: 3,
            orderBy: { id: "desc" as const },

            select: {
              tipo: true,
              status: true,
              identificadorExterno: true,
              valor: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.SolicitacaoCancelamentoSelect;

export async function buscarBaseReembolso(
  solicitacaoId: number
) {
  const base =
    await prisma.solicitacaoCancelamento.findUnique({
      where: { id: solicitacaoId },
      select: selecao,
    });

  if (!base) {
    throw new CancelamentoError(
      "Solicitação não encontrada.",
      404
    );
  }

  return base;
}

type Prova = {
  pedidoId: number;
  pagamentoId: number;
  orderId: string;
  transacaoId: string;
  vendedorId: string;
  valor: Prisma.Decimal;
};

async function bloquear(
  tx: Prisma.TransactionClient,
  pedidoId: number,
  administradorId: number
) {
  const linhas = await tx.$queryRaw<
    Array<{ id: number }>
  >`
    SELECT id
    FROM pedidos
    WHERE id = ${pedidoId}
    FOR UPDATE
  `;

  if (linhas.length !== 1) {
    throw new CancelamentoError(
      "Pedido não encontrado.",
      404
    );
  }

  const admin = await tx.usuario.findUnique({
    where: { id: administradorId },
    select: { perfil: true },
  });

  if (admin?.perfil !== "ADMIN") {
    throw new CancelamentoError(
      "Acesso administrativo necessário.",
      403
    );
  }
}

function conferir(
  base: Awaited<
    ReturnType<typeof buscarBaseReembolso>
  >,
  prova: Prova,
  confirmado = false
) {
  const pagamento = base.pedido.pagamentos[0];

  const recibo = pagamento?.transacoes.filter(
    (t) => t.tipo === "APROVACAO_MP"
  );

  const outros = pagamento?.transacoes.filter(
    (t) =>
      t.tipo !== "APROVACAO_MP" &&
      !(
        confirmado &&
        t.tipo === "REEMBOLSO_MP" &&
        t.status === "CONFIRMADO"
      )
  );

  if (
    base.pedidoId !== prova.pedidoId ||
    base.status !== "APROVADA_PARA_REEMBOLSO" ||
    base.pedido.pagamentos.length !== 1 ||
    !pagamento ||
    pagamento.id !== prova.pagamentoId ||
    pagamento.status !== (
      confirmado ? "ESTORNADO" : "APROVADO"
    ) ||
    !pagamento.pagoEm ||
    pagamento.identificadorExterno !==
      prova.orderId ||
    !pagamento.valor.equals(prova.valor) ||
    !base.pedido.valorTotal.equals(prova.valor) ||
    recibo.length !== 1 ||
    outros.length !== 0 ||
    ![
      "CONFIRMADO",
      "REVISAO_MANUAL",
    ].includes(recibo[0].status) ||
    recibo[0].identificadorExterno !==
      prova.transacaoId ||
    !recibo[0].valor.equals(prova.valor)
  ) {
    throw new CancelamentoError(
      "O pedido, a aprovação ou o valor mudou. Reembolso bloqueado para conferência."
    );
  }
}

export async function registrarTentativaReembolso(
  solicitacaoId: number,
  administradorId: number,
  prova: Prova
) {
  return prisma.$transaction(async (tx) => {
    await bloquear(
      tx,
      prova.pedidoId,
      administradorId
    );

    const base =
      await tx.solicitacaoCancelamento.findUnique({
        where: { id: solicitacaoId },
        select: selecao,
      });

    if (!base) {
      throw new CancelamentoError(
        "Solicitação não encontrada.",
        404
      );
    }

    // Apenas quem criar o registro poderá enviar o POST.
    if (base.reembolso) {
      return {
        tentativa: base.reembolso,
        podeEnviar: false,
      };
    }

    conferir(base, prova);

    const tentativa =
      await tx.reembolsoCancelamento.create({
        data: {
          solicitacaoId,
          pagamentoId: prova.pagamentoId,
          administradorId,
          chaveIdempotencia: randomUUID(),
          orderId: prova.orderId,
          transacaoId: prova.transacaoId,
          vendedorId: prova.vendedorId,
          valor: prova.valor,
        },
      });

    await tx.historicoPedido.create({
      data: {
        pedidoId: prova.pedidoId,
        status: base.pedido.status,
        descricao:
          `Reembolso integral de teste #${tentativa.id} iniciado pelo administrador #${administradorId}. Resultado exige confirmação do provedor. Estoque mantido.`,
      },
    });

    return {
      tentativa,
      podeEnviar: true,
    };
  });
}

export async function confirmarReembolsoNoBanco(
  solicitacaoId: number,
  administradorId: number,
  tentativaId: number,
  prova: Prova,
  refundId: string
) {
  return prisma.$transaction(async (tx) => {
    await bloquear(
      tx,
      prova.pedidoId,
      administradorId
    );

    const base =
      await tx.solicitacaoCancelamento.findUnique({
        where: { id: solicitacaoId },
        select: selecao,
      });

    const r = base?.reembolso;

    if (
      !base ||
      !r ||
      r.id !== tentativaId ||
      r.pagamentoId !== prova.pagamentoId ||
      r.orderId !== prova.orderId ||
      r.transacaoId !== prova.transacaoId ||
      r.vendedorId !== prova.vendedorId ||
      !r.valor.equals(prova.valor)
    ) {
      throw new CancelamentoError(
        "O comprovante não corresponde à tentativa registrada."
      );
    }

    const jaConfirmado =
      r.status === "CONFIRMADO";

    conferir(base, prova, jaConfirmado);

    if (jaConfirmado) {
      if (
        r.identificadorExterno !== refundId
      ) {
        throw new CancelamentoError(
          "Comprovante divergente."
        );
      }

      return r;
    }

    await tx.pagamento.update({
      where: { id: r.pagamentoId },
      data: { status: "ESTORNADO" },
    });

    await tx.transacaoPagamento.create({
      data: {
        pagamentoId: r.pagamentoId,
        tipo: "REEMBOLSO_MP",
        status: "CONFIRMADO",
        identificadorExterno: refundId,
        valor: r.valor,
      },
    });

    await tx.pedido.update({
      where: { id: prova.pedidoId },
      data: {
        status: "CANCELADO",
        reservaExpiraEm: null,
      },
    });

    // Preserva os dados de entregas já encaminhadas.
    await tx.entrega.updateMany({
      where: {
        pedidoId: prova.pedidoId,

        status: {
          in: ["PENDENTE", "PREPARANDO"],
        },

        dataPostagem: null,
        dataEntrega: null,
        codigoRastreamento: null,
        melhorEnvioId: null,
      },

      data: {
        status: "CANCELADO",
      },
    });

    const atualizado =
      await tx.reembolsoCancelamento.update({
        where: { id: r.id },

        data: {
          status: "CONFIRMADO",
          identificadorExterno: refundId,
          confirmadoEm: new Date(),
        },
      });

    await tx.historicoPedido.create({
      data: {
        pedidoId: prova.pedidoId,
        status: "CANCELADO",
        descricao:
          `Reembolso integral de teste #${r.id} confirmado no Mercado Pago pelo administrador #${administradorId}. Pedido cancelado. Estoque não reposto; conferir separação ou devolução física.`,
      },
    });

    return atualizado;
  });
}