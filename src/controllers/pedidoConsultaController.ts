import { NextRequest, NextResponse } from "next/server";

import { prisma } from "../../lib/prisma";

import {
  validarAuthToken,
} from "../utils/authToken";

import {
  listarPedidosDoCliente,
} from "../services/pedidoService";

function responder(
  dados: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(dados, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}

export async function consultarPedidosController(
  request: NextRequest
) {
  try {
    const token =
      request.cookies.get("padua_session")?.value;

    if (!token) {
      return responder(
        {
          erro:
            "Entre na sua conta para consultar os pedidos.",
        },
        401
      );
    }

    let usuarioId: number;
    let versaoSessao: number;

    try {
      const payload = await validarAuthToken(token);

      if (
        typeof payload.usuarioId !== "number" ||
        !Number.isSafeInteger(payload.usuarioId) ||
        payload.usuarioId <= 0 ||
        typeof payload.versaoSessao !== "number" ||
        !Number.isSafeInteger(payload.versaoSessao) ||
        payload.versaoSessao < 1
      ) {
        return responder(
          { erro: "Sessão inválida ou expirada." },
          401
        );
      }

      usuarioId = payload.usuarioId;
      versaoSessao = payload.versaoSessao;
    } catch {
      return responder(
        { erro: "Sessão inválida ou expirada." },
        401
      );
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        versaoSessao: true,
      },
    });

    if (
      !usuario ||
      usuario.versaoSessao !== versaoSessao
    ) {
      return responder(
        {
          erro: "Sessão revogada. Faça login novamente.",
        },
        401
      );
    }

    // O usuário consultado vem exclusivamente da sessão.
    const pedidos = await listarPedidosDoCliente(
      usuarioId
    );

    return responder({ pedidos }, 200);
  } catch {
    console.error(
      "Falha ao consultar os pedidos do cliente."
    );

    return responder(
      {
        erro: "Não foi possível carregar seus pedidos.",
      },
      500
    );
  }
}