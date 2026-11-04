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
  metodo: MetodoPagamento
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

  // Aceita somente os métodos cadastrados no sistema.
  if (
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

    // Reutiliza a tentativa existente, sem criar outra.
    if (pagamentoExistente) {
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