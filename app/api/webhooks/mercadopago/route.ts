
import { NextRequest, NextResponse } from "next/server";

import { validarAssinaturaMercadoPago } from
  "../../../../src/utils/validarAssinaturaMercadoPago";

  // Permite comparar valores monetários com precisão.
import { Prisma } from "@prisma/client";

  // Localiza o pagamento vinculado à Order no MySQL.
import { buscarPagamentoPorOrderMercadoPago } from
  "../../../../src/repositories/pagamentoRepository";

// Consulta o estado da Order diretamente no Mercado Pago.
import { consultarOrderMercadoPago } from
  "../../../../src/services/mercadoPagoService";

/* =========================================================
   WEBHOOK MERCADO PAGO - PÁDUA CULTURE

   Recebe notificações e valida a assinatura.

   IMPORTANTE:
   - Não confirma pagamentos.
   - Não atualiza pedidos.
   - Não modifica estoque.
   ========================================================= */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // 1. Recupera os cabeçalhos da notificação.
    const assinatura = request.headers.get("x-signature");
    const requestId = request.headers.get("x-request-id");

    // 2. Recupera o identificador da Order enviado
    // pelo Mercado Pago na URL da notificação.
    const dataId = request.nextUrl.searchParams.get("data.id");

    // 3. Rejeita notificações sem identificação.
    if (!assinatura || !requestId || !dataId) {
      return NextResponse.json(
        { erro: "Assinatura ou identificação ausente." },
        { status: 401 }
      );
    }

    // 4. Valida criptograficamente a assinatura.
    const assinaturaValida = validarAssinaturaMercadoPago({
      assinatura,
      requestId,
      dataId,
    });

    // 5. Impede o processamento de notificações
    // que não passaram na validação.
    if (!assinaturaValida) {
      return NextResponse.json(
        { erro: "Assinatura inválida." },
        { status: 401 }
      );
    }

    // 6. Lê o corpo somente após validar a assinatura.
    const corpo = await request.text();

    if (Buffer.byteLength(corpo, "utf8") > 10000) {
      return NextResponse.json(
        { erro: "Notificação muito grande." },
        { status: 413 }
      );
    }

    // 7. Verifica o formato JSON.
    let notificacao: unknown;

    try {
      notificacao = JSON.parse(corpo);
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

    if (
      typeof notificacao !== "object" ||
      notificacao === null ||
      Array.isArray(notificacao)
    ) {
      return NextResponse.json(
        { erro: "Notificação inválida." },
        { status: 400 }
      );
    }


    // 8. Interpreta os campos da notificação.
    // Ainda não utilizamos esses dados para confirmar pagamentos.
    const evento = notificacao as {
    type?: unknown;
    data?: {
        id?: unknown;
    };
    };

    // 9. Aceita somente notificações do tipo Order.
    if (evento.type !== "order") {
    return NextResponse.json(
        {
        recebido: true,
        processado: false,
        motivo: "Evento não processado por esta integração.",
        },
        { status: 200 }
    );
    }

    // 10. Confere se o identificador informado no corpo
    // corresponde ao identificador utilizado na assinatura.
    if (
    typeof evento.data?.id !== "string" ||
    evento.data.id !== dataId
    ) {
    return NextResponse.json(
        { erro: "Identificador da Order inconsistente." },
        { status: 400 }
    );
    }

   
// 11. Localiza a cobrança registrada no MySQL.
// O identificador veio de uma notificação autenticada.
const pagamento = await buscarPagamentoPorOrderMercadoPago(dataId);

// 12. Se a Order ainda não estiver vinculada ao banco,
// não tentamos confirmar nenhum pagamento.
if (!pagamento) {
  return NextResponse.json(
    {
      recebido: true,
      processado: false,
      motivo: "Order ainda não localizada no banco.",
    },
    { status: 200 }
  );
}

// 13. Consulta a situação atual diretamente no Mercado Pago.
// Nunca confiamos apenas no status informado pelo webhook.
const order = await consultarOrderMercadoPago(dataId);

// 14. Confere se a Order pertence ao pedido encontrado.
if (order.referenciaExterna !== String(pagamento.pedidoId)) {
  throw new Error(
    "A referência da Order não corresponde ao pedido."
  );
}

// 15. Compara o valor oficial do MySQL com o valor do provedor.
// Utilizamos Decimal para evitar erros de ponto flutuante.
const valorMercadoPago = new Prisma.Decimal(order.valorTotal);

if (
  !valorMercadoPago.equals(pagamento.valor) ||
  !valorMercadoPago.equals(pagamento.pedido.valorTotal)
) {
  throw new Error(
    "O valor da Order não corresponde ao pedido."
  );
}

// 16. A consulta financeira foi realizada com sucesso.
// Ainda não alteramos o pagamento, o pedido ou o estoque.
return NextResponse.json(
  {
    recebido: true,
    assinaturaValida: true,
    orderLocalizada: true,
    conciliacaoConsultada: true,
    processado: false,
  },
  { status: 200 }
);
  } catch (erro) {
    // Registra apenas uma mensagem genérica no servidor.
    // Não expõe credenciais ou detalhes financeiros ao cliente.
    console.error("Falha no processamento do webhook Mercado Pago.");

    return NextResponse.json(
      { erro: "Erro ao processar notificação." },
      { status: 500 }
    );
  }
}