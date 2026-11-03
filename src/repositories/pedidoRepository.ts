
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

export async function buscarPedidoPorChaveIdempotencia(
  usuarioId: number,
  chaveIdempotencia: string
) {
  return prisma.pedido.findFirst({
    where: {
      usuarioId,
      chaveIdempotencia,
    },
    select: {
      id: true,
      status: true,
      valorTotal: true,
      criadoEm: true,
      reservaExpiraEm: true,
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
        chaveIdempotencia: dados.chaveIdempotencia,
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
