import { NextRequest } from "next/server";

import {
  consultarCancelamentoController,
  solicitarCancelamentoController,
} from "../../../../src/controllers/cancelamentoController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return consultarCancelamentoController(request);
}

export async function POST(request: NextRequest) {
  return solicitarCancelamentoController(request);
}