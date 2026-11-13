import { NextRequest } from "next/server";

import {
  consultarCobrancaAdminController,
} from "../../../../../src/controllers/consultaCobrancaAdminController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return consultarCobrancaAdminController(request);
}