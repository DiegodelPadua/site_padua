
/* =========================================================
   PEDIDO CONTROLLER - PÁDUA CULTURE
   =========================================================
   Responsabilidades:
   - Validar a autenticação do cliente.
   - Verificar se a sessão continua ativa.
   - Validar a origem da requisição.
   - Preparar a integração com o PedidoService.

   Fluxo:
   Route -> Controller -> Service -> Repository -> Prisma
   ========================================================= */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "../../lib/prisma";
import { validarAuthToken } from "../utils/authToken";

/* =========================================================
   CONTROLLER - CRIAR PEDIDO
   ========================================================= */

export async function criarPedidoController(
  request: NextRequest
) {
  try {
    /* =====================================================
       1. IDENTIFICAR O COOKIE DE AUTENTICAÇÃO
       ===================================================== */

    const token = request.cookies.get("padua_session")?.value;

    if (!token) {
      return NextResponse.json(
        { erro: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    /* =====================================================
       2. VALIDAR O JWT
       ===================================================== */

    let usuarioId: number;
    let versaoSessao: number;

    try {
      const payload = await validarAuthToken(token);

      usuarioId = Number(payload.usuarioId);
      versaoSessao = Number(payload.versaoSessao);
    } catch {
      return NextResponse.json(
        { erro: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    /* =====================================================
       3. VERIFICAR SE A SESSÃO FOI REVOGADA
       ===================================================== */

    const usuario = await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        id: true,
        versaoSessao: true,
      },
    });

    if (
      !usuario ||
      usuario.versaoSessao !== versaoSessao
    ) {
      return NextResponse.json(
        { erro: "Sessão revogada. Faça login novamente." },
        { status: 401 }
      );
    }

    /* =====================================================
       4. VALIDAR A ORIGEM DA REQUISIÇÃO
       =====================================================
       Proteção contra requisições externas que tentem
       utilizar o cookie de autenticação do cliente.
       ===================================================== */

    const origin = request.headers.get("origin");

    if (!origin) {
      return NextResponse.json(
        { erro: "Origem da requisição não informada." },
        { status: 403 }
      );
    }

    try {
      const origem = new URL(origin);
      const destino = new URL(request.url);

      if (origem.origin !== destino.origin) {
        return NextResponse.json(
          { erro: "Origem da requisição não autorizada." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { erro: "Origem da requisição inválida." },
        { status: 403 }
      );
    }

    /* =====================================================
       5. VALIDAR O CORPO DA REQUISIÇÃO
       ===================================================== */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { erro: "Dados do pedido inválidos." },
        { status: 400 }
      );
    }

    /* =====================================================
       6. PREPARAR A CRIAÇÃO DO PEDIDO
       =====================================================
       O Service será implementado na próxima etapa.

       Ainda não criamos pedidos nem movimentamos estoque.
       ===================================================== */

    return NextResponse.json(
      {
        mensagem:
          "Autenticação validada. A criação de pedidos ainda não está habilitada.",
      },
      {
        status: 501,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "[PEDIDO CONTROLLER] Erro ao processar pedido:",
      error
    );

    return NextResponse.json(
      { erro: "Não foi possível processar o pedido." },
      { status: 500 }
    );
  }
}
