
/* =========================================================
   PEDIDO REPOSITORY - PÁDUA CULTURE
   =========================================================
   Responsável pelas operações de banco de dados
   relacionadas aos pedidos.

   Fluxo:
   Controller -> Service -> Repository -> Prisma -> MySQL
   ========================================================= */

import {
  Prisma,
  StatusPedido,
  StatusEntrega,
  TipoMovimentacaoEstoque,
  StatusPagamento,
} from "@prisma/client";
import { prisma } from "../../lib/prisma";


/* =========================================================
   ERRO DE RESERVA DE ESTOQUE
   ========================================================= */

export class ReservaEstoqueError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ReservaEstoqueError";
  }
}

/* =========================================================
   BUSCAR ENDEREÇO DO CLIENTE
   =========================================================
   A consulta exige o ID do usuário autenticado.

   Isso impede que um cliente utilize o endereço
   cadastrado por outro usuário.
   ========================================================= */

export async function buscarEnderecoDoCliente(
  usuarioId: number,
  enderecoId: number
) {
  return prisma.endereco.findFirst({
    where: {
      id: enderecoId,
      usuarioId,
    },
    select: {
      id: true,
      usuarioId: true,
      destinatario: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      estado: true,
    },
  });
}

/* =========================================================
   BUSCAR VARIANTES PARA UM PEDIDO
   =========================================================
   Consulta os produtos diretamente no banco.

   O navegador não define:
   - Preço oficial.
   - Preço promocional.
   - Estoque disponível.
   - Situação de venda do produto.
   ========================================================= */

export async function buscarVariantesDoPedido(
  variantesIds: number[]
) {
  return prisma.varianteProduto.findMany({
    where: {
      id: {
        in: variantesIds,
      },
      ativa: true,
      produto: {
        ativo: true,
        categoria: {
          ativa: true,
        },
      },
    },
    select: {
      id: true,
      tamanho: true,
      cor: true,
      quantidade: true,
      produto: {
        select: {
          id: true,
          nome: true,
          preco: true,
          precoPromocional: true,
          pesoGramas: true,
          categoria: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });
}

/* =========================================================
   TIPOS PARA REGISTRO DO PEDIDO
   =========================================================
   Define os dados que o Service deverá enviar
   para registrar um pedido.
   ========================================================= */

export type DadosRegistroPedido = {
  usuarioId: number;
    // Identifica de forma única a tentativa de compra.
  chaveIdempotencia: string;

  // Identificação SHA-256 dos dados originais do checkout.
  // Permite detectar reutilização da chave com uma compra diferente.
  hashCheckout: string;

  // Prazo de validade da reserva.
  reservaExpiraEm: Date;
  subtotal: Prisma.Decimal;
  valorFrete: Prisma.Decimal;
  valorTotal: Prisma.Decimal;

  endereco: {
    destinatario: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    estado: string;
  };

  frete: {
    nome: string;
    transportadora: string;
  };

  itens: {
    varianteId: number;
    nomeProduto: string;
    tamanho: string;
    cor: string;
    quantidade: number;
    precoUnitario: Prisma.Decimal;
    subtotal: Prisma.Decimal;
  }[];
};

/* =========================================================
   REGISTRAR PEDIDO
   =========================================================
   Grava os dados do pedido em uma transação.

   Se alguma operação falhar, a transação é
   revertida automaticamente pelo Prisma.

   IMPORTANTE:
   - Não processa pagamentos.
   - Não movimenta estoque.
   - Não compra etiquetas de frete.
   ========================================================= */

  /* =========================================================
   BUSCAR PEDIDO PELA CHAVE DE IDEMPOTÊNCIA
   =========================================================
   Verifica se uma tentativa de checkout já possui
   um pedido registrado no banco.

   A consulta também considera o usuário autenticado
   para evitar acesso a pedidos de outros clientes.
   ========================================================= */

/**
 * Consulta uma tentativa de checkout pela chave de idempotência.
 *
 * A busca é feita pela chave única, independentemente do usuário.
 * O Service deverá conferir o proprietário antes de retornar
 * qualquer informação ao cliente.
 */
/**
 * Busca um pedido pela chave única de idempotência.
 *
 * Essa consulta permite identificar se uma tentativa de
 * compra já foi registrada anteriormente.
 *
 * O Service deverá:
 * 1. Conferir se o pedido pertence ao usuário autenticado.
 * 2. Comparar o hash da solicitação atual com o original.
 * 3. Retornar o pedido existente quando os dados coincidirem.
 * 4. Rejeitar a reutilização da chave com dados diferentes.
 */
export async function buscarPedidoPorChaveIdempotencia(
  chaveIdempotencia: string
) {
  return prisma.pedido.findUnique({
    // A chave possui restrição UNIQUE no banco MySQL.
    where: {
      chaveIdempotencia,
    },

    select: {
      // Identificação do pedido e do cliente.
      id: true,
      usuarioId: true,

      // Identificação única da tentativa de checkout.
      chaveIdempotencia: true,

      // Hash SHA-256 dos dados originais da compra.
      hashCheckout: true,

      // Situação atual e informações do pedido.
      status: true,
      valorTotal: true,
      criadoEm: true,
      reservaExpiraEm: true,

      // Produtos registrados na compra original.
      itens: {
        select: {
          varianteId: true,
          quantidade: true,
        },
      },

      // Endereço preservado no momento da compra.
      enderecoEntrega: {
        select: {
          destinatario: true,
          cep: true,
          logradouro: true,
          numero: true,
          complemento: true,
          bairro: true,
          cidade: true,
          estado: true,
        },
      },

      // Informações da entrega selecionada.
      entrega: {
        select: {
          transportadora: true,
          modalidadeFrete: true,
        },
      },
    },
  });
}
export async function registrarPedido(
  dados: DadosRegistroPedido
) {
  return prisma.$transaction(async (tx) => {
    /* =====================================================
       1. CRIAR O PEDIDO PRINCIPAL
       ===================================================== */

    const pedido = await tx.pedido.create({
      data: {
        usuarioId: dados.usuarioId,
        // Chave única da tentativa de compra.
        chaveIdempotencia: dados.chaveIdempotencia,

        // Hash que identifica os dados da solicitação original.
        hashCheckout: dados.hashCheckout,

        // Prazo máximo da reserva de estoque.
        reservaExpiraEm: dados.reservaExpiraEm,
        status: StatusPedido.AGUARDANDO_PAGAMENTO,
        subtotal: dados.subtotal,
        valorFrete: dados.valorFrete,
        valorTotal: dados.valorTotal,

      },
      select: {
        id: true,
        status: true,
        valorTotal: true,
        criadoEm: true,
      },
    });


    /* =====================================================
   RESERVAR ESTOQUE DOS PRODUTOS
   =====================================================
   A atualização condicional garante que somente
   produtos com estoque suficiente sejam reservados.

   Toda a operação ocorre dentro da transação.
   ===================================================== */

for (const item of dados.itens) {
  // Confere se a quantidade solicitada é válida.
  if (
    !Number.isSafeInteger(item.quantidade) ||
    item.quantidade <= 0
  ) {
    throw new ReservaEstoqueError(
      "Quantidade inválida para reserva."
    );
  }

  // Lê o estoque atual da variante.
  const variante = await tx.varianteProduto.findUnique({
    where: {
      id: item.varianteId,
    },
    select: {
      quantidade: true,
    },
  });

  if (!variante) {
    throw new ReservaEstoqueError(
      `Variante ${item.varianteId} não encontrada.`
    );
  }

  // Reduz o estoque somente quando há unidades suficientes.
  const resultado = await tx.varianteProduto.updateMany({
    where: {
      id: item.varianteId,
      ativa: true,
      quantidade: {
        gte: item.quantidade,
      },
      produto: {
        ativo: true,
        categoria: {
          ativa: true,
        },
      },
    },
    data: {
      quantidade: {
        decrement: item.quantidade,
      },
    },
  });

  // Se nenhuma linha foi atualizada, a reserva falhou.
  if (resultado.count !== 1) {
    throw new ReservaEstoqueError(
      `Estoque insuficiente para ${item.nomeProduto} (${item.cor}, ${item.tamanho}).`
    );
  }

  // Consulta o saldo efetivamente gravado após a reserva.
  const varianteAtualizada =
    await tx.varianteProduto.findUniqueOrThrow({
      where: {
        id: item.varianteId,
      },
      select: {
        quantidade: true,
      },
    });

      const saldoPosterior = varianteAtualizada.quantidade;

      // Reconstrói o saldo anterior a partir da baixa efetiva.
      // Não usa a leitura anterior, que pode estar desatualizada
      // quando duas compras acontecem simultaneamente.
      const saldoAnterior = saldoPosterior + item.quantidade;

      // Registra a movimentação para auditoria do estoque.
      await tx.movimentacaoEstoque.create({
        data: {
          pedidoId: pedido.id,
          varianteId: item.varianteId,
          tipo: TipoMovimentacaoEstoque.RESERVA,
          quantidade: item.quantidade,
          motivo: "Reserva de estoque para pedido aguardando pagamento.",
          saldoAnterior,
          saldoPosterior,
        },
      });
    }

    /* =====================================================
       2. REGISTRAR OS ITENS COM OS PREÇOS DA COMPRA
       ===================================================== */

    await tx.itemPedido.createMany({
      data: dados.itens.map((item) => ({
        pedidoId: pedido.id,
        varianteId: item.varianteId,
        nomeProduto: item.nomeProduto,
        tamanho: item.tamanho,
        cor: item.cor,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
      })),
    });

    /* =====================================================
       3. SALVAR UMA CÓPIA DO ENDEREÇO DE ENTREGA
       =====================================================
       Mesmo que o cliente altere seu endereço depois,
       o endereço utilizado na compra será preservado.
       ===================================================== */

    await tx.enderecoEntregaPedido.create({
      data: {
        pedidoId: pedido.id,
        ...dados.endereco,
      },
    });

    /* =====================================================
       4. REGISTRAR AS INFORMAÇÕES DA ENTREGA
       ===================================================== */

    await tx.entrega.create({
      data: {
        pedidoId: pedido.id,
        transportadora: dados.frete.transportadora,
        modalidadeFrete: dados.frete.nome,
        status: StatusEntrega.PENDENTE,
      },
    });

    /* =====================================================
       5. CRIAR O PRIMEIRO REGISTRO DO HISTÓRICO
       ===================================================== */

    await tx.historicoPedido.create({
      data: {
        pedidoId: pedido.id,
        status: StatusPedido.AGUARDANDO_PAGAMENTO,
        descricao: "Pedido registrado com estoque reservado, aguardando pagamento.",
      },
    });

    /* =====================================================
       6. RETORNAR O PEDIDO REGISTRADO
       ===================================================== */

    return pedido;
  });
}
/**
 * Libera o estoque de um pedido cuja reserva expirou.
 *
 * Regras:
 * - Somente pedidos AGUARDANDO_PAGAMENTO podem ser cancelados.
 * - A reserva precisa estar vencida.
 * - Pagamentos pendentes, processando ou aprovados bloqueiam
 *   a liberação até que sua situação seja conciliada.
 * - O cancelamento e a devolução ocorrem na mesma transação.
 *
 * Retorna true quando a reserva foi liberada.
 * Retorna false quando não é seguro ou necessário liberá-la.
 */
export async function liberarReservaExpirada(
  pedidoId: number
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const agora = new Date();

    // Bloqueia logicamente o pedido por meio de uma atualização
    // condicional. Apenas uma execução poderá mudar seu status.
    const alteracao = await tx.pedido.updateMany({
      where: {
        id: pedidoId,
        status: StatusPedido.AGUARDANDO_PAGAMENTO,
        reservaExpiraEm: {
          lte: agora,
        },

        // Não libera estoque enquanto houver uma cobrança
        // que possa ser confirmada pelo provedor.
        pagamentos: {
          none: {
            status: {
              in: [
                StatusPagamento.PENDENTE,
                StatusPagamento.PROCESSANDO,
                StatusPagamento.APROVADO,
              ],
            },
          },
        },
      },
      data: {
        status: StatusPedido.CANCELADO,
      },
    });

    // Se outra execução já alterou o pedido ou existe
    // pagamento que exige conciliação, não faz nada.
    if (alteracao.count !== 1) {
      return false;
    }

    // Recupera as reservas efetivamente registradas.
    const reservas = await tx.movimentacaoEstoque.findMany({
      where: {
        pedidoId,
        tipo: TipoMovimentacaoEstoque.RESERVA,
      },
      select: {
        varianteId: true,
        quantidade: true,
      },
    });

    // Devolve cada quantidade reservada ao estoque.
    for (const reserva of reservas) {
      const variante = await tx.varianteProduto.findUnique({
        where: {
          id: reserva.varianteId,
        },
        select: {
          quantidade: true,
        },
      });

      if (!variante) {
        // Qualquer erro desfaz toda a transação,
        // inclusive a mudança de status do pedido.
        throw new Error(
          `Variante ${reserva.varianteId} não encontrada.`
        );
      }

      // Incremento atômico para preservar alterações concorrentes.
      await tx.varianteProduto.update({
        where: {
          id: reserva.varianteId,
        },
        data: {
          quantidade: {
            increment: reserva.quantidade,
          },
        },
      });

      // Consulta o saldo após a devolução.
      const varianteAtualizada =
        await tx.varianteProduto.findUniqueOrThrow({
          where: {
            id: reserva.varianteId,
          },
          select: {
            quantidade: true,
          },
        });

      // Registra a devolução para auditoria do estoque.
      await tx.movimentacaoEstoque.create({
        data: {
          pedidoId,
          varianteId: reserva.varianteId,
          tipo: TipoMovimentacaoEstoque.LIBERACAO_RESERVA,
          quantidade: reserva.quantidade,
          motivo: "Reserva expirada sem pagamento confirmado.",
          saldoAnterior: varianteAtualizada.quantidade - reserva.quantidade,
          saldoPosterior: varianteAtualizada.quantidade,
        },
      });
    }

    // Registra o cancelamento no histórico do pedido.
    await tx.historicoPedido.create({
      data: {
        pedidoId,
        status: StatusPedido.CANCELADO,
        descricao: "Pedido cancelado por expiração da reserva de estoque.",
      },
    });

    return true;
  });
}

/* =========================================================
   BUSCAR PEDIDOS COM RESERVA EXPIRADA
   PÁDUA CULTURE

   Identifica pedidos cujo prazo de reserva terminou.

   Esta função apenas consulta o banco.
   Não cancela pedidos nem movimenta estoque.
   ========================================================= */

export async function buscarPedidosComReservaExpirada(
  limite: number = 50
) {
  // Impede consultas excessivamente grandes.
  const quantidade = Math.min(
    Math.max(Math.trunc(limite), 1),
    100
  );

  // Consulta somente pedidos aguardando pagamento
  // cujo prazo de reserva já terminou.
  return prisma.pedido.findMany({
    where: {
      status: StatusPedido.AGUARDANDO_PAGAMENTO,

      reservaExpiraEm: {
        lte: new Date(),
      },

      // Não seleciona pedidos com cobranças que ainda
      // podem ser aprovadas ou exigem conciliação.
      pagamentos: {
        none: {
          status: {
            in: [
              StatusPagamento.PENDENTE,
              StatusPagamento.PROCESSANDO,
              StatusPagamento.APROVADO,
            ],
          },
        },
      },
    },

    select: {
      id: true,
      reservaExpiraEm: true,
    },

    orderBy: {
      reservaExpiraEm: "asc",
    },

    take: quantidade,
  });
}

/* =========================================================
   ENCERRAR RESERVA VENCIDA PARA NOVA COMPRA
   =========================================================
   Exige que o pedido pertença ao cliente autenticado.
   Qualquer tentativa financeira bloqueia este fluxo.
   O cancelamento e a devolução do estoque são atômicos.
   ========================================================= */

export class ReinicioCheckoutError extends Error {
  constructor(
    mensagem: string,
    public readonly status: number = 409
  ) {
    super(mensagem);
    this.name = "ReinicioCheckoutError";
  }
}

export async function encerrarPedidoExpirado(
  pedidoId: number,
  usuarioId: number
) {
  if (
    ![pedidoId, usuarioId].every(
      (id) => Number.isSafeInteger(id) && id > 0
    )
  ) {
    throw new ReinicioCheckoutError(
      "Identificação inválida.",
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    const linhas = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM pedidos
      WHERE id = ${pedidoId} AND usuarioId = ${usuarioId}
      FOR UPDATE
    `;

    if (linhas.length !== 1) {
      throw new ReinicioCheckoutError(
        "Pedido não encontrado para este cliente.",
        404
      );
    }

    const pedido = await tx.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      select: {
        status: true,
        reservaExpiraEm: true,
        pagamentos: {
          select: { id: true },
          take: 1,
        },
        itens: {
          select: {
            varianteId: true,
            quantidade: true,
          },
        },
        movimentacoesEstoque: {
          select: {
            varianteId: true,
            tipo: true,
            quantidade: true,
          },
        },
      },
    });

    // Qualquer tentativa financeira bloqueia este caminho.
    // Não cancela cobranças externas.
    if (pedido.pagamentos.length > 0) {
      throw new ReinicioCheckoutError(
        "Este pedido possui uma tentativa de pagamento. Sua situação precisa ser conferida antes de iniciar outra compra."
      );
    }

    const jaEncerrado =
      pedido.status === StatusPedido.CANCELADO;

    if (
      !jaEncerrado &&
      (
        pedido.status !== StatusPedido.AGUARDANDO_PAGAMENTO ||
        !pedido.reservaExpiraEm ||
        pedido.reservaExpiraEm.getTime() > Date.now()
      )
    ) {
      throw new ReinicioCheckoutError(
        "Este pedido não pode ser reiniciado por vencimento da reserva."
      );
    }

    const itens = new Map<number, number>();
    const reservas = new Map<number, number>();
    const liberacoes = new Map<number, number>();

    for (const item of pedido.itens) {
      if (
        item.varianteId === null ||
        item.quantidade <= 0
      ) {
        throw new ReinicioCheckoutError(
          "Os itens do pedido exigem revisão."
        );
      }

      itens.set(
        item.varianteId,
        (itens.get(item.varianteId) ?? 0) + item.quantidade
      );
    }

    for (const movimento of pedido.movimentacoesEstoque) {
      if (
        movimento.quantidade <= 0 ||
        !itens.has(movimento.varianteId)
      ) {
        throw new ReinicioCheckoutError(
          "A reserva de estoque exige revisão."
        );
      }

      const mapa =
        movimento.tipo === TipoMovimentacaoEstoque.RESERVA
          ? reservas
          : movimento.tipo ===
              TipoMovimentacaoEstoque.LIBERACAO_RESERVA
            ? liberacoes
            : null;

      if (!mapa) {
        throw new ReinicioCheckoutError(
          "As movimentações do pedido exigem revisão."
        );
      }

      mapa.set(
        movimento.varianteId,
        (mapa.get(movimento.varianteId) ?? 0) +
          movimento.quantidade
      );
    }

    if (
      itens.size === 0 ||
      reservas.size !== itens.size
    ) {
      throw new ReinicioCheckoutError(
        "Não foi possível conferir a reserva original."
      );
    }

    for (const [varianteId, quantidade] of itens) {
      if (
        reservas.get(varianteId) !== quantidade ||
        (liberacoes.get(varianteId) ?? 0) !==
          (jaEncerrado ? quantidade : 0)
      ) {
        throw new ReinicioCheckoutError(
          "A reserva e suas liberações exigem revisão."
        );
      }
    }

    // Um reenvio após perda da resposta não devolve estoque novamente.
    if (!jaEncerrado) {
      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          status: StatusPedido.CANCELADO,
        },
      });

      // Ordem estável para atualizar produtos compartilhados entre pedidos.
      const itensOrdenados = [...itens].sort(
        (a, b) => a[0] - b[0]
      );

      for (const [varianteId, quantidade] of itensOrdenados) {
        const variante = await tx.varianteProduto.update({
          where: { id: varianteId },
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
            tipo: TipoMovimentacaoEstoque.LIBERACAO_RESERVA,
            saldoAnterior: variante.quantidade - quantidade,
            saldoPosterior: variante.quantidade,
            motivo:
              "Reserva vencida encerrada pelo cliente para iniciar nova compra.",
          },
        });
      }

      await tx.historicoPedido.create({
        data: {
          pedidoId,
          status: StatusPedido.CANCELADO,
          descricao:
            "Reserva vencida encerrada pelo cliente, sem tentativa de pagamento. Estoque devolvido.",
        },
      });
    }

    return {
      pedidoId,
      podeIniciarNovaCompra: true,
    };
  });
}