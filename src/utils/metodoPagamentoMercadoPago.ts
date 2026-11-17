import { MetodoPagamento } from "@prisma/client";

export function identificarMetodoPagamentoMercadoPago(
  metodo:
    | {
        id?: string;
        type?: string;
      }
    | undefined
): MetodoPagamento | null {
  if (
    metodo?.id === "pix" &&
    metodo.type === "bank_transfer"
  ) {
    return MetodoPagamento.PIX;
  }

  if (
    metodo?.id === "account_money" ||
    metodo?.type === "account_money"
  ) {
    return (
      metodo.id === "account_money" &&
      metodo.type === "account_money"
    )
      ? MetodoPagamento.SALDO_MERCADO_PAGO
      : null;
  }

  if (
    metodo &&
    [
      "credit_card",
      "debit_card",
      "prepaid_card",
    ].includes(metodo.type ?? "")
  ) {
    return MetodoPagamento.CARTAO;
  }

  return null;
}