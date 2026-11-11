/* =========================================================
   MAPEAMENTO DE STATUS DO MERCADO PAGO
   =========================================================
   Interpreta os estados externos sem consultar o provedor
   ou alterar pagamentos e pedidos.
   Status desconhecidos exigem revisão.
   ========================================================= */

   import { StatusPagamento } from "@prisma/client";

   export type ResultadoConciliacao =
     | "PENDENTE"
     | "APROVADO"
     | "RECUSADO"
     | "CANCELADO"
     | "REVISAR";
   
   export function mapearStatusMercadoPago(
     status: string,
     statusDetail?: string | null
   ): {
     resultado: ResultadoConciliacao;
     statusPagamento: StatusPagamento | null;
     permiteConfirmarPedido: boolean;
   } {
     const estado =
       typeof status === "string"
         ? status.trim().toLowerCase()
         : "";
   
     const detalhe =
       typeof statusDetail === "string"
         ? statusDetail.trim().toLowerCase()
         : "";
   
     if (
       estado === "created" ||
       estado === "processing" ||
       estado === "action_required"
     ) {
       return {
         resultado: "PENDENTE",
         statusPagamento: StatusPagamento.PROCESSANDO,
         permiteConfirmarPedido: false,
       };
     }
   
     // Na Orders API, processed/accredited indica crédito ao vendedor.
     // Isso sozinho não autoriza confirmar um pedido: faltam identidade,
     // valores, transações, reserva e a atualização transacional do banco.
     if (
       estado === "processed" &&
       detalhe === "accredited"
     ) {
       return {
         resultado: "APROVADO",
         statusPagamento: StatusPagamento.APROVADO,
         permiteConfirmarPedido: false,
       };
     }
   
     if (
       estado === "canceled" ||
       estado === "cancelled"
     ) {
       return {
         resultado: "CANCELADO",
         statusPagamento: StatusPagamento.CANCELADO,
         permiteConfirmarPedido: false,
       };
     }
   
     if (estado === "failed") {
       return {
         resultado: "RECUSADO",
         statusPagamento: StatusPagamento.RECUSADO,
         permiteConfirmarPedido: false,
       };
     }
   
     // Inclui reembolso parcial, estorno, contestação e detalhes desconhecidos.
     return {
       resultado: "REVISAR",
       statusPagamento: null,
       permiteConfirmarPedido: false,
     };
   }
   
   /* Interpreta a transação financeira, separadamente do estado da Order.
      O segundo argumento é opcional para preservar as chamadas existentes. */
   export function interpretarStatusTransacaoMercadoPago(
     status: string,
     statusDetail?: string | null
   ): {
     statusPagamento: StatusPagamento | null;
     aprovado: boolean;
     exigeRevisao: boolean;
   } {
     const estado =
       typeof status === "string"
         ? status.trim().toLowerCase()
         : "";
   
     const detalhe =
       typeof statusDetail === "string"
         ? statusDetail.trim().toLowerCase()
         : "";
   
     // Mantém compatibilidade com approved e reconhece o par usado em Orders.
     if (
       (
         estado === "approved" &&
         (!detalhe || detalhe === "accredited")
       ) ||
       (
         estado === "processed" &&
         detalhe === "accredited"
       )
     ) {
       return {
         statusPagamento: StatusPagamento.APROVADO,
         aprovado: true,
         exigeRevisao: false,
       };
     }
   
     if (
       estado === "created" ||
       estado === "pending" ||
       estado === "in_process" ||
       estado === "processing" ||
       estado === "action_required"
     ) {
       return {
         statusPagamento: StatusPagamento.PROCESSANDO,
         aprovado: false,
         exigeRevisao: false,
       };
     }
   
     if (
       estado === "rejected" ||
       estado === "failed"
     ) {
       return {
         statusPagamento: StatusPagamento.RECUSADO,
         aprovado: false,
         exigeRevisao: false,
       };
     }
   
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
   
     if (estado === "refunded") {
       return {
         statusPagamento: StatusPagamento.ESTORNADO,
         aprovado: false,
         exigeRevisao: true,
       };
     }
   
     // processed sem accredited, reembolso parcial e estados desconhecidos
     // não são tratados como aprovação financeira.
     return {
       statusPagamento: null,
       aprovado: false,
       exigeRevisao: true,
     };
   }