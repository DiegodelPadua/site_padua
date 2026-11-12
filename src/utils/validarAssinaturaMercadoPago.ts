import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

/* =========================================================
   VALIDAR ASSINATURA DO WEBHOOK MERCADO PAGO
   =========================================================
   Não consulta pagamentos nem altera pedidos ou estoque.

   Os logs contêm somente códigos fixos de diagnóstico.
   Não registram segredo, assinatura ou token.
   ========================================================= */

type DadosAssinaturaMercadoPago = {
  assinatura: string | null;
  requestId: string | null;
  dataId: string | null;
};

function rejeitar(motivo: string): false {
  console.warn(
    `[MP_WEBHOOK_ASSINATURA] ${motivo}`
  );

  return false;
}

export function validarAssinaturaMercadoPago({
  assinatura,
  requestId,
  dataId,
}: DadosAssinaturaMercadoPago): boolean {
  const segredo =
    process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (!segredo) {
    return rejeitar("SEGREDO_AUSENTE");
  }

  if (!assinatura) {
    return rejeitar("X_SIGNATURE_AUSENTE");
  }

  if (!requestId) {
    return rejeitar("X_REQUEST_ID_AUSENTE");
  }

  if (!dataId) {
    return rejeitar("DATA_ID_AUSENTE");
  }

  if (
    assinatura.length > 1024 ||
    !/^[A-Za-z0-9._:-]{1,200}$/.test(requestId) ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(dataId)
  ) {
    return rejeitar("CAMPOS_FORA_DO_FORMATO");
  }

  let timestamp: string | undefined;
  let assinaturaRecebida: string | undefined;

  for (const parte of assinatura.split(",")) {
    const separador = parte.indexOf("=");

    if (separador < 0) {
      return rejeitar("X_SIGNATURE_MALFORMADA");
    }

    const nome = parte
      .slice(0, separador)
      .trim();

    const valor = parte
      .slice(separador + 1)
      .trim();

    if (nome === "ts") {
      if (timestamp !== undefined) {
        return rejeitar("TIMESTAMP_DUPLICADO");
      }

      timestamp = valor;
    } else if (nome === "v1") {
      if (assinaturaRecebida !== undefined) {
        return rejeitar("ASSINATURA_DUPLICADA");
      }

      assinaturaRecebida = valor;
    }
  }

  if (
    !timestamp ||
    !/^(?:\d{10}|\d{13})$/.test(timestamp)
  ) {
    return rejeitar("TIMESTAMP_INVALIDO");
  }

  if (
    !assinaturaRecebida ||
    !/^[a-fA-F0-9]{64}$/.test(assinaturaRecebida)
  ) {
    return rejeitar("V1_INVALIDO");
  }

  // Mantém exatamente o ID e o timestamp no manifesto.
  const manifesto =
    `id:${dataId};request-id:${requestId};ts:${timestamp};`;

  const esperada = createHmac(
    "sha256",
    segredo
  )
    .update(manifesto)
    .digest();

  const informada = Buffer.from(
    assinaturaRecebida,
    "hex"
  );

  if (
    esperada.length !== informada.length ||
    !timingSafeEqual(esperada, informada)
  ) {
    return rejeitar("HMAC_DIVERGENTE");
  }

  // Confere a idade após validar a autenticidade da assinatura.
  const instante =
    timestamp.length === 13
      ? Number(timestamp)
      : Number(timestamp) * 1000;

  if (
    !Number.isSafeInteger(instante) ||
    Math.abs(Date.now() - instante) > 5 * 60 * 1000
  ) {
    return rejeitar("TIMESTAMP_FORA_DA_JANELA");
  }

  return true;
}