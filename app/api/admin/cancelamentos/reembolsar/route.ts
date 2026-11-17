import { NextRequest } from "next/server";

import {
  reembolsarCancelamentoAdminController,
} from "../../../../../src/controllers/reembolsoCancelamentoAdminController";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest
) {
  return reembolsarCancelamentoAdminController(
    request
  );
}