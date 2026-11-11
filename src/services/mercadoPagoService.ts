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
     // Identificador do pedido registrado no MySQL.
     pedidoId: number;
   
     // Valor final que o cliente deverá pagar.
     valorTotal: Prisma.Decimal;
   
     // Valor do frete registrado no pedido.
     valorFrete: Prisma.Decimal;
   
     // Desconto aplicado à compra.
     valorDesconto: Prisma.Decimal;
   
     // Produtos e respectivos valores originais.
     itens: ItemPagamentoMercadoPago[];
   
     // Chave persistida para evitar duplicidade da operação.
     chaveIdempotencia: string;
   };
   
   /* =========================================================
      VALIDAR URL DO CHECKOUT
      =========================================================
      Verifica o endereço antes de permitir o redirecionamento.
      Não cria cobranças e não confirma pagamentos.
      ========================================================= */
   
   export function validarUrlCheckoutMercadoPago(
     checkoutUrl: unknown,
     orderId: string
   ): string {
     if (
       typeof orderId !== "string" ||
       !/^ORD[A-Za-z0-9_-]{1,100}$/.test(orderId) ||
       typeof checkoutUrl !== "string"
     ) {
       throw new Error("URL de pagamento inválida.");
     }
   
     let urlPagamento: URL;
   
     try {
       urlPagamento = new URL(checkoutUrl);
     } catch {
       throw new Error("URL de pagamento inválida.");
     }
   
     // O link deve apontar para a mesma Order retornada pelo provedor.
     const idsNaUrl = urlPagamento.searchParams.getAll("order_id");
   
     if (
       urlPagamento.protocol !== "https:" ||
       urlPagamento.username ||
       urlPagamento.password ||
       urlPagamento.port ||
       urlPagamento.hash ||
       !(
         urlPagamento.hostname === "mercadopago.com.br" ||
         urlPagamento.hostname.endsWith(".mercadopago.com.br")
       ) ||
       idsNaUrl.length !== 1 ||
       idsNaUrl[0] !== orderId
     ) {
       throw new Error("URL de pagamento inválida.");
     }
   
     return urlPagamento.toString();
   }
   
   /* =========================================================
      VALIDAR RESPOSTA DE CRIAÇÃO
      =========================================================
      Confere os dados recebidos em tempo de execução.
      A validação TypeScript sozinha não verifica uma resposta HTTP.
      ========================================================= */
   
   export function validarRespostaCriacaoOrderMercadoPago(
     resultado: unknown,
     pedidoId: number,
     valorTotal: Prisma.Decimal
   ) {
     if (
       !resultado ||
       typeof resultado !== "object" ||
       Array.isArray(resultado)
     ) {
       throw new Error("Resposta de pagamento incompleta.");
     }
   
     const order = resultado as Record<string, unknown>;
   
     // Exige o fluxo Checkout Pro e o vínculo com o pedido oficial.
     if (
       typeof order.id !== "string" ||
       !/^ORD[A-Za-z0-9_-]{1,100}$/.test(order.id) ||
       order.type !== "online" ||
       order.processing_mode !== "manual" ||
       order.status !== "created" ||
       order.external_reference !== String(pedidoId) ||
       order.currency !== "BRL" ||
       typeof order.total_amount !== "string" ||
       !/^\d+(\.\d{1,2})?$/.test(order.total_amount) ||
       !new Prisma.Decimal(order.total_amount).equals(valorTotal)
     ) {
       throw new Error(
         "A resposta do Mercado Pago não corresponde ao pedido."
       );
     }
   
     return {
       mercadoPagoOrderId: order.id,
       checkoutUrl: validarUrlCheckoutMercadoPago(
         order.checkout_url,
         order.id
       ),
       status: order.status,
     };
   }
   
   /* =========================================================
      TIPOS PARA CONSULTA FINANCEIRA DE UMA ORDER
      =========================================================
      Representam os campos que precisamos inspecionar
      durante a conciliação.
   
      Não representam uma confirmação de pagamento.
      ========================================================= */
   
   export type TransacaoOrderMercadoPago = {
     id?: string;
     status?: string;
     status_detail?: string;
     amount?: string;
   };
   
   export type ConsultaOrderMercadoPago = {
     id?: string;
     type?: string;
     processing_mode?: string;
     currency?: string;
   
     // A consulta pode não devolver o link do checkout.
     checkout_url?: string | null;
   
     status?: string;
     status_detail?: string;
     external_reference?: string;
     total_amount?: string;
   
     // Transações financeiras associadas à Order.
     transactions?: {
       payments?: TransacaoOrderMercadoPago[];
     };
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
        3. VALIDAR OS ITENS ORIGINAIS
        =====================================================
        Confere os produtos recebidos do banco de dados.
   
        A montagem dos itens financeiros será realizada
        posteriormente, considerando o desconto aplicado.
        ===================================================== */
   
     // Valida os dados de cada produto antes do cálculo.
     for (const item of dados.itens) {
       if (
         !item.nome.trim() ||
         !Number.isSafeInteger(item.quantidade) ||
         item.quantidade <= 0 ||
         !item.precoUnitario.isFinite() ||
         item.precoUnitario.lessThan(0)
       ) {
         throw new Error("Item de pagamento inválido.");
       }
     }
   
     // Valida o valor do frete registrado no pedido.
     if (
       !dados.valorFrete.isFinite() ||
       dados.valorFrete.lessThan(0)
     ) {
       throw new Error("Valor do frete inválido.");
     }
   
     /* =====================================================
        4. VALIDAR PRODUTOS, FRETE E DESCONTO
        =====================================================
        Confere os valores oficiais registrados no MySQL.
   
        O cálculo utiliza Prisma.Decimal para evitar
        diferenças de precisão com números decimais.
        ===================================================== */
   
     // Soma os valores originais de todos os produtos.
     const subtotalProdutos = dados.itens.reduce(
       (total, item) =>
         total.plus(
           item.precoUnitario.mul(item.quantidade)
         ),
       new Prisma.Decimal(0)
     );
   
     // Verifica se o desconto informado é válido.
     if (
       !dados.valorDesconto.isFinite() ||
       dados.valorDesconto.lessThan(0)
     ) {
       throw new Error("Valor do desconto inválido.");
     }
   
     // Calcula o total que o cliente realmente deve pagar.
     const totalCalculado = subtotalProdutos
       .plus(dados.valorFrete)
       .minus(dados.valorDesconto);
   
     // Impede descontos que produzam valores inválidos.
     if (
       totalCalculado.lessThanOrEqualTo(0) ||
       !totalCalculado.equals(dados.valorTotal)
     ) {
       throw new Error(
         "O valor total não corresponde aos produtos, frete e desconto."
       );
     }
   
     // A seção seguinte aplica o desconto à linha de produtos,
     // preservando a soma exata dos valores enviados ao provedor.
   
     /* =====================================================
        PREPARAR ITENS FINANCEIROS DA ORDER
        =====================================================
        Consolida os produtos com o desconto aplicado.
   
        Evita diferenças de centavos decorrentes da
        distribuição de descontos entre várias unidades.
        ===================================================== */
   
     // Calcula o valor dos produtos após o desconto.
     const produtosComDesconto = subtotalProdutos.minus(
       dados.valorDesconto
     );
   
     // Não permite uma linha financeira negativa.
     if (produtosComDesconto.lessThan(0)) {
       throw new Error(
         "O desconto não pode superar o valor dos produtos."
       );
     }
   
     // Monta os itens financeiros que serão cobrados.
     const itensCobranca: Array<{
       title: string;
       quantity: number;
       unit_price: string;
     }> = [];
   
     // Adiciona os produtos com o desconto já aplicado.
     if (produtosComDesconto.greaterThan(0)) {
       itensCobranca.push({
         title: "Produtos Pádua Culture (desconto aplicado)",
         quantity: 1,
         unit_price: produtosComDesconto.toFixed(2),
       });
     }
   
     // Mantém o frete separado dos produtos.
     if (dados.valorFrete.greaterThan(0)) {
       itensCobranca.push({
         title: "Frete",
         quantity: 1,
         unit_price: dados.valorFrete.toFixed(2),
       });
     }
   
     // Confere o total efetivamente enviado ao provedor.
     const totalItensCobranca = itensCobranca.reduce(
       (total, item) =>
         total.plus(
           new Prisma.Decimal(item.unit_price).mul(item.quantity)
         ),
       new Prisma.Decimal(0)
     );
   
     if (!totalItensCobranca.equals(dados.valorTotal)) {
       throw new Error(
         "Os itens da cobrança não correspondem ao total do pedido."
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
   
         // Configura o retorno do comprador após o checkout.
         // Essas páginas informam o resultado ao cliente,
         // mas não confirmam pagamentos no banco de dados.
         config: {
           online: {
             success_url:
               "https://paduaculture.com.br/pagamento/sucesso",
   
             failure_url:
               "https://paduaculture.com.br/pagamento/falha",
   
             pending_url:
               "https://paduaculture.com.br/pagamento/pendente",
   
             // Retorna automaticamente ao site após a aprovação.
             auto_return: "approved",
           },
         },
   
         // Envia os valores consolidados e validados.
         items: itensCobranca,
       }),
   
       // Não segue redirecionamentos HTTP da API que recebe a credencial.
       redirect: "error",
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
   
     const resultado: unknown = await resposta.json();
   
     /* =====================================================
        7. RETORNAR DADOS VALIDADOS PARA O BACKEND
        =====================================================
        Não repete o POST automaticamente em caso de falha.
        A orquestração deverá preservar a tentativa e a chave
        para conciliar resultados incertos sem duplicar cobranças.
        ===================================================== */
   
     return validarRespostaCriacaoOrderMercadoPago(
       resultado,
       dados.pedidoId,
       dados.valorTotal
     );
   }
   
   /* =========================================================
      CONSULTAR ORDER NO MERCADO PAGO
      =========================================================
      Consulta uma order já criada pelo seu identificador.
   
      Não cria cobranças e não modifica o banco de dados.
      O resultado deverá ser conciliado com o pedido
      registrado no MySQL antes de atualizar qualquer status.
      ========================================================= */
   
   export async function consultarOrderMercadoPago(
     orderId: string
   ) {
     // 1. Verifica se o identificador foi informado.
     if (
       typeof orderId !== "string" ||
       !/^ORD[A-Za-z0-9_-]{1,100}$/.test(orderId)
     ) {
       throw new Error("Identificador da order inválido.");
     }
   
     // 2. Recupera a credencial somente no servidor.
     const accessToken =
       process.env.MERCADO_PAGO_ACCESS_TOKEN;
   
     if (!accessToken) {
       throw new Error(
         "Access Token do Mercado Pago não configurado."
       );
     }
   
     // 3. Consulta a order diretamente no Mercado Pago.
     const resposta = await fetch(
       `${MERCADO_PAGO_API}/${encodeURIComponent(orderId)}`,
       {
         method: "GET",
         headers: {
           Authorization: `Bearer ${accessToken}`,
           Accept: "application/json",
         },
         redirect: "error",
         cache: "no-store",
         signal: AbortSignal.timeout(15000),
       }
     );
   
     // 4. Interrompe a operação em caso de erro.
     if (!resposta.ok) {
       throw new Error(
         `Falha ao consultar order. HTTP ${resposta.status}.`
       );
     }
   
     // 5. Confere a estrutura antes de acessar os campos da resposta.
     const corpo: unknown = await resposta.json();
   
     if (
       !corpo ||
       typeof corpo !== "object" ||
       Array.isArray(corpo)
     ) {
       throw new Error("Resposta de consulta da Order inválida.");
     }
   
     const resultado = corpo as ConsultaOrderMercadoPago;
   
     // 6. Confere a identidade da order retornada.
     if (resultado.id !== orderId) {
       throw new Error(
         "O Mercado Pago retornou uma order diferente."
       );
     }
   
     // 7. Exige um status válido para permitir a conciliação.
     if (
       typeof resultado.status !== "string" ||
       resultado.status.trim().length === 0
     ) {
       throw new Error(
         "A consulta retornou uma order sem status válido."
       );
     }
   
     // 8. Exige a referência do pedido da Pádua Culture.
     // Essa referência será comparada com o pedido no MySQL
     // antes de qualquer atualização financeira.
     if (
       typeof resultado.external_reference !== "string" ||
       resultado.external_reference.trim().length === 0
     ) {
       throw new Error(
         "A order não possui referência externa válida."
       );
     }
   
     // 9. Exige o valor total da cobrança.
     // A comparação monetária será feita com Prisma.Decimal
     // na camada responsável pela conciliação.
     if (
       typeof resultado.total_amount !== "string" ||
       !/^\d+(\.\d{1,2})?$/.test(resultado.total_amount)
     ) {
       throw new Error(
         "A order não possui valor total válido."
       );
     }
   
     // 10. Exige o fluxo e a moeda esperados para esta integração.
     if (
       resultado.type !== "online" ||
       resultado.processing_mode !== "manual" ||
       resultado.currency !== "BRL"
     ) {
       throw new Error(
         "A Order não corresponde ao fluxo ou à moeda esperados."
       );
     }
   
     // 11. Distingue transações ausentes de uma estrutura malformada.
     if (
       resultado.transactions !== undefined &&
       (
         resultado.transactions === null ||
         typeof resultado.transactions !== "object" ||
         Array.isArray(resultado.transactions)
       )
     ) {
       throw new Error(
         "A Order possui transações em formato inválido."
       );
     }
   
     const transacoes = resultado.transactions?.payments;
   
     if (
       transacoes !== undefined &&
       (
         !Array.isArray(transacoes) ||
         transacoes.some((transacao) =>
           !transacao ||
           typeof transacao !== "object" ||
           Array.isArray(transacao)
         )
       )
     ) {
       throw new Error(
         "A Order possui pagamentos em formato inválido."
       );
     }
   
     // 12. Não inventa um link quando a consulta não o fornece.
     // O link recebido na criação deverá ser persistido pela orquestração.
     const checkoutUrl = resultado.checkout_url == null
       ? null
       : validarUrlCheckoutMercadoPago(
           resultado.checkout_url,
           orderId
         );
   
     // Retorna os dados para conciliação posterior.
     // A existência de uma Order ou URL não comprova pagamento aprovado.
     return {
       mercadoPagoOrderId: resultado.id,
       status: resultado.status,
       statusDetail: resultado.status_detail,
       referenciaExterna: resultado.external_reference,
       valorTotal: resultado.total_amount,
       checkoutUrl,
       transacoes: transacoes ?? [],
     };
   }