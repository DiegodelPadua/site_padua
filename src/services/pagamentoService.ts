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

// Operações financeiras realizadas no MySQL.
import {
  buscarDadosPedidoMercadoPago,
  registrarTentativaPagamento,
  buscarTentativaMercadoPago,
  reservarExecucaoCobranca,
} from "../repositories/pagamentoRepository";

// Serviços de criação e consulta de cobranças no Mercado Pago.
import {
  criarOrderMercadoPago,
  consultarOrderMercadoPago,
} from "./mercadoPagoService";



import type {
  TransacaoOrderMercadoPago,
} from "./mercadoPagoService";

import {
  interpretarStatusTransacaoMercadoPago,
} from "../utils/mercadoPagoStatus";
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


/* =========================================================
   PREPARAR DADOS DA COBRANÇA MERCADO PAGO
   =========================================================
   Recupera o pedido e a tentativa financeira.

   Utiliza somente informações oficiais do MySQL.

   Não envia a cobrança neste momento.
   ========================================================= */

export async function prepararDadosCobrancaMercadoPago(
  pedidoId: number,
  usuarioId: number,
  pagamentoId: number
) {
  // 1. Recupera o pedido pertencente ao cliente.
  const pedido = await buscarDadosPedidoMercadoPago(
    pedidoId,
    usuarioId
  );

  // 2. Valida os valores financeiros do pedido.
  validarValoresPedido({
    valorTotal: pedido.valorTotal,
    valorFrete: pedido.valorFrete,
    valorDesconto: pedido.valorDesconto,
    itens: pedido.itens,
  });

  // 3. Recupera a tentativa financeira já registrada.
  const pagamento = await buscarTentativaMercadoPago(
    pagamentoId,
    pedidoId
  );

  // 4. Confere se a tentativa corresponde ao total do pedido.
  if (!pagamento.valor.equals(pedido.valorTotal)) {
    throw new Error(
      "O valor da tentativa não corresponde ao pedido."
    );
  }

  // 5. Impede continuar com uma tentativa já finalizada.
  if (
    pagamento.status !== "PENDENTE" &&
    pagamento.status !== "PROCESSANDO"
  ) {
    throw new Error(
      "Esta tentativa não está disponível para cobrança."
    );
  }

  // 6. Retorna os dados necessários para a integração.
  return {
    pagamentoId: pagamento.id,
    pedidoId: pedido.id,
    chaveIdempotencia: pagamento.chaveIdempotencia,
    valorTotal: pedido.valorTotal,
    valorFrete: pedido.valorFrete,
    valorDesconto: pedido.valorDesconto,
    itens: pedido.itens.map((item) => ({
      nome: item.nomeProduto,
      quantidade: item.quantidade,
      precoUnitario: item.precoUnitario,
    })),
  };
}


/* =========================================================
   AUTORIZAR EXECUÇÃO DA COBRANÇA
   =========================================================
   Prepara os dados e solicita ao repositório
   a autorização transacional para iniciar a cobrança.

   Não chama a API do Mercado Pago neste momento.
   ========================================================= */

export async function autorizarCobrancaMercadoPago(
  pedidoId: number,
  usuarioId: number,
  pagamentoId: number
) {
  // 1. Recupera os dados oficiais do pedido e do pagamento.
  const dados = await prepararDadosCobrancaMercadoPago(
    pedidoId,
    usuarioId,
    pagamentoId
  );

  // 2. Recupera a tentativa financeira atualizada.
  const tentativa = await buscarTentativaMercadoPago(
    pagamentoId,
    pedidoId
  );

  // 3. Não inicia uma segunda cobrança se já existir
  // um identificador externo vinculado à tentativa.
  if (tentativa.identificadorExterno) {
    throw new Error(
      "Esta tentativa já possui uma cobrança no Mercado Pago."
    );
  }

  // 4. Solicita a autorização transacional.
  // O repositório verifica novamente o status do pedido,
  // a reserva de estoque e a situação do pagamento.
  const autorizado = await reservarExecucaoCobranca(
    pagamentoId,
    pedidoId
  );

  // 5. Impede que outra requisição execute a mesma cobrança.
  if (!autorizado) {
    throw new Error(
      "Esta tentativa já está em processamento. Aguarde."
    );
  }

  // 6. Retorna os dados autorizados para a próxima etapa.
  return dados;
}


/* =========================================================
   CONFERIR COBRANÇA COM O PEDIDO
   =========================================================
   Compara os dados retornados pelo Mercado Pago
   com os dados oficiais registrados no MySQL.

   Esta função somente consulta e valida.
   Não confirma pagamentos e não altera estoque.
   ========================================================= */

export async function conferirCobrancaMercadoPago(
  pedidoId: number,
  usuarioId: number,
  pagamentoId: number
) {
  // 1. Recupera os dados oficiais do pedido.
  const pedido = await buscarDadosPedidoMercadoPago(
    pedidoId,
    usuarioId
  );

  // 2. Recupera a tentativa financeira registrada.
  const pagamento = await buscarTentativaMercadoPago(
    pagamentoId,
    pedidoId
  );

  // 3. Exige um identificador externo já persistido.
  if (!pagamento.identificadorExterno) {
    throw new Error(
      "Esta tentativa ainda não possui uma Order vinculada."
    );
  }

  // 4. Consulta a Order diretamente no Mercado Pago.
  const order = await consultarOrderMercadoPago(
    pagamento.identificadorExterno
  );

  // 5. Compara a referência externa com o pedido.
  if (order.referenciaExterna !== String(pedido.id)) {
    throw new Error(
      "A referência da cobrança não corresponde ao pedido."
    );
  }

  // 6. Compara o valor da Order com o total oficial.
  // Utilizamos Decimal para evitar erros de ponto flutuante.
  const valorMercadoPago = new Prisma.Decimal(
    order.valorTotal!
  );

  if (!valorMercadoPago.equals(pedido.valorTotal)) {
    throw new Error(
      "O valor cobrado não corresponde ao total do pedido."
    );
  }

  // 7. Confere também o valor da tentativa financeira.
  if (!pagamento.valor.equals(pedido.valorTotal)) {
    throw new Error(
      "O valor da tentativa não corresponde ao pedido."
    );
  }

  // 8. Retorna o resultado para a futura conciliação.
  // Não considera o pagamento aprovado automaticamente.
  return {
    pedidoId: pedido.id,
    pagamentoId: pagamento.id,
    mercadoPagoOrderId: order.mercadoPagoOrderId,
    statusMercadoPago: order.status,
    statusDetalhado: order.statusDetail,
    valorConferido: pedido.valorTotal.toFixed(2),
    identidadeConferida: true,
  };
}



/* =========================================================
   VALIDAR TRANSAÇÕES FINANCEIRAS DO MERCADO PAGO
   =========================================================
   Analisa as transações associadas a uma Order.

   Regras:
   - Exige uma transação aprovada.
   - Confere o valor da transação.
   - Rejeita dados incompletos ou ambíguos.
   - Não altera pagamentos ou pedidos.

   Esta validação deve ser utilizada somente após
   consultar a Order diretamente no Mercado Pago.
   ========================================================= */

export function validarTransacoesMercadoPago(
  transacoes: TransacaoOrderMercadoPago[],
  valorPedido: Prisma.Decimal
) {
  // 1. Confere se o pedido possui valor válido.
  if (
    !valorPedido.isFinite() ||
    valorPedido.lessThanOrEqualTo(0)
  ) {
    throw new Error("Valor do pedido inválido.");
  }

  // 2. Exige transações financeiras para análise.
  if (!Array.isArray(transacoes) || transacoes.length === 0) {
    throw new Error(
      "A Order ainda não possui transações financeiras."
    );
  }

  // 3. Identifica as transações aprovadas.
  const aprovadas = transacoes.filter((transacao) => {
    if (typeof transacao.status !== "string") {
      return false;
    }

    const interpretacao =
      interpretarStatusTransacaoMercadoPago(
        transacao.status
      );

    return interpretacao.aprovado;
  });

  // 4. Não confirma uma compra sem aprovação financeira.
  if (aprovadas.length === 0) {
    return {
      aprovado: false,
      motivo: "Nenhuma transação aprovada encontrada.",
    };
  }

  // 5. Exige revisão quando houver múltiplas aprovações.
  // Não somamos automaticamente cobranças diferentes.
  if (aprovadas.length !== 1) {
    throw new Error(
      "Foram encontradas múltiplas transações aprovadas."
    );
  }

  const transacao = aprovadas[0];

  // 6. Confere a identificação da transação.
  if (
    typeof transacao.id !== "string" ||
    !transacao.id.trim()
  ) {
    throw new Error(
      "A transação aprovada não possui identificador válido."
    );
  }

  // 7. Confere o formato do valor recebido.
  if (
    typeof transacao.amount !== "string" ||
    !/^\d+(\.\d{1,2})?$/.test(transacao.amount)
  ) {
    throw new Error(
      "A transação aprovada possui valor inválido."
    );
  }

  // 8. Compara o valor com o pedido usando Decimal.
  const valorTransacao = new Prisma.Decimal(
    transacao.amount
  );

  if (!valorTransacao.equals(valorPedido)) {
    throw new Error(
      "O valor aprovado não corresponde ao pedido."
    );
  }

  // 9. Retorna a identificação da aprovação.
  // Ainda não autoriza confirmação automática do pedido.
  return {
    aprovado: true,
    transacaoId: transacao.id,
    valor: valorTransacao.toFixed(2),
    motivo: "Transação aprovada e valor correspondente.",
  };
}



/* =========================================================
   CONCILIAR COBRANÇA MERCADO PAGO
   =========================================================
   Consulta uma única vez a Order no Mercado Pago.

   Confere:
   - Vínculo do pagamento ao pedido.
   - Identificador externo da Order.
   - Referência do pedido.
   - Valor da Order e da tentativa financeira.
   - Transações associadas à cobrança.

   Não altera o banco de dados.
   Não confirma automaticamente o pedido.
   ========================================================= */

export async function conciliarCobrancaMercadoPago(
  pedidoId: number,
  usuarioId: number,
  pagamentoId: number
) {
  // 1. Recupera os dados oficiais do pedido.
  const pedido = await buscarDadosPedidoMercadoPago(
    pedidoId,
    usuarioId
  );

  // 2. Recupera a tentativa financeira vinculada ao pedido.
  const pagamento = await buscarTentativaMercadoPago(
    pagamentoId,
    pedidoId
  );

  // 3. Exige uma Order previamente vinculada ao pagamento.
  if (!pagamento.identificadorExterno) {
    throw new Error(
      "O pagamento ainda não possui uma Order vinculada."
    );
  }

  // 4. Consulta o Mercado Pago uma única vez.
  const order = await consultarOrderMercadoPago(
    pagamento.identificadorExterno
  );

  // 5. Confere a identidade da Order.
  if (
    order.mercadoPagoOrderId !==
    pagamento.identificadorExterno
  ) {
    throw new Error(
      "A Order consultada não corresponde ao pagamento."
    );
  }

  // 6. Confere a referência externa do pedido.
  if (order.referenciaExterna !== String(pedido.id)) {
    throw new Error(
      "A referência da Order não corresponde ao pedido."
    );
  }

  // 7. Confere o valor total da cobrança.
  const valorOrder = new Prisma.Decimal(
    order.valorTotal!
  );

  if (
    !valorOrder.equals(pedido.valorTotal) ||
    !pagamento.valor.equals(pedido.valorTotal)
  ) {
    throw new Error(
      "Os valores da cobrança não correspondem ao pedido."
    );
  }

// 8. Verifica se a Order está em um estado compatível
// com a análise de uma possível aprovação financeira.
//
// Esta é uma proteção preliminar. Os estados precisam
// ser confirmados nos testes da integração utilizada.
const statusOrder = order.status.trim().toLowerCase();

if (
  statusOrder === "canceled" ||
  statusOrder === "cancelled" ||
  statusOrder === "failed"
) {
  throw new Error(
    "A Order foi cancelada ou falhou. Exige conciliação."
  );
}

// 9. Analisa as transações retornadas pelo provedor.
// O resultado ainda não autoriza confirmar o pedido.
const validacao = validarTransacoesMercadoPago(
  order.transacoes,
  pedido.valorTotal
);


  // 9. Retorna os dados para análise posterior.
  // Uma transação aprovada ainda não autoriza,
  // isoladamente, a confirmação do pedido.
  return {
    pedidoId: pedido.id,
    pagamentoId: pagamento.id,
    mercadoPagoOrderId: order.mercadoPagoOrderId,
    statusOrder: order.status,
    transacaoAprovada: validacao.aprovado,
    transacaoId:
      "transacaoId" in validacao
        ? validacao.transacaoId
        : null,
    valorConferido: pedido.valorTotal.toFixed(2),
    motivo: validacao.motivo,
  };
}

