import { Prisma } from "@prisma/client";

import {
  validarConsultaOrderMercadoPago,
} from "./mercadoPagoService";

import {
  CancelamentoError,
} from "../repositories/cancelamentoRepository";

const api = "https://api.mercadopago.com";

function configuracao() {
  if (
    process.env.MERCADO_PAGO_CHECKOUT_MODO !==
    "teste"
  ) {
    throw new CancelamentoError(
      "Reembolsos liberados somente no modo de teste."
    );
  }

  const token =
    process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!token) {
    throw new CancelamentoError(
      "Credencial de teste não configurada."
    );
  }

  return token;
}

function objeto(
  valor: unknown
): Record<string, unknown> {
  if (
    !valor ||
    typeof valor !== "object" ||
    Array.isArray(valor)
  ) {
    throw new CancelamentoError(
      "Resposta financeira inválida do Mercado Pago."
    );
  }

  return valor as Record<string, unknown>;
}

function lista(valor: unknown): unknown[] {
  if (valor === undefined) return [];

  if (!Array.isArray(valor)) {
    throw new CancelamentoError(
      "Ajustes financeiros inválidos."
    );
  }

  return valor;
}

export function extrairConsultaReembolso(
  corpo: unknown,
  orderId: string
) {
  const bruto = objeto(corpo);

  const order =
    validarConsultaOrderMercadoPago(
      bruto,
      orderId
    );

  const grupo =
    bruto.transactions === undefined
      ? {}
      : objeto(bruto.transactions);

  const refunds = lista(grupo.refunds).map(
    (item) => {
      const r = objeto(item);

      if (
        typeof r.id !== "string" ||
        !/^REF[A-Za-z0-9_-]{1,140}$/.test(
          r.id
        ) ||
        typeof r.transaction_id !== "string" ||
        !/^PAY[A-Za-z0-9_-]{1,140}$/.test(
          r.transaction_id
        ) ||
        typeof r.amount !== "string" ||
        !/^\d{1,8}(\.\d{1,2})?$/.test(
          r.amount
        ) ||
        typeof r.status !== "string"
      ) {
        throw new CancelamentoError(
          "Comprovante de reembolso incompleto."
        );
      }

      return {
        id: r.id,
        transacaoId: r.transaction_id,
        valor: r.amount,
        status: r.status,
      };
    }
  );

  const ajustesExtras =
    order.possuiAjustesFinanceiros ||
    lista(grupo.chargebacks).length > 0 ||
    lista(grupo.payments).some((item) => {
      const t = objeto(item);

      return (
        lista(t.refunds).length > 0 ||
        lista(t.chargebacks).length > 0
      );
    });

  return {
    ...order,
    refunds,
    ajustesExtras,
  };
}

export async function consultarOrderParaReembolso(
  orderId: string
) {
  const token = configuracao();

  if (
    !/^ORDTST[A-Za-z0-9_-]{1,100}$/.test(
      orderId
    )
  ) {
    throw new CancelamentoError(
      "Esta etapa aceita somente Orders de teste (ORDTST)."
    );
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const [resposta, contaResposta] =
    await Promise.all([
      fetch(
        `${api}/v1/orders/${encodeURIComponent(orderId)}`,
        {
          headers,
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        }
      ),

      fetch(`${api}/users/me`, {
        headers,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      }),
    ]);

  if (!resposta.ok || !contaResposta.ok) {
    throw new CancelamentoError(
      "Não foi possível consultar a Order e a conta de teste.",
      503
    );
  }

  const [corpo, contaCorpo]: unknown[] =
    await Promise.all([
      resposta.json(),
      contaResposta.json(),
    ]);

  const conta = objeto(contaCorpo);

  const vendedorId =
    typeof conta.id === "string" &&
    /^[1-9]\d*$/.test(conta.id)
      ? conta.id
      : typeof conta.id === "number" &&
          Number.isSafeInteger(conta.id) &&
          conta.id > 0
        ? String(conta.id)
        : null;

  const order = extrairConsultaReembolso(
    corpo,
    orderId
  );

  if (
    !vendedorId ||
    conta.site_id !== "MLB" ||
    !Array.isArray(conta.tags) ||
    !conta.tags.includes("test_user") ||
    order.vendedorId !== vendedorId ||
    order.liveMode === true
  ) {
    throw new CancelamentoError(
      "A Order e o vendedor precisam pertencer ao ambiente brasileiro de teste."
    );
  }

  return {
    ...order,
    vendedorId,
  };
}

export function mesmoValor(
  valor: string | null | undefined,
  esperado: Prisma.Decimal
) {
  return (
    typeof valor === "string" &&
    /^\d{1,8}(\.\d{1,2})?$/.test(valor) &&
    esperado.isFinite() &&
    esperado.greaterThan(0) &&
    new Prisma.Decimal(valor).equals(
      esperado
    )
  );
}

// A chave precisa estar persistida antes desta chamada.
// O resultado será confirmado por uma consulta GET.
export async function enviarReembolsoIntegral(
  orderId: string,
  chave: string
) {
  const token = configuracao();

  if (
    !/^ORDTST[A-Za-z0-9_-]{1,100}$/.test(
      orderId
    ) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      chave
    )
  ) {
    throw new CancelamentoError(
      "Identificação de reembolso inválida."
    );
  }

  const resposta = await fetch(
    `${api}/v1/orders/${encodeURIComponent(orderId)}/refund`,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "X-Idempotency-Key": chave,
      },

      // Sem corpo e sem valor: reembolso integral.
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    }
  );

  return resposta.status;
}