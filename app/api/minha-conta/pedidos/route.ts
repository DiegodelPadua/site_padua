import { NextRequest } from "next/server";

import {
  consultarPedidosController,
} from "../../../../src/controllers/pedidoConsultaController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return consultarPedidosController(request);
}