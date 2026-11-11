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

   A criação externa fica concentrada em iniciarPagamentoMercadoPago.
   ========================================================= */

// Tipos do Prisma utilizados nos cálculos financeiros.
import { MetodoPagamento, Prisma } from "@prisma/client";

// Operações financeiras realizadas no MySQL.
import {
  buscarDadosPedidoMercadoPago,
  registrarTentativaPagamento,
  buscarTentativaMercadoPago,
  reservarExecucaoCobranca,
  registrarIdentificadorMercadoPago,
  buscarPagamentoPorOrderMercadoPago,
  confirmarPagamentoMercadoPago,
} from "../repositories/pagamentoRepository";
// Serviços de criação e consulta de cobranças no Mercado Pago.
import {
  criarOrderMercadoPago,
  consultarOrderMercadoPago,
  validarUrlCheckoutMercadoPago,
} from "./mercadoPagoService";

import type {
  TransacaoOrderMercadoPago,
} from "./mercadoPagoService";

import {
  interpretarStatusTransacaoMercadoPago,
} from "../utils/mercadoPagoStatus";

/* Erros esperados para a futura rota responder sem expor detalhes internos. */
export class PagamentoServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly codigo: string
  ) {
    super(message);
    this.name = "PagamentoServiceError";
  }
}

// Confere o estado local antes de criar ou devolver um link de pagamento.
function validarPedidoAguardandoPagamento(pedido: {
  status: string;
  reservaExpiraEm: Date | null;
}) {
  if (pedido.status !== "AGUARDANDO_PAGAMENTO") {
    throw new PagamentoServiceError(
      "Este pedido não está disponível para pagamento.",
      409,
      "PEDIDO_INDISPONIVEL"
    );
  }

  if (
    !pedido.reservaExpiraEm ||
    pedido.reservaExpiraEm.getTime() <= Date.now()
  ) {
    throw new PagamentoServiceError(
      "A reserva expirou. Verifique a situação do pedido antes de continuar.",
      409,
      "RESERVA_EXPIRADA"
    );
  }
}

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
  // null indica que o cliente ainda escolherá o método no Mercado Pago.
  metodo: MetodoPagamento | null
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
        item.precoUnitario.lessThan(0) ||
        item.precoUnitario.decimalPlaces() > 2
      ) {
        throw new Error("Produto com valor ou quantidade inválida.");
      }

      return total.plus(
        item.precoUnitario.mul(item.quantidade)
      );
    },
    new Prisma.Decimal(0)
  );

  // Confere os valores adicionais e a precisão monetária.
  if (
    !dados.valorFrete.isFinite() ||
    dados.valorFrete.lessThan(0) ||
    !dados.valorDesconto.isFinite() ||
    dados.valorDesconto.lessThan(0) ||
    dados.valorFrete.decimalPlaces() > 2 ||
    dados.valorDesconto.decimalPlaces() > 2 ||
    !dados.valorTotal.isFinite() ||
    dados.valorTotal.decimalPlaces() > 2
  ) {
    throw new Error("Frete ou desconto inválido.");
  }

  // Calcula o total esperado.
  const totalCalculado = subtotal
    .plus(dados.valorFrete)
    .minus(dados.valorDesconto);

  if (
    totalCalculado.lessThanOrEqualTo(0) ||
    dados.valorDesconto.greaterThan(subtotal) ||
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

  // A chave precisa ser válida antes de reservar a execução da cobrança.
  const chaveIdempotencia = pagamento.chaveIdempotencia;
  const formatoUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    typeof chaveIdempotencia !== "string" ||
    !formatoUUID.test(chaveIdempotencia)
  ) {
    throw new PagamentoServiceError(
      "A tentativa exige verificação antes de continuar.",
      409,
      "CHAVE_INVALIDA"
    );
  }

  // 6. Retorna os dados necessários para a integração.
  return {
    pagamentoId: pagamento.id,
    pedidoId: pedido.id,
    chaveIdempotencia,
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
    throw new PagamentoServiceError(
      "Esta tentativa já está em processamento. Aguarde.",
      409,
      "PAGAMENTO_EM_PROCESSAMENTO"
    );
  }

  // 6. Retorna os dados autorizados para a próxima etapa.
  return dados;
}

/* =========================================================
   RETOMAR CHECKOUT DE UMA ORDER JÁ VINCULADA
   =========================================================
   Consulta o provedor e usa o link persistido.
   Não cria outra Order e não confirma pagamentos.
   ========================================================= */

async function retomarCheckoutMercadoPago(
  pedidoId: number,
  usuarioId: number,
  pagamentoId: number
) {
  const pedido = await buscarDadosPedidoMercadoPago(
    pedidoId,
    usuarioId
  );

  validarPedidoAguardandoPagamento(pedido);
  validarValoresPedido(pedido);

  const tentativa = await buscarTentativaMercadoPago(
    pagamentoId,
    pedidoId
  );

  if (
    !tentativa.identificadorExterno ||
    (
      tentativa.status !== "PENDENTE" &&
      tentativa.status !== "PROCESSANDO"
    ) ||
    !tentativa.valor.equals(pedido.valorTotal)
  ) {
    throw new PagamentoServiceError(
      "Esta tentativa exige verificação antes de continuar.",
      409,
      "CONCILIACAO_NECESSARIA"
    );
  }

  let order: Awaited<ReturnType<typeof consultarOrderMercadoPago>>;

  try {
    order = await consultarOrderMercadoPago(
      tentativa.identificadorExterno
    );
  } catch {
    throw new PagamentoServiceError(
      "Não foi possível consultar o pagamento. A tentativa foi preservada.",
      502,
      "CONSULTA_INDISPONIVEL"
    );
  }

  if (
    order.mercadoPagoOrderId !== tentativa.identificadorExterno ||
    order.referenciaExterna !== String(pedidoId) ||
    !new Prisma.Decimal(order.valorTotal).equals(pedido.valorTotal)
  ) {
    throw new PagamentoServiceError(
      "Os dados do pagamento exigem conciliação.",
      409,
      "CONCILIACAO_NECESSARIA"
    );
  }

  // Somente uma Order criada e sem transações pode voltar ao checkout.
  // Pagamentos pendentes, processados ou com estado desconhecido exigem
  // acompanhamento financeiro, em vez de oferecer nova cobrança.
  if (order.status !== "created" || order.transacoes.length > 0) {
    throw new PagamentoServiceError(
      "O pagamento já possui movimentação ou não está disponível para continuar.",
      409,
      "CONCILIACAO_NECESSARIA"
    );
  }

  let checkoutUrl = tentativa.checkoutUrl;

  // Completa um registro antigo somente se o provedor fornecer o link.
  // Não reconstrói URLs e não repete o POST para tentar obter outra URL.
  if (!checkoutUrl) {
    if (!order.checkoutUrl) {
      throw new PagamentoServiceError(
        "O link desta tentativa está indisponível. O pagamento exige verificação.",
        409,
        "LINK_INDISPONIVEL"
      );
    }

    const chave = tentativa.chaveIdempotencia;

    if (!chave) {
      throw new PagamentoServiceError(
        "A tentativa exige verificação antes de continuar.",
        409,
        "CHAVE_INVALIDA"
      );
    }

    const salvo = await registrarIdentificadorMercadoPago(
      pagamentoId,
      chave,
      tentativa.identificadorExterno,
      order.checkoutUrl
    );

    checkoutUrl = salvo.checkoutUrl;
  }

  // A consulta externa pode levar tempo: confere novamente o estado local.
  const pedidoAtual = await buscarDadosPedidoMercadoPago(
    pedidoId,
    usuarioId
  );

  validarPedidoAguardandoPagamento(pedidoAtual);

  const tentativaAtual = await buscarTentativaMercadoPago(
    pagamentoId,
    pedidoId
  );

  if (
    tentativaAtual.identificadorExterno !== tentativa.identificadorExterno ||
    (
      tentativaAtual.status !== "PENDENTE" &&
      tentativaAtual.status !== "PROCESSANDO"
    ) ||
    !tentativaAtual.valor.equals(pedidoAtual.valorTotal) ||
    !new Prisma.Decimal(order.valorTotal).equals(pedidoAtual.valorTotal) ||
    !checkoutUrl ||
    tentativaAtual.checkoutUrl !== checkoutUrl
  ) {
    throw new PagamentoServiceError(
      "A situação do pagamento mudou. Verifique o pedido antes de continuar.",
      409,
      "CONCILIACAO_NECESSARIA"
    );
  }

  return {
    pedidoId,
    pagamentoId,
    checkoutUrl: validarUrlCheckoutMercadoPago(
      checkoutUrl,
      tentativa.identificadorExterno
    ),
  };
}

/* =========================================================
   INICIAR OU RETOMAR PAGAMENTO MERCADO PAGO
   =========================================================
   Recebe o ID de um pedido existente e o usuário da sessão.
   Não cria pedidos e não confirma aprovação financeira.
   Mantém a tentativa bloqueada quando o resultado é incerto.
   ========================================================= */

export async function iniciarPagamentoMercadoPago(
  pedidoId: number,
  usuarioId: number
) {
  if (
    !Number.isSafeInteger(pedidoId) ||
    pedidoId <= 0 ||
    !Number.isSafeInteger(usuarioId) ||
    usuarioId <= 0
  ) {
    throw new PagamentoServiceError(
      "Identificadores inválidos.",
      400,
      "DADOS_INVALIDOS"
    );
  }

  // Bloqueado por padrão. A futura configuração deve usar a conta vendedora
  // de teste do Mercado Pago; o valor desta variável não valida a credencial.
  if (process.env.MERCADO_PAGO_CHECKOUT_MODO !== "teste") {
    throw new PagamentoServiceError(
      "O início de pagamento ainda não está habilitado.",
      503,
      "PAGAMENTO_DESABILITADO"
    );
  }

  // Confere a presença da configuração antes de reservar uma execução.
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    throw new PagamentoServiceError(
      "O serviço de pagamento está indisponível.",
      503,
      "CONFIGURACAO_INDISPONIVEL"
    );
  }

  // O usuarioId deve vir exclusivamente da sessão validada pela futura rota.
  const pedido = await buscarDadosPedidoMercadoPago(
    pedidoId,
    usuarioId
  );

  validarPedidoAguardandoPagamento(pedido);
  validarValoresPedido(pedido);

  // null mantém a escolha do método para o checkout do Mercado Pago.
  const preparada = await prepararPagamento(
    pedidoId,
    usuarioId,
    null
  );

  const tentativa = await buscarTentativaMercadoPago(
    preparada.pagamentoId,
    pedidoId
  );

  if (tentativa.identificadorExterno) {
    const checkout = await retomarCheckoutMercadoPago(
      pedidoId,
      usuarioId,
      tentativa.id
    );

    return { ...checkout, retomado: true };
  }

  // PROCESSANDO sem ID pode representar uma Order criada antes de um timeout.
  // Não troca a chave, não reinicia a tentativa e não cria outra cobrança.
  if (tentativa.status !== "PENDENTE" || tentativa.checkoutUrl) {
    throw new PagamentoServiceError(
      "Esta tentativa está em verificação. Aguarde a conciliação para continuar.",
      409,
      "CONCILIACAO_NECESSARIA"
    );
  }

  // O repositório permite apenas uma execução por tentativa.
  const dados = await autorizarCobrancaMercadoPago(
    pedidoId,
    usuarioId,
    tentativa.id
  );

  let order: Awaited<ReturnType<typeof criarOrderMercadoPago>>;

  try {
    order = await criarOrderMercadoPago(dados);
  } catch {
    // A falha não prova que o provedor deixou de criar a Order.
    // Preserva PROCESSANDO para impedir uma nova criação automática.
    throw new PagamentoServiceError(
      "Não foi possível concluir o início do pagamento. A tentativa ficou em verificação.",
      502,
      "RESULTADO_INDETERMINADO"
    );
  }

  try {
    // ID e URL são persistidos antes de oferecer redirecionamento.
    await registrarIdentificadorMercadoPago(
      tentativa.id,
      dados.chaveIdempotencia,
      order.mercadoPagoOrderId,
      order.checkoutUrl
    );
  } catch {
    throw new PagamentoServiceError(
      "A tentativa exige conciliação antes de continuar o pagamento.",
      503,
      "CONCILIACAO_NECESSARIA"
    );
  }

  // Confere novamente provedor, reserva e tentativa antes de devolver o link.
  const checkout = await retomarCheckoutMercadoPago(
    pedidoId,
    usuarioId,
    tentativa.id
  );

  return { ...checkout, retomado: false };
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

  // 3. Exige revisão se alguma transação apresentar
  // informações incompletas ou status desconhecido.
  // Não autorizamos aprovação diante de dados ambíguos.
  for (const transacao of transacoes) {
    if (
      typeof transacao.status !== "string" ||
      !transacao.status.trim()
    ) {
      throw new Error(
        "A Order contém uma transação sem status válido."
      );
    }

    // Interpreta o status de cada transação.
    const interpretacao =
      interpretarStatusTransacaoMercadoPago(transacao.status);

    // Status desconhecidos e estornos exigem análise.
    if (interpretacao.exigeRevisao) {
      throw new Error(
        "A Order contém uma transação que exige revisão financeira."
      );
    }

    // Não aceitamos transações sem identificação.
    if (
      typeof transacao.id !== "string" ||
      !transacao.id.trim()
    ) {
      throw new Error(
        "A Order contém uma transação sem identificador."
      );
    }
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

/* =========================================================
   PROCESSAR NOTIFICAÇÃO AUTENTICADA DO MERCADO PAGO
   =========================================================
   A rota valida a assinatura antes de chamar esta função.
   Aprovação exige consulta ao provedor e gravação atômica.
   Esta etapa permanece restrita a uma conta de teste.
   ========================================================= */

async function consultarVendedorTesteAutenticado() {
  const accessToken =
    process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error("Credencial de teste não configurada.");
  }

  const resposta = await fetch(
    "https://api.mercadopago.com/users/me",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    }
  );

  if (!resposta.ok) {
    throw new Error(
      "Não foi possível verificar a conta de teste."
    );
  }

  const corpo: unknown = await resposta.json();

  if (
    !corpo ||
    typeof corpo !== "object" ||
    Array.isArray(corpo)
  ) {
    throw new Error("Conta de teste inválida.");
  }

  const conta = corpo as Record<string, unknown>;

  const id =
    typeof conta.id === "string" &&
    /^[1-9]\d*$/.test(conta.id)
      ? conta.id
      : typeof conta.id === "number" &&
          Number.isSafeInteger(conta.id) &&
          conta.id > 0
        ? String(conta.id)
        : null;

  if (
    !id ||
    conta.site_id !== "MLB" ||
    !Array.isArray(conta.tags) ||
    !conta.tags.includes("test_user")
  ) {
    throw new Error(
      "A conta autenticada não foi reconhecida como conta brasileira de teste."
    );
  }

  return id;
}

export async function processarNotificacaoMercadoPago(
  orderId: string
) {
  if (process.env.MERCADO_PAGO_CHECKOUT_MODO !== "teste") {
    return {
      processado: false,
      confirmado: false,
      motivo: "CONCILIACAO_DESABILITADA",
    };
  }

  if (!/^ORD[A-Za-z0-9_-]{1,100}$/.test(orderId)) {
    throw new Error("Identificador da Order inválido.");
  }

  const pagamento =
    await buscarPagamentoPorOrderMercadoPago(orderId);

  if (!pagamento) {
    return {
      processado: false,
      confirmado: false,
      motivo: "VINCULO_PENDENTE",
    };
  }

  // Consultas independentes em paralelo.
  // Nenhuma escrita acontece antes das verificações.
  const [order, vendedorId] = await Promise.all([
    consultarOrderMercadoPago(orderId),
    consultarVendedorTesteAutenticado(),
  ]);

  const valor = new Prisma.Decimal(order.valorTotal);

  if (
    order.mercadoPagoOrderId !== orderId ||
    order.referenciaExterna !== String(pagamento.pedidoId) ||
    order.vendedorId !== vendedorId ||
    order.liveMode === true ||
    !valor.isFinite() ||
    valor.lessThanOrEqualTo(0) ||
    !valor.equals(pagamento.valor) ||
    !valor.equals(pagamento.pedido.valorTotal) ||
    order.possuiAjustesFinanceiros
  ) {
    return {
      processado: false,
      confirmado: false,
      motivo: "DADOS_EXIGEM_REVISAO",
    };
  }

  const estado = order.status.trim().toLowerCase();
  const detalhe = order.statusDetail?.trim().toLowerCase();

  if (
    ["created", "processing", "action_required"].includes(estado)
  ) {
    const semRecebimento =
      order.valorTotalPago === null ||
      new Prisma.Decimal(order.valorTotalPago).equals(0);

    const transacoesPendentes = order.transacoes.every(
      (transacao) =>
        [
          "created",
          "pending",
          "in_process",
          "processing",
          "action_required",
          "rejected",
          "failed",
          "canceled",
          "cancelled",
        ].includes(transacao.status ?? "") &&
        (
          transacao.paid_amount === undefined ||
          new Prisma.Decimal(transacao.paid_amount).equals(0)
        )
    );

    return {
      processado: semRecebimento && transacoesPendentes,
      confirmado: false,
      motivo:
        semRecebimento && transacoesPendentes
          ? "PENDENTE"
          : "DADOS_EXIGEM_REVISAO",
    };
  }

  // Não soma várias transações nem interpreta captura pendente como crédito.
  if (
    estado !== "processed" ||
    detalhe !== "accredited" ||
    order.transacoes.length !== 1
  ) {
    return {
      processado: false,
      confirmado: false,
      motivo: "ESTADO_EXIGE_REVISAO",
    };
  }

  const transacao = order.transacoes[0];
  const metodo = transacao.payment_method;

  const metodoConfirmado =
    metodo?.id === "pix" && metodo.type === "bank_transfer"
      ? MetodoPagamento.PIX
      : metodo &&
          [
            "credit_card",
            "debit_card",
            "prepaid_card",
          ].includes(metodo.type ?? "")
        ? MetodoPagamento.CARTAO
        : null;

  if (
    !transacao.id ||
    !/^[A-Za-z0-9_-]{1,150}$/.test(transacao.id) ||
    transacao.status !== "processed" ||
    transacao.status_detail !== "accredited" ||
    !metodoConfirmado ||
    order.valorTotalPago === null ||
    transacao.amount === undefined ||
    transacao.paid_amount === undefined ||
    !new Prisma.Decimal(order.valorTotalPago).equals(valor) ||
    !new Prisma.Decimal(transacao.amount).equals(valor) ||
    !new Prisma.Decimal(transacao.paid_amount).equals(valor)
  ) {
    return {
      processado: false,
      confirmado: false,
      motivo: "COMPROVANTE_EXIGE_REVISAO",
    };
  }

  const resultado = await confirmarPagamentoMercadoPago(
    pagamento.id,
    pagamento.pedidoId,
    orderId,
    valor,
    {
      transacaoId: transacao.id,
      metodo: metodoConfirmado,
    }
  );

  return {
    processado: true,
    confirmado: resultado.confirmado,
    jaConfirmado: resultado.jaConfirmado,
    exigeRevisao: resultado.exigeRevisao,
    motivo: resultado.exigeRevisao
      ? "PAGAMENTO_RECEBIDO_REVISAO_MANUAL"
      : "CONFIRMADO",
  };
}