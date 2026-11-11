import { NextRequest, NextResponse } from "next/server";

import { prisma } from "../../lib/prisma";
import { validarAuthToken } from "../utils/authToken";

import {
  prepararNovaCompra,
  PedidoServiceError,
} from "../services/pedidoService";

function responder(
  dados: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(dados, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

async function lerPedido(
  request: NextRequest
): Promise<number> {
  const tipo = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (tipo !== "application/json") {
    throw new PedidoServiceError(
      "Envie os dados em JSON.",
      415
    );
  }

  if (!request.body) {
    throw new PedidoServiceError(
      "Informe o pedido.",
      400
    );
  }

  const leitor = request.body.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;

  try {
    while (true) {
      const { done, value } = await leitor.read();

      if (done) break;

      tamanho += value.byteLength;

      if (tamanho > 1024) {
        await leitor.cancel().catch(() => undefined);

        throw new PedidoServiceError(
          "Dados enviados muito grandes.",
          413
        );
      }

      partes.push(value);
    }
  } finally {
    leitor.releaseLock();
  }

  let corpo: unknown;

  try {
    corpo = JSON.parse(
      Buffer.concat(partes).toString("utf8")
    );
  } catch {
    throw new PedidoServiceError(
      "JSON inválido.",
      400
    );
  }

  if (
    !corpo ||
    typeof corpo !== "object" ||
    Array.isArray(corpo)
  ) {
    throw new PedidoServiceError(
      "Dados inválidos.",
      400
    );
  }

  const dados = corpo as Record<string, unknown>;

  if (
    Object.keys(dados).length !== 1 ||
    typeof dados.pedidoId !== "number" ||
    !Number.isSafeInteger(dados.pedidoId) ||
    dados.pedidoId <= 0
  ) {
    throw new PedidoServiceError(
      "Envie somente um pedidoId numérico válido.",
      400
    );
  }

  return dados.pedidoId;
}

export async function reiniciarCheckoutController(
  request: NextRequest
) {
  try {
    const origem = request.headers.get("origin");

    if (
      ![
        "https://paduaculture.com.br",
        "https://www.paduaculture.com.br",
      ].includes(origem ?? "")
    ) {
      return responder(
        { erro: "Origem não autorizada." },
        403
      );
    }

    const token =
      request.cookies.get("padua_session")?.value;

    if (!token) {
      return responder(
        { erro: "Entre na sua conta para continuar." },
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
      where: { id: usuarioId },
      select: { versaoSessao: true },
    });

    if (
      !usuario ||
      usuario.versaoSessao !== versaoSessao
    ) {
      return responder(
        { erro: "Sessão revogada. Faça login novamente." },
        401
      );
    }

    const pedidoId = await lerPedido(request);

    const resultado = await prepararNovaCompra(
      pedidoId,
      usuarioId
    );

    return responder(resultado, 200);
  } catch (erro) {
    if (erro instanceof PedidoServiceError) {
      return responder(
        { erro: erro.message },
        erro.status
      );
    }

    console.error(
      "Falha ao encerrar pedido vencido para nova compra."
    );

    return responder(
      {
        erro:
          "Não foi possível conferir o pedido. Tente novamente.",
      },
      500
    );
  }
}