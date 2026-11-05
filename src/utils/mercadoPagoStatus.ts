
/* =========================================================
   MAPEAMENTO DE STATUS DO MERCADO PAGO
   =========================================================
   Traduz os status externos para estados internos.

   IMPORTANTE:
   - Não consulta o Mercado Pago.
   - Não altera o banco de dados.
   - Não confirma pedidos.
   - Status desconhecidos não são considerados aprovados.
   ========================================================= */

import { StatusPagamento } from "@prisma/client";

/**
 * Estados de conciliação utilizados pelo backend.
 *
 * "REVISAR" significa que o status recebido não pode
 * ser interpretado com segurança automaticamente.
 */
export type ResultadoConciliacao =
  | "PENDENTE"
  | "APROVADO"
  | "RECUSADO"
  | "CANCELADO"
  | "REVISAR";

/**
 * Interpreta o status de uma Order do Mercado Pago.
 *
 * A aprovação de uma Order ainda precisará ser
 * confirmada pela conciliação financeira completa.
 */
export function mapearStatusMercadoPago(
  status: string,
  statusDetail?: string | null
): {
  resultado: ResultadoConciliacao;
  statusPagamento: StatusPagamento | null;
  permiteConfirmarPedido: boolean;
} {
  // Normaliza os valores recebidos do provedor.
  const estado = status.trim().toLowerCase();

  const detalhe = statusDetail?.trim().toLowerCase() ?? "";

  // Order criada, mas ainda sem pagamento confirmado.
  if (estado === "created") {
    return {
      resultado: "PENDENTE",
      statusPagamento: StatusPagamento.PROCESSANDO,
      permiteConfirmarPedido: false,
    };
  }

  // Order aguardando processamento ou confirmação.
  if (estado === "processing") {
    return {
      resultado: "PENDENTE",
      statusPagamento: StatusPagamento.PROCESSANDO,
      permiteConfirmarPedido: false,
    };
  }

  // Order processada.
  // Não confirmamos automaticamente o pedido apenas
  // por esse status: a transação financeira precisa
  // ser verificada na etapa de conciliação.
  if (estado === "processed") {
    return {
      resultado: "REVISAR",
      statusPagamento: null,
      permiteConfirmarPedido: false,
    };
  }

  // Order cancelada.
  if (estado === "canceled" || estado === "cancelled") {
    return {
      resultado: "CANCELADO",
      statusPagamento: StatusPagamento.CANCELADO,
      permiteConfirmarPedido: false,
    };
  }

  // Order com falha.
  if (estado === "failed") {
    return {
      resultado: "RECUSADO",
      statusPagamento: StatusPagamento.RECUSADO,
      permiteConfirmarPedido: false,
    };
  }

  // Mantemos detalhes desconhecidos para futura análise.
  // Nunca interpretamos uma resposta desconhecida
  // como aprovação automática.
  void detalhe;

  return {
    resultado: "REVISAR",
    statusPagamento: null,
    permiteConfirmarPedido: false,
  };
}


/* =========================================================
   INTERPRETAR STATUS DA TRANSAÇÃO FINANCEIRA
   =========================================================
   Diferencia a situação da transação financeira
   do status geral da Order.

   Esta função apenas interpreta informações.
   Não atualiza pagamentos ou pedidos.

   Estados desconhecidos exigem revisão.
   ========================================================= */

export function interpretarStatusTransacaoMercadoPago(
  status: string
): {
  statusPagamento: StatusPagamento | null;
  aprovado: boolean;
  exigeRevisao: boolean;
} {
  // Normaliza o status informado pelo provedor.
  const estado = status.trim().toLowerCase();

  // Pagamento efetivamente aprovado.
  if (estado === "approved") {
    return {
      statusPagamento: StatusPagamento.APROVADO,
      aprovado: true,
      exigeRevisao: false,
    };
  }

  // Pagamento ainda aguardando confirmação.
  if (
    estado === "pending" ||
    estado === "in_process" ||
    estado === "processing"
  ) {
    return {
      statusPagamento: StatusPagamento.PROCESSANDO,
      aprovado: false,
      exigeRevisao: false,
    };
  }

  // Pagamento recusado.
  if (estado === "rejected") {
    return {
      statusPagamento: StatusPagamento.RECUSADO,
      aprovado: false,
      exigeRevisao: false,
    };
  }

  // Pagamento cancelado.
  if (
    estado === "cancelled" ||
    estado === "canceled"
  ) {
    return {
      statusPagamento: StatusPagamento.CANCELADO,
      aprovado: false,
      exigeRevisao: false,
    };
  }

  // Pagamento devolvido.
  if (estado === "refunded") {
    return {
      statusPagamento: StatusPagamento.ESTORNADO,
      aprovado: false,
      exigeRevisao: true,
    };
  }

  // Qualquer outro status exige análise.
  return {
    statusPagamento: null,
    aprovado: false,
    exigeRevisao: true,
  };
}
