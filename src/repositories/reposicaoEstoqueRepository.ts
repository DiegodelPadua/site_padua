import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export class ReposicaoError extends Error {
  constructor(
    mensagem: string,
    public readonly status = 409
  ) {
    super(mensagem);
    this.name = "ReposicaoError";
  }
}

const selecao = {
  id: true,
  status: true,
  valorTotal: true,

  itens: {
    select: {
      varianteId: true,
      quantidade: true,
      nomeProduto: true,
      cor: true,
      tamanho: true,
    },
  },

  entrega: {
    select: {
      status: true,
      codigoRastreamento: true,
      melhorEnvioId: true,
      dataPostagem: true,
      dataEntrega: true,
    },
  },

  historico: {
    where: {
      status: {
        in: ["ENVIADO", "ENTREGUE"],
      },
    },
    take: 1,
    select: { id: true },
  },

  movimentacoesEstoque: {
    select: {
      varianteId: true,
      tipo: true,
      quantidade: true,
      saldoAnterior: true,
      saldoPosterior: true,
      motivo: true,
    },
  },

  pagamentos: {
    take: 2,

    select: {
      id: true,
      status: true,
      valor: true,
      identificadorExterno: true,

      transacoes: {
        take: 3,

        select: {
          tipo: true,
          status: true,
          valor: true,
          identificadorExterno: true,
        },
      },

      reembolso: {
        include: {
          solicitacao: {
            select: {
              pedidoId: true,
              status: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.PedidoSelect;

type Base = Prisma.PedidoGetPayload<{
  select: typeof selecao;
}>;

type Origem = "NAO_ENVIADO" | "DEVOLVIDO";

function positivo(n: number) {
  return (
    Number.isSafeInteger(n) &&
    n > 0 &&
    n <= 2147483647
  );
}

function analisar(pedido: Base) {
  const pagamento = pedido.pagamentos[0];
  const r = pagamento?.reembolso;

  const aprovacao = pagamento?.transacoes.filter(
    (t) => t.tipo === "APROVACAO_MP"
  );

  const devolucao = pagamento?.transacoes.filter(
    (t) => t.tipo === "REEMBOLSO_MP"
  );

  if (
    pedido.status !== "CANCELADO" ||
    pedido.pagamentos.length !== 1 ||
    !pagamento ||
    pagamento.status !== "ESTORNADO" ||
    !r ||
    r.status !== "CONFIRMADO" ||
    !r.confirmadoEm ||
    !r.identificadorExterno ||
    r.pagamentoId !== pagamento.id ||
    r.solicitacao.pedidoId !== pedido.id ||
    r.solicitacao.status !==
      "APROVADA_PARA_REEMBOLSO" ||
    r.orderId !== pagamento.identificadorExterno ||
    !r.valor.greaterThan(0) ||
    !r.valor.equals(pagamento.valor) ||
    !r.valor.equals(pedido.valorTotal) ||
    pagamento.transacoes.length !== 2 ||
    aprovacao.length !== 1 ||
    devolucao.length !== 1 ||
    ![
      "CONFIRMADO",
      "REVISAO_MANUAL",
    ].includes(aprovacao[0].status) ||
    aprovacao[0].identificadorExterno !==
      r.transacaoId ||
    !aprovacao[0].valor.equals(r.valor) ||
    devolucao[0].status !== "CONFIRMADO" ||
    devolucao[0].identificadorExterno !==
      r.identificadorExterno ||
    !devolucao[0].valor.equals(r.valor)
  ) {
    throw new ReposicaoError(
      "É necessário um reembolso integral confirmado e conciliado para este pedido cancelado."
    );
  }

  const itens = new Map<number, number>();

  if (
    pedido.itens.length === 0 ||
    pedido.itens.length > 100
  ) {
    throw new ReposicaoError(
      "Os itens exigem conferência antes da reposição integral."
    );
  }

  for (const item of pedido.itens) {
    if (
      item.varianteId === null ||
      !positivo(item.varianteId) ||
      !positivo(item.quantidade)
    ) {
      throw new ReposicaoError(
        "Há um item sem variante válida ou com quantidade inválida."
      );
    }

    const quantidade =
      (itens.get(item.varianteId) ?? 0) +
      item.quantidade;

    if (!positivo(quantidade)) {
      throw new ReposicaoError(
        "Quantidade total inválida."
      );
    }

    itens.set(item.varianteId, quantidade);
  }

  const jaReposto =
    r.estoqueRepostoEm !== null;

  if (
    jaReposto
      ? (
          !r.estoqueConferidoPorId ||
          !r.observacaoEstoque ||
          ![
            "NAO_ENVIADO",
            "DEVOLVIDO",
          ].includes(r.origemReposicao ?? "")
        )
      : (
          r.estoqueConferidoPorId !== null ||
          r.origemReposicao !== null ||
          r.observacaoEstoque !== null
        )
  ) {
    throw new ReposicaoError(
      "O registro da conferência está inconsistente. Revise o histórico."
    );
  }

  const reservas = new Map<number, number>();
  const entradas = new Map<number, number>();

  const motivo =
    `Reposição integral após reembolso #${r.id}.`;

  for (const m of pedido.movimentacoesEstoque) {
    if (
      !itens.has(m.varianteId) ||
      !positivo(m.quantidade) ||
      !Number.isSafeInteger(m.saldoAnterior) ||
      !Number.isSafeInteger(m.saldoPosterior) ||
      m.saldoAnterior < 0 ||
      m.saldoPosterior < 0
    ) {
      throw new ReposicaoError(
        "Movimentação de estoque inconsistente."
      );
    }

    if (
      m.tipo === "RESERVA" &&
      m.saldoAnterior - m.saldoPosterior ===
        m.quantidade
    ) {
      reservas.set(
        m.varianteId,
        (reservas.get(m.varianteId) ?? 0) +
          m.quantidade
      );
    } else if (
      jaReposto &&
      m.tipo === "ENTRADA" &&
      m.motivo === motivo &&
      m.saldoPosterior - m.saldoAnterior ===
        m.quantidade &&
      !entradas.has(m.varianteId)
    ) {
      entradas.set(
        m.varianteId,
        m.quantidade
      );
    } else {
      throw new ReposicaoError(
        "Já existe liberação, entrada ou outra movimentação que exige revisão. Nenhuma reposição será feita."
      );
    }
  }

  for (const [id, quantidade] of itens) {
    if (
      reservas.get(id) !== quantidade ||
      (entradas.get(id) ?? 0) !==
        (jaReposto ? quantidade : 0)
    ) {
      throw new ReposicaoError(
        "A reserva original e as entradas não correspondem aos itens do pedido."
      );
    }
  }

  if (!pedido.entrega) {
    throw new ReposicaoError(
      "Entrega não encontrada para conferir a origem dos produtos."
    );
  }

  const e = pedido.entrega;

  const semEnvio =
    [
      "PENDENTE",
      "PREPARANDO",
      "CANCELADO",
    ].includes(e.status) &&
    !e.dataPostagem &&
    !e.dataEntrega &&
    !e.codigoRastreamento &&
    !e.melhorEnvioId &&
    pedido.historico.length === 0;

  const origemPermitida: Origem =
    semEnvio ? "NAO_ENVIADO" : "DEVOLVIDO";

  return {
    r,
    itens,
    jaReposto,
    origemPermitida,
    motivo,
  };
}

function dto(
  pedido: Base,
  analise: ReturnType<typeof analisar> | null,
  bloqueio: string | null
) {
  const r = analise?.r;

  return {
    pedidoId: pedido.id,

    podeRepor:
      !!analise && !analise.jaReposto,

    origemPermitida:
      analise?.origemPermitida ?? null,

    motivoBloqueio: bloqueio,

    itens: pedido.itens.map((i) => ({
      nome: i.nomeProduto,
      cor: i.cor,
      tamanho: i.tamanho,
      quantidade: i.quantidade,
    })),

    reposicao: r?.estoqueRepostoEm
      ? {
          registradoEm:
            r.estoqueRepostoEm.toISOString(),
          administradorId:
            r.estoqueConferidoPorId,
          origem: r.origemReposicao,
          observacao: r.observacaoEstoque,
        }
      : null,
  };
}

export async function consultarReposicaoNoBanco(
  pedidoId: number
) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: selecao,
  });

  if (!pedido) {
    throw new ReposicaoError(
      "Pedido não encontrado.",
      404
    );
  }

  try {
    return dto(
      pedido,
      analisar(pedido),
      null
    );
  } catch (erro) {
    if (erro instanceof ReposicaoError) {
      return dto(
        pedido,
        null,
        erro.message
      );
    }

    throw erro;
  }
}

export async function reporEstoqueNoBanco(
  pedidoId: number,
  administradorId: number,
  origem: Origem,
  observacao: string
) {
  return prisma.$transaction(
    async (tx) => {
      const linhas = await tx.$queryRaw<
        Array<{ id: number }>
      >`
        SELECT id
        FROM pedidos
        WHERE id = ${pedidoId}
        FOR UPDATE
      `;

      if (linhas.length !== 1) {
        throw new ReposicaoError(
          "Pedido não encontrado.",
          404
        );
      }

      const admin = await tx.usuario.findUnique({
        where: { id: administradorId },
        select: { perfil: true },
      });

      if (admin?.perfil !== "ADMIN") {
        throw new ReposicaoError(
          "Acesso administrativo necessário.",
          403
        );
      }

      const pedido =
        await tx.pedido.findUniqueOrThrow({
          where: { id: pedidoId },
          select: selecao,
        });

      const a = analisar(pedido);

      if (a.jaReposto) {
        return {
          pedidoId,
          jaReposto: true,
        };
      }

      if (origem !== a.origemPermitida) {
        throw new ReposicaoError(
          "A entrega mudou. Atualize a consulta e confira novamente a origem física dos produtos."
        );
      }

      const ordenados = [...a.itens].sort(
        (x, y) => x[0] - y[0]
      );

      for (
        const [varianteId, quantidade]
        of ordenados
      ) {
        const variante =
          await tx.varianteProduto.update({
            where: {
              id: varianteId,
              quantidade: {
                gte: 0,
                lte: 2147483647 - quantidade,
              },
            },

            data: {
              quantidade: {
                increment: quantidade,
              },
            },

            select: {
              quantidade: true,
            },
          });

        await tx.movimentacaoEstoque.create({
          data: {
            pedidoId,
            varianteId,
            quantidade,
            tipo: "ENTRADA",
            motivo: a.motivo,
            saldoAnterior:
              variante.quantidade - quantidade,
            saldoPosterior:
              variante.quantidade,
          },
        });
      }

      await tx.reembolsoCancelamento.update({
        where: { id: a.r.id },

        data: {
          estoqueRepostoEm: new Date(),
          estoqueConferidoPorId:
            administradorId,
          origemReposicao: origem,
          observacaoEstoque: observacao,
        },
      });

      if (origem === "DEVOLVIDO") {
        await tx.entrega.update({
          where: { pedidoId },
          data: {
            status: "DEVOLVIDO",
          },
        });
      }

      await tx.historicoPedido.create({
        data: {
          pedidoId,
          status: pedido.status,
          descricao:
            `Reposição integral após reembolso #${a.r.id}, conferida pelo administrador #${administradorId}. Origem: ${
              origem === "NAO_ENVIADO"
                ? "produtos permaneceram na loja"
                : "produtos retornaram e foram conferidos"
            }. Itens aptos à venda.`,
        },
      });

      return {
        pedidoId,
        jaReposto: false,
      };
    },
    {
      maxWait: 5000,
      timeout: 15000,
    }
  );
}