
import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

/* =========================================================
   VALIDAR ASSINATURA DO WEBHOOK MERCADO PAGO
   =========================================================
   Verifica a assinatura HMAC-SHA256 enviada pelo
   Mercado Pago no cabeçalho x-signature.

   A chave secreta deve existir somente no servidor.

   Esta função:
   - Não consulta pagamentos.
   - Não altera pedidos.
   - Não modifica estoque.
   - Apenas verifica a autenticidade da assinatura.
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
  // 1. Recupera a chave secreta configurada no servidor.
  const segredo = process.env.MERCADO_PAGO_WEBHOOK_SECRET;

  // Sem segredo ou cabeçalhos, a notificação é rejeitada.
  if (!segredo || !assinatura || !requestId || !dataId) {
    return false;
  }

  // 2. Extrai os componentes do cabeçalho x-signature.
  // Formato esperado: ts=...,v1=...
  const partes = assinatura.split(",");

  const timestamp = partes
    .find((parte) => parte.trim().startsWith("ts="))
    ?.trim()
    .slice(3);

  const assinaturaRecebida = partes
    .find((parte) => parte.trim().startsWith("v1="))
    ?.trim()
    .slice(3);

  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !assinaturaRecebida ||
    !/^[a-fA-F0-9]{64}$/.test(assinaturaRecebida)
  ) {
    return false;
  }

  // 3. Impede aceitar notificações muito antigas.
  const instante = Number(timestamp) * 1000;

  if (
    !Number.isFinite(instante) ||
    Math.abs(Date.now() - instante) > 5 * 60 * 1000
  ) {
    return false;
  }

  // 4. Monta o manifesto utilizado pelo Mercado Pago.
  const manifesto =
    `id:${dataId};request-id:${requestId};ts:${timestamp};`;

  // 5. Calcula a assinatura esperada.
  const assinaturaEsperada = createHmac(
    "sha256",
    segredo
  )
    .update(manifesto)
    .digest();

  const assinaturaInformada = Buffer.from(
    assinaturaRecebida,
    "hex"
  );

  // 6. Compara as assinaturas em tempo constante.
  return (
    assinaturaEsperada.length === assinaturaInformada.length &&
    timingSafeEqual(
      assinaturaEsperada,
      assinaturaInformada
    )
  );
}
