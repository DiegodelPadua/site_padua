
/* =========================================================
   PEDIDO REPOSITORY - PÁDUA CULTURE
   =========================================================
   Responsável pelas operações de banco de dados
   relacionadas aos pedidos.

   Fluxo:
   Controller -> Service -> Repository -> Prisma -> MySQL

   Nesta etapa, somente operações de leitura.
   ========================================================= */

import { prisma } from "../../lib/prisma";

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
