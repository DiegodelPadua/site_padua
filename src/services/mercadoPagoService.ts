
/* =========================================================
   MERCADO PAGO SERVICE - PÁDUA CULTURE
   =========================================================
   Integração com Checkout Pro pela API de Orders.

   Este serviço:
   - Recebe dados de um pedido já validado.
   - Cria uma order no Mercado Pago.
   - Retorna o ID e a URL de pagamento.

   Não deve ser chamado diretamente pelo navegador.
   ========================================================= */

import { Prisma } from "@prisma/client";

const MERCADO_PAGO_API =
  "https://api.mercadopago.com/v1/orders";

/* =========================================================
   TIPOS DE DADOS
   ========================================================= */

export type ItemPagamentoMercadoPago = {
  nome: string;
  quantidade: number;
  precoUnitario: Prisma.Decimal;
};

export type DadosPagamentoMercadoPago = {
  pedidoId: number;
  valorTotal: Prisma.Decimal;
  itens: ItemPagamentoMercadoPago[];

  // Chave persistida e reutilizada nas tentativas
  // de repetição da mesma operação.
  chaveIdempotencia: string;
};

type RespostaOrderMercadoPago = {
  id?: string;
  checkout_url?: string;
  status?: string;
};

/* =========================================================
   CRIAR ORDER DE PAGAMENTO
   ========================================================= */

export async function criarOrderMercadoPago(
  dados: DadosPagamentoMercadoPago
) {
  /* =====================================================
     1. VALIDAR CONFIGURAÇÃO
     ===================================================== */

  const accessToken =
    process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error(
      "Access Token do Mercado Pago não configurado."
    );
  }

  /* =====================================================
     2. VALIDAR IDENTIFICADORES E VALORES
     ===================================================== */

  if (
    !Number.isSafeInteger(dados.pedidoId) ||
    dados.pedidoId <= 0
  ) {
    throw new Error("Identificador do pedido inválido.");
  }

  if (
    !dados.valorTotal.isFinite() ||
    dados.valorTotal.lessThanOrEqualTo(0)
  ) {
    throw new Error("Valor do pedido inválido.");
  }

  if (
    !Array.isArray(dados.itens) ||
    dados.itens.length === 0
  ) {
    throw new Error("Pedido sem itens para pagamento.");
  }

  // UUID válido, gerado e persistido pelo backend.
  const formatoUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!formatoUUID.test(dados.chaveIdempotencia)) {
    throw new Error("Chave de idempotência inválida.");
  }

  /* =====================================================
     3. PREPARAR OS ITENS
     ===================================================== */

  const itens = dados.itens.map((item) => {
    if (
      !item.nome.trim() ||
      !Number.isSafeInteger(item.quantidade) ||
      item.quantidade <= 0 ||
      !item.precoUnitario.isFinite() ||
      item.precoUnitario.lessThan(0)
    ) {
      throw new Error("Item de pagamento inválido.");
    }

    return {
      title: item.nome,
      quantity: item.quantidade,
      unit_price: item.precoUnitario.toFixed(2),
    };
  });

  /* =====================================================
     4. CONFERIR A SOMA DOS ITENS
     =====================================================
     O Mercado Pago exige que a soma dos itens
     corresponda ao total da order.
     ===================================================== */

  const somaItens = dados.itens.reduce(
    (total, item) =>
      total.plus(
        item.precoUnitario.mul(item.quantidade)
      ),
    new Prisma.Decimal(0)
  );

  if (!somaItens.equals(dados.valorTotal)) {
    throw new Error(
      "A soma dos itens não corresponde ao valor total."
    );
  }

  /* =====================================================
     5. ENVIAR REQUISIÇÃO AO MERCADO PAGO
     ===================================================== */

  const resposta = await fetch(MERCADO_PAGO_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Idempotency-Key": dados.chaveIdempotencia,
    },
    body: JSON.stringify({
      type: "online",
      processing_mode: "manual",
      total_amount: dados.valorTotal.toFixed(2),
      external_reference: String(dados.pedidoId),
      items: itens,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  /* =====================================================
     6. VALIDAR RESPOSTA
     ===================================================== */

  if (!resposta.ok) {
    // Não registrar o corpo da resposta ou credenciais
    // em logs de produção.
    throw new Error(
      `Mercado Pago retornou HTTP ${resposta.status}.`
    );
  }

  const resultado =
    (await resposta.json()) as RespostaOrderMercadoPago;

  if (
    typeof resultado.id !== "string" ||
    !resultado.id ||
    typeof resultado.checkout_url !== "string"
  ) {
    throw new Error(
      "Resposta de pagamento incompleta."
    );
  }

  // Verifica se a URL pertence a um domínio HTTPS
  // esperado do Mercado Pago.
  const urlPagamento = new URL(resultado.checkout_url);

  if (
    urlPagamento.protocol !== "https:" ||
    !(
      urlPagamento.hostname === "mercadopago.com.br" ||
      urlPagamento.hostname.endsWith(".mercadopago.com.br")
    )
  ) {
    throw new Error(
      "URL de pagamento inválida."
    );
  }

  /* =====================================================
     7. RETORNAR DADOS PARA O BACKEND
     ===================================================== */

  return {
    mercadoPagoOrderId: resultado.id,
    checkoutUrl: urlPagamento.toString(),
    status: resultado.status ?? "created",
  };
}
