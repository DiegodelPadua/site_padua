import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

/* =========================================================
   VALIDAR ASSINATURA DO WEBHOOK MERCADO PAGO
   =========================================================
   Verifica HMAC-SHA256 com o segredo exclusivo do servidor.
   Não consulta pagamentos nem altera pedidos ou estoque.
   ========================================================= */

type DadosAssinaturaMercadoPago = {
  assinatura: string | null;
  requestId: string | null;
  dataId: string | null;
};

export function validarAssinaturaMercadoPago({
  assinatura,
  requestId,
  dataId,
}: DadosAssinaturaMercadoPago): boolean {
  const segredo =
    process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  if (
    !segredo ||
    !assinatura ||
    !requestId ||
    !dataId ||
    assinatura.length > 1024 ||
    !/^[A-Za-z0-9._:-]{1,200}$/.test(requestId) ||
    !/^[A-Za-z0-9_-]{1,120}$/.test(dataId)
  ) {
    return false;
  }

  let timestamp: string | undefined;
  let assinaturaRecebida: string | undefined;

  // Rejeita componentes duplicados para não interpretar um cabeçalho ambíguo.
  for (const parte of assinatura.split(",")) {
    const separador = parte.indexOf("=");

    if (separador < 0) return false;

    const nome = parte
      .slice(0, separador)
      .trim();

    const valor = parte
      .slice(separador + 1)
      .trim();

    if (nome === "ts") {
      if (timestamp !== undefined) return false;
      timestamp = valor;
    } else if (nome === "v1") {
      if (assinaturaRecebida !== undefined) return false;
      assinaturaRecebida = valor;
    }
  }

  if (
    !timestamp ||
    !/^(?:\d{10}|\d{13})$/.test(timestamp) ||
    !assinaturaRecebida ||
    !/^[a-fA-F0-9]{64}$/.test(assinaturaRecebida)
  ) {
    return false;
  }

  // Aceita segundos ou milissegundos, mantendo a tolerância de cinco minutos.
  // A unidade é convertida somente para conferir a idade da notificação.
  const instante =
    timestamp.length === 13
      ? Number(timestamp)
      : Number(timestamp) * 1000;

  if (
    !Number.isSafeInteger(instante) ||
    Math.abs(Date.now() - instante) > 5 * 60 * 1000
  ) {
    return false;
  }

  // Usa os valores recebidos no manifesto, sem alterar maiúsculas/minúsculas
  // do ID nem converter o timestamp que participa do cálculo da assinatura.
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

  return (
    esperada.length === informada.length &&
    timingSafeEqual(esperada, informada)
  );
}