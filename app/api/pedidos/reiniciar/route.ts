import { NextRequest } from "next/server";

import {
  reiniciarCheckoutController,
} from "../../../../src/controllers/reinicioCheckoutController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return reiniciarCheckoutController(request);
}