import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import {
  validarAssinaturaMercadoPago,
} from "../../../../src/utils/validarAssinaturaMercadoPago";

import {
  buscarPagamentoPorOrderMercadoPago,
} from "../../../../src/repositories/pagamentoRepository";

import {
  consultarOrderMercadoPago,
} from "../../../../src/services/mercadoPagoService";

import {
  mapearStatusMercadoPago,
  interpretarStatusTransacaoMercadoPago,
} from "../../../../src/utils/mercadoPagoStatus";

/* =========================================================
   WEBHOOK MERCADO PAGO - PÁDUA CULTURE
   =========================================================
   Valida a assinatura e consulta a Order no provedor.
   Não confirma pagamentos, pedidos ou movimentações de estoque
   enquanto a conciliação transacional não estiver conectada.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responder(
  dados: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(dados, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(status === 503
        ? { "Retry-After": "60" }
        : {}),
    },
  });
}

// Impede acumular um corpo grande antes de verificar seu tamanho.
async function lerCorpoLimitado(
  request: NextRequest
): Promise<string | null> {
  if (!request.body) return "";

  const leitor = request.body.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;

  try {
    while (true) {
      const { done, value } = await leitor.read();

      if (done) break;

      tamanho += value.byteLength;

      if (tamanho > 10000) {
        await leitor.cancel().catch(() => undefined);
        return null;
      }

      partes.push(value);
    }
  } finally {
    leitor.releaseLock();
  }

  return Buffer.concat(partes).toString("utf8");
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.MERCADO_PAGO_WEBHOOK_SECRET) {
      return responder(
        { erro: "Webhook temporariamente indisponível." },
        503
      );
    }

    const ids =
      request.nextUrl.searchParams.getAll("data.id");

    if (
      ids.length !== 1 ||
      !/^ORD[A-Za-z0-9_-]{1,100}$/.test(ids[0])
    ) {
      return responder(
        { erro: "Identificação da Order inválida." },
        400
      );
    }

    const dataId = ids[0];

    const assinaturaValida =
      validarAssinaturaMercadoPago({
        assinatura: request.headers.get("x-signature"),
        requestId: request.headers.get("x-request-id"),
        dataId,
      });

    if (!assinaturaValida) {
      return responder(
        { erro: "Assinatura inválida." },
        401
      );
    }

    const corpo = await lerCorpoLimitado(request);

    if (corpo === null) {
      return responder(
        { erro: "Notificação muito grande." },
        413
      );
    }

    let notificacao: unknown;

    try {
      notificacao = JSON.parse(corpo);
    } catch {
      return responder(
        { erro: "JSON inválido." },
        400
      );
    }

    if (
      !notificacao ||
      typeof notificacao !== "object" ||
      Array.isArray(notificacao)
    ) {
      return responder(
        { erro: "Notificação inválida." },
        400
      );
    }

    const evento =
      notificacao as Record<string, unknown>;

    if (evento.type !== "order") {
      return responder(
        {
          recebido: true,
          processado: false,
          motivo: "EVENTO_IGNORADO",
        },
        200
      );
    }

    const dados = evento.data as
      | Record<string, unknown>
      | undefined;

    if (
      !dados ||
      typeof dados !== "object" ||
      Array.isArray(dados) ||
      dados.id !== dataId
    ) {
      return responder(
        { erro: "Identificador da Order inconsistente." },
        400
      );
    }

    // Não usa status, valores ou live_mode do corpo para aprovar pagamentos.
    const pagamento =
      await buscarPagamentoPorOrderMercadoPago(dataId);

    if (!pagamento) {
      // O webhook pode chegar antes de o ID externo ser persistido.
      // Não responde sucesso, para não encerrar prematuramente os reenvios.
      return responder(
        {
          recebido: true,
          processado: false,
          motivo: "VINCULO_PENDENTE",
        },
        503
      );
    }

    const order = await consultarOrderMercadoPago(dataId);
    const valor = new Prisma.Decimal(order.valorTotal);

    if (
      order.mercadoPagoOrderId !== dataId ||
      order.referenciaExterna !==
        String(pagamento.pedidoId) ||
      !valor.equals(pagamento.valor) ||
      !valor.equals(pagamento.pedido.valorTotal)
    ) {
      return responder(
        {
          recebido: true,
          processado: false,
          motivo: "DADOS_DIVERGENTES",
        },
        503
      );
    }

    const estado = mapearStatusMercadoPago(
      order.status,
      order.statusDetail
    );

    const exigeConciliacao =
      estado.resultado !== "PENDENTE" ||
      order.transacoes.some((transacao) => {
        const analise =
          interpretarStatusTransacaoMercadoPago(
            transacao.status ?? "",
            transacao.status_detail
          );

        return analise.aprovado || analise.exigeRevisao;
      });

    if (exigeConciliacao) {
      // Não reconhece como concluída uma atualização financeira ainda não salva.
      return responder(
        {
          recebido: true,
          processado: false,
          motivo: "CONCILIACAO_PENDENTE",
        },
        503
      );
    }

    return responder(
      {
        recebido: true,
        conferido: true,
        confirmado: false,
      },
      200
    );
  } catch {
    // Mensagem genérica: não registra assinatura, segredo ou resposta financeira.
    console.error(
      "Falha no processamento do webhook Mercado Pago."
    );

    return responder(
      { erro: "Não foi possível processar a notificação." },
      503
    );
  }
}