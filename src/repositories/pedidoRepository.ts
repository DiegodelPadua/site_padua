
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
