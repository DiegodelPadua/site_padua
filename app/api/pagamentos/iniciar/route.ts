/**
 * API DE INÍCIO DE PAGAMENTO — PÁDUA CULTURE
 * Encaminha a requisição para o controller de pagamento.
 */

import { NextRequest } from "next/server";

import {
  iniciarPagamentoController,
} from "../../../../src/controllers/pagamentoController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Inicia ou retoma o pagamento de um pedido existente do cliente autenticado.
export async function POST(request: NextRequest) {
  return iniciarPagamentoController(request);
}