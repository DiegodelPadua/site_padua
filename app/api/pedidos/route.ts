
/* =========================================================
   API DE PEDIDOS - PÁDUA CULTURE
   =========================================================
   Endpoint:
   POST /api/pedidos

   Responsabilidades:
   - Receber a requisição HTTP.
   - Encaminhar os dados para o Controller.
   - Não implementar regras de negócio nesta camada.

   Fluxo:
   Route -> Controller -> Service -> Repository -> Prisma
   ========================================================= */

import { NextResponse } from "next/server";

/* =========================================================
   CONFIGURAÇÃO DA ROTA
   =========================================================
   Pedidos dependem de autenticação e banco de dados.
   A rota não deve ser armazenada em cache.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   POST /api/pedidos
   =========================================================
   Implementação temporária.

   A criação de pedidos será habilitada após a
   implementação e validação das demais camadas.
   ========================================================= */

export async function POST() {
  return NextResponse.json(
    {
      erro: "A criação de pedidos ainda não está disponível.",
    },
    {
      status: 501,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
