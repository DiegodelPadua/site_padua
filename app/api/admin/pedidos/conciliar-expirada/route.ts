import { NextRequest } from "next/server";

import {
  conciliarExpiradaAdminController,
} from "../../../../../src/controllers/conciliacaoExpiradaAdminController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return conciliarExpiradaAdminController(request);
}