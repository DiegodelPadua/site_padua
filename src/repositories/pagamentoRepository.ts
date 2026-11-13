/* =========================================================
   PAGAMENTO REPOSITORY - PÁDUA CULTURE
   =========================================================
   Responsável pelas consultas e operações de banco
   relacionadas aos pagamentos.

   Fluxo:
   Controller -> Service -> Repository -> Prisma -> MySQL
   ========================================================= */

   import { prisma } from "../../lib/prisma";

   // Tipos e status utilizados nas operações financeiras.
   import {
     Prisma,
     MetodoPagamento,
     StatusPagamento,
     StatusPedido,
   } from "@prisma/client";
   
   /* =========================================================
      BUSCAR PEDIDO DO CLIENTE
      =========================================================
      Consulta um pedido pelo identificador.
   
      A consulta exige também o ID do cliente autenticado,
      impedindo o acesso a pedidos de outros usuários.
   
      Nenhum pagamento é criado nesta função.
      ========================================================= */
   
   /* =========================================================
      BUSCAR PEDIDO COMPLETO PARA PAGAMENTO
      =========================================================
      Consulta o pedido pertencente ao cliente autenticado.
   
      Inclui os itens e pagamentos existentes para permitir
      a validação antes de iniciar uma cobrança.
      ========================================================= */
   
   export async function buscarPedidoParaPagamento(
     pedidoId: number,
     usuarioId: number
   ) {
     // Valida os identificadores recebidos.
     if (
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0 ||
       !Number.isSafeInteger(usuarioId) ||
       usuarioId <= 0
     ) {
       throw new Error("Identificadores inválidos.");
     }
   
     // Consulta somente pedidos do usuário autenticado.
     return prisma.pedido.findFirst({
       where: {
         id: pedidoId,
         usuarioId,
       },
   
       include: {
         // Recupera os produtos e valores salvos no pedido.
         itens: true,
   
         // Recupera tentativas de pagamento anteriores.
         pagamentos: true,
       },
     });
   }
   
   /* =========================================================
      VALIDAR PEDIDO PARA PAGAMENTO
      =========================================================
      Confere se o pedido ainda pode receber uma cobrança.
   
      Esta função não altera o banco de dados.
      ========================================================= */
   
   export function validarPedidoParaPagamento(
     pedido: {
       status: string;
       reservaExpiraEm: Date | null;
     }
   ) {
     // Somente pedidos aguardando pagamento podem prosseguir.
     if (pedido.status !== "AGUARDANDO_PAGAMENTO") {
       throw new Error(
         "Este pedido não está disponível para pagamento."
       );
     }
   
     // A reserva de estoque precisa ter um prazo definido.
     if (!pedido.reservaExpiraEm) {
       throw new Error(
         "O pedido não possui uma reserva de estoque válida."
       );
     }
   
     // Impede iniciar o pagamento de pedidos com reserva vencida.
     if (pedido.reservaExpiraEm.getTime() <= Date.now()) {
       throw new Error(
         "A reserva de estoque expirou. Faça um novo pedido."
       );
     }
   
     return true;
   }
   
   /* =========================================================
      VERIFICAR PAGAMENTO ATIVO
      =========================================================
      Consulta se um pedido já possui uma tentativa
      de pagamento pendente, em processamento ou aprovada.
   
      Evita iniciar outra cobrança sem antes verificar
      a situação da tentativa anterior.
   
      Esta função não modifica o banco.
      ========================================================= */
   
   export async function buscarPagamentoAtivo(
     pedidoId: number
   ) {
     // Valida o identificador do pedido.
     if (
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0
     ) {
       throw new Error("Identificador do pedido inválido.");
     }
   
     // Procura pagamentos que ainda exigem acompanhamento.
     return prisma.pagamento.findFirst({
       where: {
         pedidoId,
         status: {
           in: [
             "PENDENTE",
             "PROCESSANDO",
             "APROVADO",
           ],
         },
       },
   
       // Prioriza a tentativa mais recente.
       orderBy: {
         criadoEm: "desc",
       },
     });
   }
   
   /* =========================================================
      GERAR CHAVE DE IDEMPOTÊNCIA DO PAGAMENTO
      =========================================================
      Gera uma identificação única para uma nova operação.
   
      A chave deverá ser persistida no MySQL antes de ser
      utilizada na comunicação com o Mercado Pago.
   
      Em caso de repetição da mesma operação, o sistema
      deverá reutilizar a chave persistida, não gerar outra.
      ========================================================= */
   
   export function gerarChaveIdempotenciaPagamento(): string {
     // Gera um UUID para identificar uma nova operação.
     return crypto.randomUUID();
   }
   
   /* =========================================================
      BLOQUEAR PEDIDO DURANTE UMA TRANSAÇÃO
      =========================================================
      Bloqueia a linha do pedido no MySQL para impedir
      operações concorrentes durante o registro financeiro.
   
      Deve ser chamada somente dentro de uma transação
      ativa do Prisma.
   
      O bloqueio será liberado quando a transação terminar.
      ========================================================= */
   
   export async function bloquearPedidoParaPagamento(
     tx: Prisma.TransactionClient,
     pedidoId: number
   ): Promise<void> {
     // Impede o uso de identificadores inválidos.
     if (
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0
     ) {
       throw new Error("Identificador do pedido inválido.");
     }
   
     // Bloqueia exclusivamente a linha do pedido.
     // O identificador é enviado como parâmetro seguro.
     const resultado = await tx.$queryRaw<
       Array<{ id: number }>
     >`
       SELECT id
       FROM pedidos
       WHERE id = ${pedidoId}
       FOR UPDATE
     `;
   
     // Confirma que o pedido realmente existe.
     if (resultado.length !== 1) {
       throw new Error("Pedido não encontrado.");
     }
   }
   
   /* =========================================================
      CONSULTAR VALOR OFICIAL DO PEDIDO
      =========================================================
      Recupera o valor total diretamente do MySQL.
   
      O navegador não pode definir o valor de uma cobrança.
      ========================================================= */
   
   export async function consultarValorPedido(
     pedidoId: number
   ) {
     // Verifica se o identificador é válido.
     if (
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0
     ) {
       throw new Error("Identificador do pedido inválido.");
     }
   
     // Consulta o valor registrado no banco.
     const pedido = await prisma.pedido.findUnique({
       where: {
         id: pedidoId,
       },
       select: {
         id: true,
         valorTotal: true,
         valorFrete: true,
         status: true,
         reservaExpiraEm: true,
       },
     });
   
     if (!pedido) {
       throw new Error("Pedido não encontrado.");
     }
   
     return pedido;
   }
   
   /* =========================================================
      REGISTRAR TENTATIVA DE PAGAMENTO
      =========================================================
      Registra uma tentativa financeira vinculada ao pedido.
   
      Proteções:
      - Bloqueia o pedido durante a transação.
      - Confirma o proprietário do pedido.
      - Verifica o status e a validade da reserva.
      - Reutiliza pagamentos ativos.
      - Usa o valor oficial registrado no MySQL.
   
      Não envia nenhuma cobrança ao Mercado Pago.
      ========================================================= */
   
   export async function registrarTentativaPagamento(
     pedidoId: number,
     usuarioId: number,
     // null indica que o cliente ainda escolherá o método no Mercado Pago.
     metodo: MetodoPagamento | null
   ) {
     // Valida os identificadores recebidos.
     if (
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0 ||
       !Number.isSafeInteger(usuarioId) ||
       usuarioId <= 0
     ) {
       throw new Error("Identificadores inválidos.");
     }
   
     // Aceita método ainda não escolhido (null), PIX ou cartão.
     // Outros valores, inclusive undefined, continuam sendo rejeitados.
     if (
       metodo !== null &&
       metodo !== MetodoPagamento.PIX &&
       metodo !== MetodoPagamento.CARTAO
     ) {
       throw new Error("Método de pagamento inválido.");
     }
   
     return prisma.$transaction(async (tx) => {
       // 1. Bloqueia a linha do pedido para evitar concorrência.
       await bloquearPedidoParaPagamento(tx, pedidoId);
   
       // 2. Consulta o pedido dentro da mesma transação.
       const pedido = await tx.pedido.findFirst({
         where: {
           id: pedidoId,
           usuarioId,
         },
         select: {
           id: true,
           status: true,
           reservaExpiraEm: true,
           valorTotal: true,
         },
       });
   
       if (!pedido) {
         throw new Error("Pedido não encontrado para este cliente.");
       }
   
       // 3. Verifica se o pedido está disponível para pagamento.
       if (pedido.status !== StatusPedido.AGUARDANDO_PAGAMENTO) {
         throw new Error(
           "Este pedido não está aguardando pagamento."
         );
       }
   
       // 4. Verifica a validade da reserva de estoque.
       if (
         !pedido.reservaExpiraEm ||
         pedido.reservaExpiraEm.getTime() <= Date.now()
       ) {
         throw new Error(
           "A reserva de estoque expirou. Faça um novo pedido."
         );
       }
   
       // 5. Verifica se já existe um pagamento ativo.
       const pagamentoExistente = await tx.pagamento.findFirst({
         where: {
           pedidoId,
           status: {
             in: [
               StatusPagamento.PENDENTE,
               StatusPagamento.PROCESSANDO,
               StatusPagamento.APROVADO,
             ],
           },
         },
         orderBy: {
           criadoEm: "desc",
         },
       });
   
       // =====================================================
       // REUTILIZAR PAGAMENTO EXISTENTE COM SEGURANÇA
       // =====================================================
   
       // Verifica se existe uma tentativa financeira ativa.
       if (pagamentoExistente) {
   
         // Um pagamento aprovado não pode ser substituído
         // por uma nova tentativa financeira.
         if (
           pagamentoExistente.status === StatusPagamento.APROVADO
         ) {
           throw new Error(
             "Este pedido já possui um pagamento aprovado."
           );
         }
   
         // Quando um método específico foi solicitado, exige correspondência.
         // null não exige um método: reutiliza a tentativa ativa sem alterar
         // seu método, status, identificador externo ou chave de idempotência.
         if (metodo !== null && pagamentoExistente.metodo !== metodo) {
           throw new Error(
             "Este pedido já possui uma tentativa de pagamento ativa por outro método. Aguarde sua finalização."
           );
         }
   
         // Reutiliza a tentativa existente e mantém
         // a mesma chave de idempotência.
         return pagamentoExistente;
       }
   
       // 6. Gera uma chave única para a operação financeira.
       const chaveIdempotencia =
         gerarChaveIdempotenciaPagamento();
   
       // 7. Registra a tentativa usando o valor oficial do pedido.
       const pagamento = await tx.pagamento.create({
         data: {
           pedidoId,
           metodo,
           status: StatusPagamento.PENDENTE,
           valor: pedido.valorTotal,
           chaveIdempotencia,
         },
       });
   
       return pagamento;
     });
   }
   
   /* =========================================================
      CONSULTAR DADOS DO PEDIDO PARA O MERCADO PAGO
      =========================================================
      Recupera os valores e produtos registrados no MySQL.
   
      O navegador não informa preços ao provedor.
      ========================================================= */
   
   export async function buscarDadosPedidoMercadoPago(
     pedidoId: number,
     usuarioId: number
   ) {
     // Valida os identificadores.
     if (
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0 ||
       !Number.isSafeInteger(usuarioId) ||
       usuarioId <= 0
     ) {
       throw new Error("Identificadores inválidos.");
     }
   
     // Recupera somente o pedido pertencente ao cliente.
     const pedido = await prisma.pedido.findFirst({
       where: {
         id: pedidoId,
         usuarioId,
       },
       select: {
         id: true,
         status: true,
         reservaExpiraEm: true,
         valorTotal: true,
         valorFrete: true,
         valorDesconto: true,
   
         // Produtos e preços registrados no momento da compra.
         itens: {
           select: {
             nomeProduto: true,
             quantidade: true,
             precoUnitario: true,
             subtotal: true,
           },
         },
       },
     });
   
     if (!pedido) {
       throw new Error("Pedido não encontrado para este cliente.");
     }
   
     return pedido;
   }
   
   /* =========================================================
      REGISTRAR IDENTIFICADOR EXTERNO DO PAGAMENTO
      =========================================================
      Associa uma tentativa financeira local ao identificador
      e ao link de checkout retornados pelo Mercado Pago.
   
      Não aprova o pagamento e não altera o pedido.
      A confirmação financeira será tratada posteriormente
      por meio de webhook e consulta ao provedor.
      ========================================================= */
   
   export async function registrarIdentificadorMercadoPago(
     pagamentoId: number,
     chaveIdempotencia: string,
     identificadorExterno: string,
     checkoutUrl: string
   ) {
     // 1. Valida os dados recebidos antes de acessar o banco.
     if (
       !Number.isSafeInteger(pagamentoId) ||
       pagamentoId <= 0 ||
       typeof chaveIdempotencia !== "string" ||
       !chaveIdempotencia.trim() ||
       typeof identificadorExterno !== "string" ||
       !/^ORD[A-Za-z0-9_-]{1,100}$/.test(identificadorExterno) ||
       typeof checkoutUrl !== "string" ||
       !checkoutUrl.trim()
     ) {
       throw new Error("Dados de identificação do pagamento inválidos.");
     }
   
     // 2. Confere o link também na entrada da camada de persistência.
     // O serviço deve ter validado a resposta e os valores do provedor.
     let urlPagamento: URL;
   
     try {
       urlPagamento = new URL(checkoutUrl);
     } catch {
       throw new Error("URL de pagamento inválida.");
     }
   
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
       idsNaUrl[0] !== identificadorExterno
     ) {
       throw new Error("URL de pagamento inválida.");
     }
   
     const urlValidada = urlPagamento.toString();
   
     // TEXT no MySQL comporta até 65.535 bytes.
     if (Buffer.byteLength(urlValidada, "utf8") > 65535) {
       throw new Error("URL de pagamento excede o tamanho permitido.");
     }
   
     // 3. Grava ID e URL juntos, em uma única instrução atômica.
     // Também permite completar um registro antigo que já tenha o mesmo ID,
     // mas ainda não possua URL. Nunca substitui outra Order ou outro link.
     const resultado = await prisma.pagamento.updateMany({
       where: {
         id: pagamentoId,
         chaveIdempotencia,
         status: {
           in: [
             StatusPagamento.PENDENTE,
             StatusPagamento.PROCESSANDO,
           ],
         },
         checkoutUrl: null,
         OR: [
           { identificadorExterno: null },
           { identificadorExterno },
         ],
       },
       data: {
         identificadorExterno,
         checkoutUrl: urlValidada,
       },
     });
   
     // 4. Uma repetição só é aceita se ID e URL já forem os mesmos.
     // Não libera redirecionamento nem confirma pagamento por esta função.
     if (resultado.count === 0) {
       const pagamentoExistente = await prisma.pagamento.findFirst({
         where: {
           id: pagamentoId,
           chaveIdempotencia,
         },
       });
   
       if (
         !pagamentoExistente ||
         pagamentoExistente.identificadorExterno !== identificadorExterno ||
         pagamentoExistente.checkoutUrl !== urlValidada
       ) {
         throw new Error(
           "Não foi possível vincular o identificador e o link do Mercado Pago."
         );
       }
   
       return pagamentoExistente;
     }
   
     // 5. Retorna a tentativa com o identificador e o link salvos.
     return prisma.pagamento.findUniqueOrThrow({
       where: {
         id: pagamentoId,
       },
     });
   }
   
   /* =========================================================
      BUSCAR TENTATIVA PARA INTEGRAÇÃO COM MERCADO PAGO
      =========================================================
      Recupera uma tentativa financeira já registrada.
   
      A consulta exige o identificador do pagamento
      e do pedido, evitando associar a tentativa
      a um pedido diferente.
   
      Nenhuma alteração é realizada no banco.
      ========================================================= */
   
   export async function buscarTentativaMercadoPago(
     pagamentoId: number,
     pedidoId: number
   ) {
     // Valida os identificadores recebidos.
     if (
       !Number.isSafeInteger(pagamentoId) ||
       pagamentoId <= 0 ||
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0
     ) {
       throw new Error("Identificadores de pagamento inválidos.");
     }
   
     // Consulta a tentativa vinculada ao pedido.
     const pagamento = await prisma.pagamento.findFirst({
       where: {
         id: pagamentoId,
         pedidoId,
       },
       select: {
         id: true,
         pedidoId: true,
         metodo: true,
         status: true,
         valor: true,
         chaveIdempotencia: true,
         identificadorExterno: true,
         // Permite retomar o checkout usando o link já persistido.
         checkoutUrl: true,
       },
     });
   
     // Impede continuar sem uma tentativa existente.
     if (!pagamento) {
       throw new Error("Tentativa de pagamento não encontrada.");
     }
   
     // A chave precisa existir antes da comunicação externa.
     if (!pagamento.chaveIdempotencia) {
       throw new Error(
         "A tentativa de pagamento não possui chave de idempotência."
       );
     }
   
     return pagamento;
   }
   
   /* =========================================================
      RESERVAR EXECUÇÃO DA COBRANÇA
      =========================================================
      Protege o início do pagamento com uma transação.
   
      Verifica:
      - Existência do pedido.
      - Status do pedido.
      - Validade da reserva de estoque.
      - Existência de tentativa ainda pendente.
      - Concorrência entre requisições.
   
      Não realiza cobranças externas.
      ========================================================= */
   
   export async function reservarExecucaoCobranca(
     pagamentoId: number,
     pedidoId: number
   ): Promise<boolean> {
     // 1. Valida os identificadores recebidos.
     if (
       !Number.isSafeInteger(pagamentoId) ||
       pagamentoId <= 0 ||
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0
     ) {
       throw new Error("Identificadores inválidos.");
     }
   
     // 2. Inicia a transação no MySQL.
     return prisma.$transaction(async (tx) => {
       // Bloqueia o pedido até a transação terminar.
       await bloquearPedidoParaPagamento(tx, pedidoId);
   
       // 3. Recupera os dados atuais do pedido.
       const pedido = await tx.pedido.findUnique({
         where: {
           id: pedidoId,
         },
         select: {
           status: true,
           reservaExpiraEm: true,
         },
       });
   
       if (!pedido) {
         throw new Error("Pedido não encontrado.");
       }
   
       // 4. Verifica se o pedido aguarda pagamento.
       if (pedido.status !== StatusPedido.AGUARDANDO_PAGAMENTO) {
         throw new Error(
           "Este pedido não está disponível para pagamento."
         );
       }
   
       // 5. Confere se a reserva de estoque ainda está válida.
       if (
         !pedido.reservaExpiraEm ||
         pedido.reservaExpiraEm.getTime() <= Date.now()
       ) {
         throw new Error(
           "A reserva de estoque expirou. Faça um novo pedido."
         );
       }
   
       // 6. Autoriza apenas uma requisição a iniciar a cobrança.
       const resultado = await tx.pagamento.updateMany({
         where: {
           id: pagamentoId,
           pedidoId,
           status: StatusPagamento.PENDENTE,
           identificadorExterno: null,
           // Uma tentativa com link salvo exige consulta, não nova criação.
           checkoutUrl: null,
         },
         data: {
           status: StatusPagamento.PROCESSANDO,
         },
       });
   
       // true: cobrança reservada com sucesso.
       // false: outra operação já iniciou o processamento.
       return resultado.count === 1;
     });
   }
   
   /* =========================================================
      CONSULTAR COBRANÇA EM PROCESSAMENTO
      =========================================================
      Identifica uma tentativa que iniciou o processamento,
      mas ainda não possui identificador externo registrado.
   
      Essa situação pode ocorrer após:
      - Falha de conexão com o Mercado Pago.
      - Timeout da requisição.
      - Reinicialização do servidor.
   
      Esta função apenas consulta o banco.
      Não altera o status e não cria cobranças.
      ========================================================= */
   
   export async function consultarCobrancaEmProcessamento(
     pagamentoId: number,
     pedidoId: number
   ) {
     // 1. Valida os identificadores.
     if (
       !Number.isSafeInteger(pagamentoId) ||
       pagamentoId <= 0 ||
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0
     ) {
       throw new Error("Identificadores de pagamento inválidos.");
     }
   
     // 2. Procura a tentativa que está em processamento,
     // mas ainda não possui identificador externo.
     const pagamento = await prisma.pagamento.findFirst({
       where: {
         id: pagamentoId,
         pedidoId,
         status: StatusPagamento.PROCESSANDO,
         identificadorExterno: null,
       },
       select: {
         id: true,
         pedidoId: true,
         status: true,
         metodo: true,
         valor: true,
         chaveIdempotencia: true,
         identificadorExterno: true,
         criadoEm: true,
         atualizadoEm: true,
       },
     });
   
     // 3. Retorna null quando não existe uma tentativa
     // com essas características.
     return pagamento;
   }
   
   /* =========================================================
      ATUALIZAR STATUS DA TENTATIVA DE PAGAMENTO
      =========================================================
      Atualiza o status somente quando:
      - A tentativa pertence ao pedido informado.
      - A cobrança possui o identificador externo esperado.
      - O pagamento ainda está em processamento.
      - O novo status não representa aprovação financeira.
   
      Esta função NÃO confirma pedidos e NÃO altera estoque.
      ========================================================= */
   
   export async function atualizarStatusTentativaPagamento(
     pagamentoId: number,
     pedidoId: number,
     identificadorExterno: string,
     novoStatus: StatusPagamento
   ): Promise<boolean> {
     // 1. Valida os identificadores internos.
     if (
       !Number.isSafeInteger(pagamentoId) ||
       pagamentoId <= 0 ||
       !Number.isSafeInteger(pedidoId) ||
       pedidoId <= 0
     ) {
       throw new Error("Identificadores de pagamento inválidos.");
     }
   
     // 2. Exige um identificador externo válido.
     if (
       typeof identificadorExterno !== "string" ||
       identificadorExterno.trim().length === 0
     ) {
       throw new Error(
         "Identificador externo da cobrança inválido."
       );
     }
   
     // 3. Permite somente transições não financeiras.
     // Aprovação e estorno terão tratamento transacional
     // próprio nas próximas etapas.
     const statusPermitidos: StatusPagamento[] = [
       StatusPagamento.RECUSADO,
       StatusPagamento.CANCELADO,
       StatusPagamento.EXPIRADO,
     ];
   
     if (!statusPermitidos.includes(novoStatus)) {
       throw new Error(
         "Esta alteração exige conciliação financeira específica."
       );
     }
   
     // 4. Atualiza somente a tentativa correspondente,
     // desde que ela ainda esteja em processamento.
     const resultado = await prisma.pagamento.updateMany({
       where: {
         id: pagamentoId,
         pedidoId,
         identificadorExterno,
         status: StatusPagamento.PROCESSANDO,
       },
       data: {
         status: novoStatus,
       },
     });
   
     // true: a atualização foi realizada.
     // false: o registro não atendia às condições.
     return resultado.count === 1;
   }
   
   /* =========================================================
      CONFIRMAR PAGAMENTO E PEDIDO
      =========================================================
      Registra uma aprovação financeira já verificada
      junto ao Mercado Pago.
   
      Proteções:
      - Bloqueio transacional do pedido.
      - Conferência do identificador externo.
      - Conferência do valor.
      - Idempotência para notificações repetidas.
      - Atualização conjunta do pagamento e pedido.
   
      ATENÇÃO:
      Esta função não consulta o Mercado Pago.
      Somente o serviço de conciliação deve chamá-la
      após verificar a aprovação financeira real.
      ========================================================= */
   
      export async function confirmarPagamentoMercadoPago(
      pagamentoId: number,
      pedidoId: number,
      identificadorExterno: string,
      valorConfirmado: Prisma.Decimal,
      comprovante: {
        transacaoId: string;
        metodo: MetodoPagamento;
      }
    ) {
      if (
        !Number.isSafeInteger(pagamentoId) ||
        pagamentoId <= 0 ||
        !Number.isSafeInteger(pedidoId) ||
        pedidoId <= 0 ||
        typeof identificadorExterno !== "string" ||
        !/^ORD[A-Za-z0-9_-]{1,100}$/.test(identificadorExterno) ||
        !valorConfirmado.isFinite() ||
        valorConfirmado.lessThanOrEqualTo(0) ||
        valorConfirmado.decimalPlaces() > 2 ||
        !comprovante ||
        typeof comprovante.transacaoId !== "string" ||
        !/^[A-Za-z0-9_-]{1,150}$/.test(comprovante.transacaoId) ||
        ![MetodoPagamento.PIX, MetodoPagamento.CARTAO].includes(
          comprovante.metodo
        )
      ) {
        throw new Error("Dados de confirmação inválidos.");
      }

      return prisma.$transaction(async (tx) => {
        // Todas as decisões sobre o pedido acontecem sob o mesmo bloqueio.
        await bloquearPedidoParaPagamento(tx, pedidoId);

        const pedido = await tx.pedido.findUnique({
          where: { id: pedidoId },
          select: {
            id: true,
            status: true,
            valorTotal: true,
            reservaExpiraEm: true,
            itens: {
              select: {
                varianteId: true,
                quantidade: true,
              },
            },
          },
        });

        const pagamento = await tx.pagamento.findFirst({
          where: {
            id: pagamentoId,
            pedidoId,
            identificadorExterno,
          },
          select: {
            id: true,
            status: true,
            valor: true,
            metodo: true,
          },
        });

        if (
          !pedido ||
          !pagamento ||
          !pedido.valorTotal.equals(valorConfirmado) ||
          !pagamento.valor.equals(valorConfirmado) ||
          (
            pagamento.metodo !== null &&
            pagamento.metodo !== comprovante.metodo
          )
        ) {
          throw new Error(
            "Pagamento incompatível com o pedido ou comprovante."
          );
        }

        // Uma aprovação salva conserva a decisão original nos reenvios.
        const registros = await tx.transacaoPagamento.findMany({
          where: {
            pagamentoId,
            tipo: "APROVACAO_MP",
          },
          take: 2,
        });

        if (registros.length > 0) {
          const registro = registros[0];

          if (
            registros.length !== 1 ||
            registro.identificadorExterno !== comprovante.transacaoId ||
            !registro.valor.equals(valorConfirmado) ||
            pagamento.status !== StatusPagamento.APROVADO ||
            pagamento.metodo !== comprovante.metodo
          ) {
            throw new Error("Comprovante financeiro inconsistente.");
          }

          const confirmado = registro.status === "CONFIRMADO";

          const estadoOperacionalValido = (
            [
              "CONFIRMADO",
              "EM_PREPARACAO",
              "ENVIADO",
              "ENTREGUE",
            ] as string[]
          ).includes(pedido.status);

          if (
            (
              !confirmado &&
              registro.status !== "REVISAO_MANUAL"
            ) ||
            (confirmado && !estadoOperacionalValido)
          ) {
            throw new Error(
              "A aprovação exige revisão do estado atual do pedido."
            );
          }

          return {
            pedidoId,
            pagamentoId,
            confirmado,
            jaConfirmado: confirmado,
            exigeRevisao: !confirmado,
          };
        }

        if (
          pagamento.status === StatusPagamento.APROVADO ||
          pagamento.status === StatusPagamento.ESTORNADO
        ) {
          throw new Error(
            "Estado financeiro anterior exige revisão."
          );
        }

        const comprovanteUtilizado =
          await tx.transacaoPagamento.findFirst({
            where: {
              identificadorExterno: comprovante.transacaoId,
              tipo: "APROVACAO_MP",
            },
            select: { id: true },
          });

        if (comprovanteUtilizado) {
          throw new Error(
            "Comprovante já vinculado a outro pagamento."
          );
        }

        const outroPagamento = await tx.pagamento.findFirst({
          where: {
            pedidoId,
            id: { not: pagamentoId },
            status: StatusPagamento.APROVADO,
          },
          select: { id: true },
        });

        // O estoque já foi reduzido na reserva: não reduzimos novamente.
        const movimentos = await tx.movimentacaoEstoque.findMany({
          where: { pedidoId },
          select: {
            varianteId: true,
            tipo: true,
            quantidade: true,
          },
        });

        const esperadas = new Map<number, number>();
        let reservaIntegra = pedido.itens.length > 0;

        for (const item of pedido.itens) {
          if (
            item.varianteId === null ||
            item.quantidade <= 0
          ) {
            reservaIntegra = false;
            continue;
          }

          esperadas.set(
            item.varianteId,
            (esperadas.get(item.varianteId) ?? 0) + item.quantidade
          );
        }

        const reservadas = new Map<number, number>();

        for (const movimento of movimentos) {
          // Qualquer liberação ou outra movimentação exige análise manual.
          if (
            movimento.tipo !== "RESERVA" ||
            movimento.quantidade <= 0
          ) {
            reservaIntegra = false;
            continue;
          }

          reservadas.set(
            movimento.varianteId,
            (reservadas.get(movimento.varianteId) ?? 0) +
              movimento.quantidade
          );
        }

        if (esperadas.size !== reservadas.size) {
          reservaIntegra = false;
        }

        for (const [varianteId, quantidade] of esperadas) {
          if (reservadas.get(varianteId) !== quantidade) {
            reservaIntegra = false;
          }
        }

        const agora = new Date();

        const confirmado =
          pedido.status === StatusPedido.AGUARDANDO_PAGAMENTO &&
          pagamento.status === StatusPagamento.PROCESSANDO &&
          pedido.reservaExpiraEm !== null &&
          pedido.reservaExpiraEm.getTime() > agora.getTime() &&
          reservaIntegra &&
          !outroPagamento;

        // Mesmo um recebimento tardio precisa ficar registrado financeiramente.
        await tx.pagamento.update({
          where: { id: pagamentoId },
          data: {
            status: StatusPagamento.APROVADO,
            metodo: comprovante.metodo,
            pagoEm: agora,
          },
        });

        await tx.transacaoPagamento.create({
          data: {
            pagamentoId,
            tipo: "APROVACAO_MP",
            status: confirmado ? "CONFIRMADO" : "REVISAO_MANUAL",
            identificadorExterno: comprovante.transacaoId,
            valor: valorConfirmado,
          },
        });

        if (confirmado) {
          await tx.pedido.update({
            where: { id: pedidoId },
            data: {
              status: StatusPedido.CONFIRMADO,
              reservaExpiraEm: null,
            },
          });
        }

        await tx.historicoPedido.create({
          data: {
            pedidoId,
            status: confirmado
              ? StatusPedido.CONFIRMADO
              : pedido.status,
            descricao: confirmado
              ? "Pagamento Mercado Pago conferido e pedido confirmado."
              : "Pagamento Mercado Pago recebido. Revisão manual necessária antes de atender ou devolver o valor.",
          },
        });

        return {
          pedidoId,
          pagamentoId,
          confirmado,
          jaConfirmado: false,
          exigeRevisao: !confirmado,
        };
      });
    }
   /* =========================================================
      LOCALIZAR PAGAMENTO PELO IDENTIFICADOR DO MERCADO PAGO
      =========================================================
      Utilizada pelo webhook para localizar uma cobrança
      recebida por notificação.
   
      Regras:
      - Consulta somente o identificador externo.
      - Recupera o pedido vinculado ao pagamento.
      - Não exige sessão do cliente.
      - Não altera pagamentos, pedidos ou estoque.
      ========================================================= */
   
   export async function buscarPagamentoPorOrderMercadoPago(
     identificadorExterno: string
   ) {
     // 1. Valida o identificador recebido.
     if (
       typeof identificadorExterno !== "string" ||
       !identificadorExterno.trim() ||
       identificadorExterno.length > 255
     ) {
       throw new Error(
         "Identificador externo da Order inválido."
       );
     }
   
     // 2. Procura a tentativa financeira correspondente.
     const pagamentos = await prisma.pagamento.findMany({
       where: {
         identificadorExterno,
       },
   
       select: {
         id: true,
         pedidoId: true,
         metodo: true,
         status: true,
         valor: true,
         chaveIdempotencia: true,
         identificadorExterno: true,
   
         // Recupera os dados oficiais do pedido.
         pedido: {
           select: {
             id: true,
             usuarioId: true,
             status: true,
             valorTotal: true,
             reservaExpiraEm: true,
           },
         },
       },
   
       // Duas cobranças com o mesmo identificador
       // representam uma inconsistência que exige análise.
       take: 2,
     });
   
     // 3. Retorna null quando não existe cobrança local.
     if (pagamentos.length === 0) {
       return null;
     }
   
     // 4. Impede conciliar identificadores duplicados.
     if (pagamentos.length > 1) {
       throw new Error(
         "Identificador externo associado a múltiplos pagamentos."
       );
     }
   
     // 5. Retorna a tentativa e o pedido correspondente.
     return pagamentos[0];
   }

   /* =========================================================
   REVISÃO ADMINISTRATIVA DE PAGAMENTO
   ========================================================= */

export async function buscarAprovacaoParaRevisao(
  pedidoId: number
) {
  return prisma.pagamento.findMany({
    where: {
      pedidoId,
      status: StatusPagamento.APROVADO,
    },
    take: 2,
    select: {
      id: true,
      pedidoId: true,
      valor: true,
      metodo: true,
      identificadorExterno: true,
      pedido: {
        select: { valorTotal: true },
      },
    },
  });
}

export class RevisaoPagamentoError extends Error {
  constructor(
    mensagem: string,
    public readonly status: number = 409
  ) {
    super(mensagem);
    this.name = "RevisaoPagamentoError";
  }
}

export async function revisarAprovacaoNoBanco(
  pedidoId: number,
  administradorId: number,
  prova: {
    pagamentoId: number;
    orderId: string;
    transacaoId: string;
    valor: Prisma.Decimal;
    metodo: MetodoPagamento;
  },
  confirmar: boolean
) {
  if (
    ![pedidoId, administradorId, prova.pagamentoId].every(
      (id) => Number.isSafeInteger(id) && id > 0
    ) ||
    !/^ORD[A-Za-z0-9_-]{1,100}$/.test(prova.orderId) ||
    !/^[A-Za-z0-9_-]{1,150}$/.test(prova.transacaoId) ||
    !prova.valor.isFinite() ||
    prova.valor.lessThanOrEqualTo(0) ||
    prova.valor.decimalPlaces() > 2 ||
    ![MetodoPagamento.PIX, MetodoPagamento.CARTAO].includes(
      prova.metodo
    )
  ) {
    throw new RevisaoPagamentoError(
      "Comprovante de revisão inválido."
    );
  }

  return prisma.$transaction(async (tx) => {
    await bloquearPedidoParaPagamento(tx, pedidoId);

    const administrador = await tx.usuario.findUnique({
      where: { id: administradorId },
      select: { perfil: true },
    });

    if (administrador?.perfil !== "ADMIN") {
      throw new RevisaoPagamentoError(
        "Acesso administrativo necessário.",
        403
      );
    }

    const pedido = await tx.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        status: true,
        valorTotal: true,
        reservaExpiraEm: true,
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
        pagamentos: {
          select: {
            id: true,
            status: true,
            valor: true,
            metodo: true,
            identificadorExterno: true,
            transacoes: {
              where: { tipo: "APROVACAO_MP" },
              take: 2,
            },
          },
        },
      },
    });

    if (!pedido) {
      throw new RevisaoPagamentoError(
        "Pedido não encontrado.",
        404
      );
    }

    const pagamento = pedido.pagamentos.find(
      (item) => item.id === prova.pagamentoId
    );

    const registro = pagamento?.transacoes[0];

    if (
      !pagamento ||
      pagamento.status !== StatusPagamento.APROVADO ||
      pagamento.identificadorExterno !== prova.orderId ||
      pagamento.metodo !== prova.metodo ||
      !pagamento.valor.equals(prova.valor) ||
      !pedido.valorTotal.equals(prova.valor) ||
      pagamento.transacoes.length !== 1 ||
      !registro ||
      registro.identificadorExterno !== prova.transacaoId ||
      !registro.valor.equals(prova.valor)
    ) {
      throw new RevisaoPagamentoError(
        "A aprovação local não corresponde ao pagamento consultado."
      );
    }

    // Repetir uma confirmação concluída não duplica operações.
    if (
      registro.status === "CONFIRMADO" &&
      [
        "CONFIRMADO",
        "EM_PREPARACAO",
        "ENVIADO",
        "ENTREGUE",
      ].includes(pedido.status)
    ) {
      return {
        pedidoId,
        confirmado: true,
        podeConfirmar: false,
        reservaVencida: false,
        motivo: "Este pedido já foi confirmado.",
      };
    }

    const motivos: string[] = [];

    if (pedido.status !== StatusPedido.AGUARDANDO_PAGAMENTO) {
      motivos.push(
        "O pedido não está aguardando pagamento; esta ação não reabre pedidos cancelados."
      );
    }

    if (pedido.pagamentos.length !== 1) {
      motivos.push(
        "Existem outras tentativas financeiras no pedido."
      );
    }

    if (registro.status !== "REVISAO_MANUAL") {
      motivos.push(
        "O comprovante não está disponível para revisão manual."
      );
    }

    const esperadas = new Map<number, number>();
    const reservadas = new Map<number, number>();
    let reservaIntegra = pedido.itens.length > 0;

    for (const item of pedido.itens) {
      if (
        item.varianteId === null ||
        item.quantidade <= 0
      ) {
        reservaIntegra = false;
        continue;
      }

      esperadas.set(
        item.varianteId,
        (esperadas.get(item.varianteId) ?? 0) +
          item.quantidade
      );
    }

    for (const movimento of pedido.movimentacoesEstoque) {
      if (
        movimento.tipo !== "RESERVA" ||
        movimento.quantidade <= 0
      ) {
        reservaIntegra = false;
        continue;
      }

      reservadas.set(
        movimento.varianteId,
        (reservadas.get(movimento.varianteId) ?? 0) +
          movimento.quantidade
      );
    }

    if (esperadas.size !== reservadas.size) {
      reservaIntegra = false;
    }

    for (const [id, quantidade] of esperadas) {
      if (reservadas.get(id) !== quantidade) {
        reservaIntegra = false;
      }
    }

    if (!reservaIntegra) {
      motivos.push(
        "O estoque original não está integralmente reservado ou houve outras movimentações."
      );
    }

    const reservaVencida =
      !pedido.reservaExpiraEm ||
      pedido.reservaExpiraEm.getTime() <= Date.now();

    const podeConfirmar = motivos.length === 0;

    if (confirmar && !podeConfirmar) {
      throw new RevisaoPagamentoError(
        motivos.join(" ")
      );
    }

    if (confirmar) {
      // O estoque já foi reduzido na reserva.
      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          status: StatusPedido.CONFIRMADO,
          reservaExpiraEm: null,
        },
      });

      await tx.transacaoPagamento.update({
        where: { id: registro.id },
        data: { status: "CONFIRMADO" },
      });

      await tx.historicoPedido.create({
        data: {
          pedidoId,
          status: StatusPedido.CONFIRMADO,
          descricao:
            `Pedido confirmado após revisão administrativa pelo usuário #${administradorId}. Pagamento e reserva conferidos.`,
        },
      });
    }

    return {
      pedidoId,
      confirmado: confirmar,
      podeConfirmar: podeConfirmar && !confirmar,
      reservaVencida,
      motivo: confirmar
        ? "Pedido confirmado após revisão administrativa."
        : motivos.length > 0
          ? motivos.join(" ")
          : reservaVencida
            ? "A reserva venceu, mas o estoque original permanece reservado. Você pode autorizar a confirmação."
            : "Pagamento aprovado e estoque original reservado. Você pode autorizar a confirmação.",
    };
  });
}
/* Consulta local para diagnóstico administrativo.
   Não altera registros. */
   export async function buscarCobrancasParaConsulta(
    pedidoId: number
  ) {
    if (
      !Number.isSafeInteger(pedidoId) ||
      pedidoId <= 0
    ) {
      throw new Error("Pedido inválido.");
    }
  
    return prisma.pagamento.findMany({
      where: {
        pedidoId,
      },
      orderBy: {
        id: "desc",
      },
      take: 2,
      select: {
        id: true,
        pedidoId: true,
        status: true,
        valor: true,
        identificadorExterno: true,
        pedido: {
          select: {
            status: true,
            valorTotal: true,
          },
        },
      },
    });
  }
