/*
 * API DE PEDIDOS — PÁDUA CULTURE
 *
 * Encaminha a requisição para o Controller.
 * Autenticação, validações e regras de negócio
 * permanecem nas camadas já existentes.
 */

import { NextRequest } from "next/server";
import { criarPedidoController } from "../../../src/controllers/pedidoController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Criação de pedido por cliente autenticado.
export async function POST(request: NextRequest) {
  return criarPedidoController(request);
}