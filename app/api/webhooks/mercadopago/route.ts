import { NextRequest, NextResponse } from "next/server";

import {
  validarAssinaturaMercadoPago,
} from "../../../../src/utils/validarAssinaturaMercadoPago";

import {
  processarNotificacaoMercadoPago,
} from "../../../../src/services/pagamentoService";

/* =========================================================
   WEBHOOK MERCADO PAGO - PÁDUA CULTURE
   =========================================================
   Valida a assinatura antes de chamar o serviço de conciliação.
   O serviço verifica a Order no provedor e salva a aprovação
   junto com a decisão sobre o pedido, dentro de uma transação.
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

    // Somente o ID autenticado é encaminhado.
    // Status e valores serão consultados diretamente no provedor.
    const resultado =
      await processarNotificacaoMercadoPago(dataId);

    return responder(
      { recebido: true, ...resultado },
      resultado.processado ? 200 : 503
    );
  } catch {
    // Não registra assinatura, segredo ou resposta financeira.
    console.error(
      "Falha no processamento do webhook Mercado Pago."
    );

    return responder(
      { erro: "Não foi possível processar a notificação." },
      503
    );
  }
}