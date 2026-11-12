import { NextRequest } from "next/server";

import {
  revisarPagamentoAdminController,
} from "../../../../../src/controllers/revisaoPagamentoAdminController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return revisarPagamentoAdminController(request);
}