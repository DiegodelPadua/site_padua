import { NextRequest, NextResponse } from "next/server";

import { prisma } from "../../lib/prisma";
import { validarAuthToken } from "../utils/authToken";

import {
  CancelamentoError,
  consultarSolicitacaoDoCliente,
  solicitarCancelamentoDoCliente,
} from "../services/cancelamentoService";

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

async function identificarCliente(
  request: NextRequest
) {
  const token =
    request.cookies.get("padua_session")?.value;

  if (!token) {
    throw new CancelamentoError(
      "Entre na sua conta para continuar.",
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
      throw new Error("Payload inválido.");
    }

    usuarioId = payload.usuarioId;
    versaoSessao = payload.versaoSessao;
  } catch {
    throw new CancelamentoError(
      "Sessão inválida ou expirada.",
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
    throw new CancelamentoError(
      "Sessão revogada. Faça login novamente.",
      401
    );
  }

  return usuarioId;
}

function tratarErro(erro: unknown) {
  if (erro instanceof CancelamentoError) {
    return responder(
      { erro: erro.message },
      erro.status
    );
  }

  console.error(
    "Falha ao consultar ou registrar solicitação de cancelamento."
  );

  return responder(
    {
      erro:
        "Não foi possível confirmar o resultado. Atualize a solicitação antes de tentar novamente.",
    },
    500
  );
}

export async function consultarCancelamentoController(
  request: NextRequest
) {
  try {
    const usuarioId = await identificarCliente(request);

    const ids =
      request.nextUrl.searchParams.getAll("pedidoId");

    if (
      ids.length !== 1 ||
      !/^[1-9]\d{0,9}$/.test(ids[0])
    ) {
      throw new CancelamentoError(
        "Informe um pedido válido.",
        400
      );
    }

    const resultado =
      await consultarSolicitacaoDoCliente(
        Number(ids[0]),
        usuarioId
      );

    return responder(resultado, 200);
  } catch (erro) {
    return tratarErro(erro);
  }
}

export async function solicitarCancelamentoController(
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
      throw new CancelamentoError(
        "Origem não autorizada.",
        403
      );
    }

    const usuarioId = await identificarCliente(request);

    const tipo = request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();

    if (tipo !== "application/json" || !request.body) {
      throw new CancelamentoError(
        "Envie os dados em JSON.",
        415
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

        if (tamanho > 4096) {
          await leitor.cancel().catch(() => undefined);

          throw new CancelamentoError(
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
      throw new CancelamentoError(
        "JSON inválido.",
        400
      );
    }

    if (
      !corpo ||
      typeof corpo !== "object" ||
      Array.isArray(corpo)
    ) {
      throw new CancelamentoError(
        "Dados inválidos.",
        400
      );
    }

    const dados = corpo as Record<string, unknown>;

    if (
      Object.keys(dados).length !== 2 ||
      typeof dados.pedidoId !== "number" ||
      typeof dados.motivo !== "string"
    ) {
      throw new CancelamentoError(
        "Envie somente pedidoId e motivo.",
        400
      );
    }

    const resultado =
      await solicitarCancelamentoDoCliente(
        dados.pedidoId,
        usuarioId,
        dados.motivo
      );

    return responder(
      resultado,
      resultado.jaExistia ? 200 : 201
    );
  } catch (erro) {
    return tratarErro(erro);
  }
}