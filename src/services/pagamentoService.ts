/* =========================================================
   PAGAMENTO SERVICE - PÁDUA CULTURE
   =========================================================
   Responsável por coordenar o processo de pagamento.

   Fluxo:
   Controller -> Service -> Repository -> Prisma -> MySQL

   Integrações:
   - Pedido registrado no banco.
   - Tentativa financeira.
   - Mercado Pago Checkout Pro.

   Nenhuma cobrança é criada neste estágio.
   ========================================================= */

// Tipos do Prisma utilizados nos cálculos financeiros.
import { MetodoPagamento, Prisma } from "@prisma/client";

// Funções responsáveis por consultar e registrar pagamentos.
import {
  buscarDadosPedidoMercadoPago,
  registrarTentativaPagamento,
} from "../repositories/pagamentoRepository";

/* =========================================================
   PREPARAR PAGAMENTO
   =========================================================
   Registra ou reutiliza uma tentativa de pagamento.

   O pedido deve:
   - Pertencer ao usuário autenticado.
   - Estar aguardando pagamento.
   - Possuir reserva de estoque válida.

   A validação definitiva acontece no repositório,
   dentro de uma transação do MySQL.
   ========================================================= */

/* =========================================================
   PREPARAR PAGAMENTO
   =========================================================
   Consulta os dados oficiais do pedido.

   Valida:
   - Produtos e quantidades.
   - Valor do frete.
   - Descontos.
   - Valor total da compra.

   Depois registra ou reutiliza uma tentativa financeira.

   Nenhuma cobrança é enviada ao Mercado Pago aqui.
   ========================================================= */

export async function prepararPagamento(
  pedidoId: number,
  usuarioId: number,
  metodo: MetodoPagamento
) {
  // 1. Recupera os dados oficiais do pedido no MySQL.
  const pedido = await buscarDadosPedidoMercadoPago(
    pedidoId,
    usuarioId
  );

  // 2. Confere os valores registrados no pedido.
  validarValoresPedido({
    valorTotal: pedido.valorTotal,
    valorFrete: pedido.valorFrete,
    valorDesconto: pedido.valorDesconto,
    itens: pedido.itens,
  });

  // 3. Registra ou reutiliza a tentativa de pagamento.
  // O repositório verifica novamente o status e a reserva
  // dentro de uma transação com bloqueio do pedido.
  const pagamento = await registrarTentativaPagamento(
    pedidoId,
    usuarioId,
    metodo
  );

  // 4. Retorna os dados da tentativa financeira.
  return {
    pagamentoId: pagamento.id,
    pedidoId: pagamento.pedidoId,
    status: pagamento.status,
    valor: pagamento.valor.toString(),
  };
}
/* =========================================================
   VALIDAR VALORES DO PEDIDO
   =========================================================
   Confere se a soma dos produtos, frete e desconto
   corresponde ao valor total salvo no MySQL.

   Utiliza Decimal para evitar erros de arredondamento.
   ========================================================= */

export function validarValoresPedido(
  dados: {
    valorTotal: Prisma.Decimal;
    valorFrete: Prisma.Decimal;
    valorDesconto: Prisma.Decimal;
    itens: Array<{
      quantidade: number;
      precoUnitario: Prisma.Decimal;
    }>;
  }
) {
  // Impede pagamentos sem produtos.
  if (dados.itens.length === 0) {
    throw new Error("O pedido não possui produtos.");
  }

  // Calcula o subtotal com os preços oficiais.
  const subtotal = dados.itens.reduce(
    (total, item) => {
      if (
        !Number.isSafeInteger(item.quantidade) ||
        item.quantidade <= 0 ||
        !item.precoUnitario.isFinite() ||
        item.precoUnitario.lessThan(0)
      ) {
        throw new Error("Produto com valor ou quantidade inválida.");
      }

      return total.plus(
        item.precoUnitario.mul(item.quantidade)
      );
    },
    new Prisma.Decimal(0)
  );

  // Confere os valores adicionais do pedido.
  if (
    !dados.valorFrete.isFinite() ||
    dados.valorFrete.lessThan(0) ||
    !dados.valorDesconto.isFinite() ||
    dados.valorDesconto.lessThan(0)
  ) {
    throw new Error("Frete ou desconto inválido.");
  }

  // Calcula o total esperado.
  const totalCalculado = subtotal
    .plus(dados.valorFrete)
    .minus(dados.valorDesconto);

  if (
    totalCalculado.lessThanOrEqualTo(0) ||
    !totalCalculado.equals(dados.valorTotal)
  ) {
    throw new Error(
      "O valor total do pedido não corresponde aos produtos, frete e desconto."
    );
  }

  return {
    subtotal,
    totalCalculado,
  };
}