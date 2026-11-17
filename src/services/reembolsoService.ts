import { Prisma } from "@prisma/client";

import {
  CancelamentoError,
} from "../repositories/cancelamentoRepository";

import {
  buscarBaseReembolso,
  registrarTentativaReembolso,
  confirmarReembolsoNoBanco,
} from "../repositories/reembolsoRepository";

import {
  consultarOrderParaReembolso,
  enviarReembolsoIntegral,
  mesmoValor,
} from "./mercadoPagoReembolsoService";

type Base = Awaited<
  ReturnType<typeof buscarBaseReembolso>
>;

type Order = Awaited<
  ReturnType<typeof consultarOrderParaReembolso>
>;

function vinculo(base: Base, order: Order) {
  const pagamento =
    base.pedido.pagamentos[0];

  if (
    base.status !== "APROVADA_PARA_REEMBOLSO" ||
    base.pedido.pagamentos.length !== 1 ||
    !pagamento ||
    order.mercadoPagoOrderId !==
      pagamento.identificadorExterno ||
    order.referenciaExterna !==
      String(base.pedidoId) ||
    !mesmoValor(
      order.valorTotal,
      pagamento.valor
    ) ||
    !pagamento.valor.equals(
      base.pedido.valorTotal
    ) ||
    order.ajustesExtras
  ) {
    throw new CancelamentoError(
      "Order, valor ou solicitação incompatíveis. É necessária revisão financeira."
    );
  }

  return pagamento;
}

function conferirAprovacao(
  base: Base,
  order: Order
) {
  const pagamento = vinculo(base, order);
  const t = order.transacoes[0];
  const registros = pagamento.transacoes;

  if (
    base.reembolso ||
    pagamento.status !== "APROVADO" ||
    !pagamento.pagoEm ||
    registros.length !== 1 ||
    registros[0].tipo !== "APROVACAO_MP" ||
    ![
      "CONFIRMADO",
      "REVISAO_MANUAL",
    ].includes(registros[0].status) ||
    order.status !== "processed" ||
    order.statusDetail !== "accredited" ||
    order.refunds.length !== 0 ||
    order.transacoes.length !== 1 ||
    !t ||
    typeof t.id !== "string" ||
    !/^PAY[A-Za-z0-9_-]{1,140}$/.test(t.id) ||
    t.status !== "processed" ||
    t.status_detail !== "accredited" ||
    registros[0].identificadorExterno !== t.id ||
    !registros[0].valor.equals(
      pagamento.valor
    ) ||
    !mesmoValor(
      t.amount,
      pagamento.valor
    ) ||
    !mesmoValor(
      t.paid_amount,
      pagamento.valor
    ) ||
    !mesmoValor(
      order.valorTotalPago,
      pagamento.valor
    )
  ) {
    throw new CancelamentoError(
      "É necessária uma aprovação integral, sem reembolso ou contestação anteriores."
    );
  }

  return {
    pedidoId: base.pedidoId,
    pagamentoId: pagamento.id,
    orderId: order.mercadoPagoOrderId,
    transacaoId: t.id,
    vendedorId: order.vendedorId,
    valor: pagamento.valor,
  };
}

function resultado(
  base: Base,
  status:
    | "PRONTO"
    | "CONSULTA_NECESSARIA"
    | "CONFIRMADO",
  valor: Prisma.Decimal
) {
  return {
    solicitacaoId: base.id,
    pedidoId: base.pedidoId,
    status,
    valor: valor.toFixed(2),

    mensagem:
      status === "CONFIRMADO"
        ? "Reembolso integral confirmado pelo Mercado Pago. Pedido cancelado; estoque depende de conferência física."
        : status === "PRONTO"
          ? "Pagamento de teste conferido. Confirme para solicitar o reembolso integral."
          : "Há uma tentativa registrada. A devolução ainda não foi confirmada. Consulte novamente; nenhum novo envio será feito.",
  };
}

async function consultarRegistrado(
  base: Base,
  administradorId: number
) {
  const r = base.reembolso;

  if (!r) {
    throw new CancelamentoError(
      "Tentativa não encontrada."
    );
  }

  if (r.status === "CONFIRMADO") {
    return resultado(
      base,
      "CONFIRMADO",
      r.valor
    );
  }

  const order =
    await consultarOrderParaReembolso(
      r.orderId
    );

  const pagamento = vinculo(base, order);

  if (
    r.pagamentoId !== pagamento.id ||
    r.orderId !==
      pagamento.identificadorExterno ||
    r.vendedorId !== order.vendedorId ||
    !r.valor.equals(pagamento.valor)
  ) {
    throw new CancelamentoError(
      "A tentativa não corresponde ao pagamento consultado."
    );
  }

  const devolucao = order.refunds[0];

  if (
    order.refunds.length !== 1 ||
    !devolucao ||
    devolucao.status !== "processed" ||
    devolucao.transacaoId !== r.transacaoId ||
    !mesmoValor(
      devolucao.valor,
      r.valor
    ) ||
    ![
      "processed",
      "refunded",
    ].includes(order.status) ||
    order.statusDetail !== "refunded"
  ) {
    return resultado(
      base,
      "CONSULTA_NECESSARIA",
      r.valor
    );
  }

  await confirmarReembolsoNoBanco(
    base.id,
    administradorId,
    r.id,
    {
      pedidoId: base.pedidoId,
      pagamentoId: r.pagamentoId,
      orderId: r.orderId,
      transacaoId: r.transacaoId,
      vendedorId: r.vendedorId,
      valor: r.valor,
    },
    devolucao.id
  );

  return resultado(
    base,
    "CONFIRMADO",
    r.valor
  );
}

export async function processarReembolsoComoAdministrador(
  solicitacaoId: number,
  administradorId: number,
  acao: unknown
) {
  if (
    ![
      solicitacaoId,
      administradorId,
    ].every(
      (id) =>
        Number.isSafeInteger(id) &&
        id > 0 &&
        id <= 2147483647
    ) ||
    (
      acao !== "consultar" &&
      acao !== "executar"
    )
  ) {
    throw new CancelamentoError(
      "Solicitação ou ação inválida.",
      400
    );
  }

  if (
    process.env.MERCADO_PAGO_CHECKOUT_MODO !==
    "teste"
  ) {
    throw new CancelamentoError(
      "Reembolsos restritos ao ambiente de teste."
    );
  }

  let base = await buscarBaseReembolso(
    solicitacaoId
  );

  if (base.reembolso) {
    return consultarRegistrado(
      base,
      administradorId
    );
  }

  const orderId =
    base.pedido.pagamentos[0]
      ?.identificadorExterno;

  if (!orderId) {
    throw new CancelamentoError(
      "Pagamento sem Order registrada."
    );
  }

  const order =
    await consultarOrderParaReembolso(
      orderId
    );

  const prova = conferirAprovacao(
    base,
    order
  );

  if (acao === "consultar") {
    return resultado(
      base,
      "PRONTO",
      prova.valor
    );
  }

  const {
    tentativa,
    podeEnviar,
  } = await registrarTentativaReembolso(
    solicitacaoId,
    administradorId,
    prova
  );

  if (podeEnviar) {
    try {
      await enviarReembolsoIntegral(
        tentativa.orderId,
        tentativa.chaveIdempotencia
      );
    } catch {
      // Preserva a tentativa e consulta o resultado.
      // Não repete o envio em caso de resposta incerta.
    }
  }

  base = await buscarBaseReembolso(
    solicitacaoId
  );

  try {
    return await consultarRegistrado(
      base,
      administradorId
    );
  } catch {
    return resultado(
      base,
      "CONSULTA_NECESSARIA",
      tentativa.valor
    );
  }
}