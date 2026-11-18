import { prisma } from "../../lib/prisma";

export async function buscarDadosPreparacaoEnvio(
  pedidoId: number
) {
  return prisma.pedido.findUnique({
    where: { id: pedidoId },

    select: {
      id: true,
      status: true,
      subtotal: true,
      valorFrete: true,

      usuario: {
        select: {
          telefone: true,
        },
      },

      enderecoEntrega: true,

      entrega: {
        select: {
          transportadora: true,
          modalidadeFrete: true,
        },
      },

      itens: {
        select: {
          nomeProduto: true,
          cor: true,
          tamanho: true,
          quantidade: true,
          precoUnitario: true,
          subtotal: true,

          variante: {
            select: {
              produto: {
                select: {
                  pesoGramas: true,

                  categoria: {
                    select: {
                      slug: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}