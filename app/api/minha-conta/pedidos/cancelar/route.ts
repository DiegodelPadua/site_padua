import { NextRequest } from "next/server";

import {
  cancelarPedidoController,
} from "../../../../../src/controllers/cancelamentoPedidoController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return cancelarPedidoController(request);
}