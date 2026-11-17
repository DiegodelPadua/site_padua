import { NextRequest } from "next/server";

import {
  analisarCancelamentoAdminController,
} from "../../../../../src/controllers/analiseCancelamentoAdminController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return analisarCancelamentoAdminController(request);
}