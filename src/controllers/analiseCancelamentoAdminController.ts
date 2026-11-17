import { NextRequest, NextResponse } from "next/server";

import {
  verificarAdministrador,
} from "../utils/adminAuth";

import {
  analisarSolicitacaoComoAdministrador,
  CancelamentoError,
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

export async function analisarCancelamentoAdminController(
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

    const administrador = await verificarAdministrador();

    if (!administrador) {
      throw new CancelamentoError(
        "Acesso administrativo necessário.",
        403
      );
    }

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
      Object.keys(dados).length !== 4 ||
      typeof dados.solicitacaoId !== "number"
    ) {
      throw new CancelamentoError(
        "Envie somente solicitação, ação, situação esperada e resposta.",
        400
      );
    }

    const resultado =
      await analisarSolicitacaoComoAdministrador(
        dados.solicitacaoId,
        administrador.id,
        dados.acao,
        dados.statusEsperado,
        dados.resposta
      );

    return responder(resultado, 200);
  } catch (erro) {
    if (erro instanceof CancelamentoError) {
      return responder(
        { erro: erro.message },
        erro.status
      );
    }

    console.error(
      "Falha ao registrar análise de cancelamento."
    );

    return responder(
      {
        erro:
          "Não foi possível confirmar o resultado. Atualize o painel antes de tentar novamente.",
      },
      500
    );
  }
}